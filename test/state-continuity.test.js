import assert from "node:assert/strict";
import test from "node:test";

import { createStateContinuity, views } from "../src/services/state-continuity.js";

const DASHBOARD_CACHE_VERSION = 3;

function createMemoryStorage(initialEntries = {}) {
  const entries = new Map(Object.entries(initialEntries));
  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
    removeItem(key) {
      entries.delete(key);
    },
  };
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createMemoryAdapter({
  snapshots = {},
  sync = async () => ({ tasks: [], dailyRecords: {}, drafts: {} }),
  write = async () => ({}),
} = {}) {
  const stored = new Map(Object.entries(snapshots));

  return {
    load(identity) {
      return structuredClone(stored.get(identity.id) || { tasks: [], dailyRecords: {}, drafts: {} });
    },
    hasData(snapshot) {
      return snapshot.tasks.length > 0 || Object.keys(snapshot.dailyRecords).length > 0;
    },
    sync,
    write,
    saveConfirmed(identity, snapshot) {
      stored.set(identity.id, structuredClone(snapshot));
    },
    loadDrafts(identity, date) {
      return structuredClone(stored.get(identity.id)?.drafts?.[date] || {});
    },
    saveDrafts(identity, date, drafts) {
      const snapshot = this.load(identity);
      snapshot.drafts = { ...snapshot.drafts, [date]: structuredClone(drafts) };
      stored.set(identity.id, snapshot);
    },
    purge(identity) {
      stored.delete(identity.id);
    },
  };
}

test("已缓存的 Today 投影在打开身份 scope 时立即可读", () => {
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      snapshots: {
        alice: {
          tasks: [{ id: "task-1", name: "缓存任务" }],
          dailyRecords: {
            "2026-08-11": { date: "2026-08-11", payload: { tasks: {} } },
          },
          drafts: {},
        },
      },
    }),
  });

  const scope = continuity.open({ id: "alice" });
  const today = scope.view(views.today({ date: "2026-08-11" }));

  assert.equal(today.data.tasks[0].name, "缓存任务");
  assert.equal(today.freshness, "cached");
  assert.equal(today.activity, "idle");
});

test("远端同步确认的快照替换缓存投影", async () => {
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      snapshots: {
        alice: { tasks: [{ id: "old", name: "旧缓存" }], dailyRecords: {}, drafts: {} },
      },
      sync: async () => ({
        tasks: [{ id: "new", name: "远端确认任务" }],
        dailyRecords: {},
        drafts: {},
      }),
    }),
  });
  const scope = continuity.open({ id: "alice" });

  await scope.control.sync();
  const today = scope.view(views.today({ date: "2026-08-11" }));

  assert.deepEqual(today.data.tasks.map((task) => task.id), ["new"]);
  assert.equal(today.freshness, "confirmed");
});

test("远端同步失败时保留已有缓存并标示离线", async () => {
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      snapshots: {
        alice: { tasks: [{ id: "cached", name: "缓存任务" }], dailyRecords: {}, drafts: {} },
      },
      sync: async () => { throw new Error("offline"); },
    }),
  });
  const scope = continuity.open({ id: "alice" });

  await assert.rejects(scope.control.sync(), /offline/);
  const today = scope.view(views.today({ date: "2026-08-11" }));

  assert.equal(today.data.tasks[0].id, "cached");
  assert.equal(today.freshness, "cached");
  assert.equal(today.issue, "offline");
});

test("无缓存时远端同步失败标示错误", async () => {
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      sync: async () => { throw new Error("offline"); },
    }),
  });
  const scope = continuity.open({ id: "alice" });

  await assert.rejects(scope.control.sync(), /offline/);
  const today = scope.view(views.today({ date: "2026-08-11" }));

  assert.equal(today.freshness, "empty");
  assert.equal(today.issue, "error");
});

test("同一身份的并发同步复用同一远端请求", async () => {
  let syncCalls = 0;
  let resolveSync;
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      sync: async () => {
        syncCalls += 1;
        return new Promise((resolve) => { resolveSync = resolve; });
      },
    }),
  });
  const scope = continuity.open({ id: "alice" });
  const first = scope.control.sync();
  const second = scope.control.sync();

  await Promise.resolve();
  assert.equal(syncCalls, 1);
  resolveSync({ tasks: [], dailyRecords: {}, drafts: {} });
  await Promise.all([first, second]);
});

test("同步与 Today 写入交错时不会丢失确认写入", async () => {
  const syncResult = createDeferred();
  const writeResult = createDeferred();
  let writeCalls = 0;
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      snapshots: {
        alice: { tasks: [{ id: "task-1", name: "确认名称" }], dailyRecords: {}, drafts: {} },
      },
      sync: async () => syncResult.promise,
      write: async () => {
        writeCalls += 1;
        return writeResult.promise;
      },
    }),
  });
  const scope = continuity.open({ id: "alice" });
  const syncing = scope.control.sync();
  const writing = scope.change((writes) => writes.today.updateTask("task-1", { name: "新名称" }));

  await Promise.resolve();
  assert.equal(scope.view(views.today({ date: "2026-08-11" })).data.tasks[0].name, "新名称");
  assert.equal(writeCalls, 0);
  syncResult.resolve({ tasks: [{ id: "task-1", name: "过期同步名称" }], dailyRecords: {}, drafts: {} });
  await syncing;
  writeResult.resolve({ task: { id: "task-1", name: "新名称" } });
  await writing;

  assert.equal(scope.view(views.today({ date: "2026-08-11" })).data.tasks[0].name, "新名称");
});

test("同步失败后确认的 Today 写入会清除离线问题", async () => {
  const syncResult = createDeferred();
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      snapshots: {
        alice: { tasks: [{ id: "task-1", name: "确认名称" }], dailyRecords: {}, drafts: {} },
      },
      sync: async () => syncResult.promise,
      write: async () => ({ task: { id: "task-1", name: "新名称" } }),
    }),
  });
  const scope = continuity.open({ id: "alice" });
  const syncing = scope.control.sync();
  const writing = scope.change((writes) => writes.today.updateTask("task-1", { name: "新名称" }));

  await Promise.resolve();
  syncResult.reject(new Error("offline"));
  await assert.rejects(syncing, /offline/);
  await writing;

  const today = scope.view(views.today({ date: "2026-08-11" }));
  assert.equal(today.data.tasks[0].name, "新名称");
  assert.equal(today.issue, null);
});

test("refresh 会排在待确认 Today 写入之后", async () => {
  const writeResult = createDeferred();
  const refreshResult = createDeferred();
  const calls = [];
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      snapshots: {
        alice: { tasks: [{ id: "task-1", name: "确认名称" }], dailyRecords: {}, drafts: {} },
      },
      write: async () => {
        calls.push("write");
        return writeResult.promise;
      },
      sync: async (_identity, { force }) => {
        calls.push(force ? "refresh" : "sync");
        return refreshResult.promise;
      },
    }),
  });
  const scope = continuity.open({ id: "alice" });
  const writing = scope.change((writes) => writes.today.updateTask("task-1", { name: "新名称" }));

  await Promise.resolve();
  const refreshing = scope.control.refresh();
  assert.deepEqual(calls, ["write"]);
  writeResult.resolve({ task: { id: "task-1", name: "新名称" } });
  await writing;
  await Promise.resolve();
  assert.deepEqual(calls, ["write", "refresh"]);
  refreshResult.resolve({ tasks: [{ id: "task-1", name: "新名称" }], dailyRecords: {}, drafts: {} });
  await refreshing;

  assert.equal(scope.view(views.today({ date: "2026-08-11" })).data.tasks[0].name, "新名称");
});

test("失败的 Today 写入回滚运行时乐观投影且不覆盖确认快照", async () => {
  let rejectWrite;
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      snapshots: {
        alice: { tasks: [{ id: "task-1", name: "确认名称" }], dailyRecords: {}, drafts: {} },
      },
      write: async () => new Promise((resolve, reject) => { rejectWrite = reject; }),
    }),
  });
  const scope = continuity.open({ id: "alice" });
  const pending = scope.change((writes) => writes.today.updateTask("task-1", { name: "乐观名称" }));

  await Promise.resolve();
  assert.equal(scope.view(views.today({ date: "2026-08-11" })).data.tasks[0].name, "乐观名称");
  rejectWrite(new Error("save failed"));
  await assert.rejects(pending, /save failed/);

  const today = scope.view(views.today({ date: "2026-08-11" }));
  assert.equal(today.data.tasks[0].name, "确认名称");
  assert.equal(today.issue, "error");
});

test("Today change 拒绝伪造的内部 operation", () => {
  const continuity = createStateContinuity({ adapter: createMemoryAdapter() });
  const scope = continuity.open({ id: "alice" });

  assert.throws(
    () => scope.change(() => ({ type: "today.deleteTask", taskId: "task-1" })),
    /domain operation/,
  );
});

test("关闭的 scope 拒绝 Today 写入且不改旧投影", () => {
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      snapshots: {
        alice: { tasks: [{ id: "task-1", name: "确认名称" }], dailyRecords: {}, drafts: {} },
      },
    }),
  });
  const scope = continuity.open({ id: "alice" });
  const today = scope.view(views.today({ date: "2026-08-11" }));
  scope.control.close();

  assert.throws(
    () => scope.change((writes) => writes.today.updateTask("task-1", { name: "不应写入" })),
    /scope is closed/,
  );
  assert.equal(today.data.tasks[0].name, "确认名称");
});

test("身份切换后丢弃迟到的旧身份同步结果", async () => {
  let resolveAlice;
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      snapshots: {
        bob: { tasks: [{ id: "bob-task", name: "Bob 的任务" }], dailyRecords: {}, drafts: {} },
      },
      sync: async (identity) => {
        if (identity.id === "alice") {
          return new Promise((resolve) => { resolveAlice = resolve; });
        }
        return { tasks: [{ id: "bob-task", name: "Bob 的确认任务" }], dailyRecords: {}, drafts: {} };
      },
    }),
  });
  const alice = continuity.open({ id: "alice" });
  const aliceSync = alice.control.sync();
  await Promise.resolve();
  const bob = continuity.open({ id: "bob" });

  resolveAlice({ tasks: [{ id: "alice-task", name: "Alice 的迟到任务" }], dailyRecords: {}, drafts: {} });
  await aliceSync;

  assert.equal(bob.view(views.today({ date: "2026-08-11" })).data.tasks[0].id, "bob-task");
});

test("Demo scope 不发远端同步请求", async () => {
  let syncCalls = 0;
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      snapshots: {
        demo: { tasks: [{ id: "demo-task", name: "Demo 任务" }], dailyRecords: {}, drafts: {} },
      },
      sync: async () => {
        syncCalls += 1;
        throw new Error("network should not run");
      },
    }),
  });
  const scope = continuity.open({ mode: "demo" });

  await scope.control.sync();

  assert.equal(syncCalls, 0);
  assert.equal(scope.view(views.today({ date: "2026-08-11" })).freshness, "demo");
});

test("关闭并 purge 身份 scope 会清除确认快照与 Today 草稿", () => {
  const adapter = createMemoryAdapter({
    snapshots: {
      alice: {
        tasks: [{ id: "task-1", name: "确认任务" }],
        dailyRecords: {},
        drafts: { "2026-08-11": { "task-1": "未提交草稿" } },
      },
    },
  });
  const continuity = createStateContinuity({ adapter });
  const scope = continuity.open({ id: "alice" });

  scope.control.close({ purge: true });
  const reopened = continuity.open({ id: "alice" });
  const today = reopened.view(views.today({ date: "2026-08-11" }));

  assert.deepEqual(today.data.tasks, []);
  assert.deepEqual(today.data.drafts, {});
});

test("增量远端确认通过 public scope 合并已有缓存", async () => {
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const storage = createMemoryStorage({
    "lifeflow-private-dashboard-api-base": "http://state-continuity.test",
    "lifeflow-private-dashboard-vue-dashboard-cache": JSON.stringify({
      version: DASHBOARD_CACHE_VERSION,
      users: {
        alice: {
          tasks: [{ id: "cached", name: "缓存任务" }],
          dailyRecords: {},
          sync: { cursor: "2026-08-10T00:00:00.000Z" },
        },
      },
    }),
  });
  globalThis.localStorage = storage;
  globalThis.window = { setTimeout, clearTimeout, location: { hostname: "state-continuity.test", protocol: "http:" } };
  globalThis.fetch = async () => new Response(JSON.stringify({
    cursor: "2026-08-11T00:00:00.000Z",
    changes: { tasks: [{ id: "remote", name: "远端任务" }] },
  }), { status: 200 });

  try {
    const scope = createStateContinuity().open({ id: "alice" });
    await scope.control.sync();

    assert.deepEqual(
      scope.view(views.today({ date: "2026-08-11" })).data.tasks.map((task) => task.id).sort(),
      ["cached", "remote"],
    );
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});

test("无效同步 cursor 经 public scope 触发 bootstrap 而非增量请求", async () => {
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const storage = createMemoryStorage({
    "lifeflow-private-dashboard-api-base": "http://state-continuity.test",
    "lifeflow-private-dashboard-vue-dashboard-cache": JSON.stringify({
      version: DASHBOARD_CACHE_VERSION,
      users: {
        alice: {
          tasks: [],
          dailyRecords: {},
          sync: { cursor: "not-a-date" },
        },
      },
    }),
  });
  const requests = [];
  globalThis.localStorage = storage;
  globalThis.window = {
    setTimeout,
    clearTimeout,
    location: { hostname: "state-continuity.test", protocol: "http:" },
  };
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).endsWith("/health")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response(JSON.stringify({
      reset: true,
      cursor: "2026-08-11T00:00:00.000Z",
      snapshot: { tasks: [], dailyRecords: [] },
    }), { status: 200 });
  };

  try {
    const scope = createStateContinuity().open({ id: "alice" });
    await scope.control.sync();

    assert.ok(requests.some((url) => url.endsWith("/api/sync/bootstrap")));
    assert.equal(requests.some((url) => url.includes("/api/sync/changes")), false);
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});

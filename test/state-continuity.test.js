import assert from "node:assert/strict";
import test from "node:test";

import { attachInformationInput } from "../src/services/information-input.js";
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
  clearAccountData = async () => {},
  deleteAccount = async () => {},
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
    clearAccountData,
    deleteAccount,
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

test("reset 会失效所有已开始和排队中的旧写入", async () => {
  const firstWrite = createDeferred();
  const calls = [];
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      snapshots: {
        alice: { tasks: [{ id: "task-1", name: "确认名称" }], dailyRecords: {}, drafts: {} },
      },
      write: async (_identity, command) => {
        calls.push(command.payload.name);
        return firstWrite.promise;
      },
    }),
  });
  const scope = continuity.open({ id: "alice" });
  const first = scope.change((writes) => writes.today.updateTask("task-1", { name: "第一次" }));
  const second = scope.change((writes) => writes.today.updateTask("task-1", { name: "第二次" }));

  await Promise.resolve();
  scope.control.reset({ purge: true });
  firstWrite.resolve({ task: { id: "task-1", name: "第一次" } });
  await Promise.all([first, second]);

  assert.deepEqual(calls, ["第一次"]);
  assert.deepEqual(scope.view(views.today({ date: "2026-08-11" })).data.tasks, []);
});

test("清空账号数据排在旧写入之后，并在返回时原子清空 scope", async () => {
  const writeResult = createDeferred();
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
      clearAccountData: async () => { calls.push("clear"); },
    }),
  });
  const scope = continuity.open({ id: "alice" });
  const writing = scope.change((writes) => writes.today.updateTask("task-1", { name: "旧写入" }));
  const clearing = scope.control.clearAccountData();

  await Promise.resolve();
  assert.deepEqual(calls, ["write"]);
  writeResult.resolve({ task: { id: "task-1", name: "旧写入" } });
  await writing;
  await clearing;

  assert.deepEqual(calls, ["write", "clear"]);
  assert.deepEqual(scope.view(views.today({ date: "2026-08-11" })).data.tasks, []);
});

test("同一身份的新 session preferences 由 continuity 接收并更新唯一投影", () => {
  const continuity = createStateContinuity({ adapter: createMemoryAdapter() });
  const scope = continuity.open({ id: "alice", preferences: { theme: "light", tasks: { tagsByTaskId: { one: ["旧"] } } } });

  continuity.transition({ id: "alice", preferences: { theme: "dark", tasks: { tagsByTaskId: { one: ["新"] } } } });

  assert.equal(scope.view(views.information()).data.preferences.theme, "dark");
  assert.deepEqual(scope.view(views.information()).data.preferences.tasks.tagsByTaskId.one, ["新"]);
});

test("普通 open 不会用 Session 的旧镜像覆盖 continuity 已确认偏好", async () => {
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      write: async (_identity, command) => ({ preferences: command.preferences }),
    }),
  });
  const scope = continuity.open({ id: "alice", preferences: { content: { readItems: {} } } });
  await scope.change((writes) => writes.information.markRead("news:item-1", "item-1"));

  continuity.open({ id: "alice", preferences: { content: { readItems: {} } } });

  assert.equal(Boolean(scope.view(views.information()).data.preferences.content.readItems["news:item-1"]), true);
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

test("A→B 后丢弃 A 的迟到写入且不写入 B 的确认快照", async () => {
  const aliceWrite = createDeferred();
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      snapshots: {
        alice: { tasks: [{ id: "alice-task", name: "Alice" }], dailyRecords: {}, drafts: {} },
        bob: { tasks: [{ id: "bob-task", name: "Bob" }], dailyRecords: {}, drafts: {} },
      },
      write: async (identity) => identity.id === "alice" ? aliceWrite.promise : {},
    }),
  });
  const alice = continuity.transition({ id: "alice" });
  const writing = alice.change((writes) => writes.today.updateTask("alice-task", { name: "迟到 Alice" }));
  await Promise.resolve();
  const bob = continuity.transition({ id: "bob" }, { purgePrevious: true });

  aliceWrite.resolve({ task: { id: "alice-task", name: "迟到 Alice" } });
  await writing;

  assert.deepEqual(bob.view(views.today()).data.tasks.map((task) => task.name), ["Bob"]);
});

test("身份 lifecycle 会原子关闭旧 scope，同一用户重开后重新同步", async () => {
  const aliceSyncs = [];
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      sync: async (identity) => {
        aliceSyncs.push(identity.id);
        return { tasks: [{ id: `${identity.id}-${aliceSyncs.length}` }], dailyRecords: {}, drafts: {} };
      },
    }),
  });

  const firstAlice = continuity.transition({ id: "alice" });
  await firstAlice.control.sync();
  continuity.transition(null);
  const bob = continuity.transition({ id: "bob" });
  await bob.control.sync();
  continuity.transition(null);
  const secondAlice = continuity.transition({ id: "alice" });
  await secondAlice.control.sync();

  assert.notEqual(firstAlice, secondAlice);
  assert.deepEqual(aliceSyncs, ["alice", "bob", "alice"]);
  assert.deepEqual(secondAlice.view(views.today()).data.tasks.map((task) => task.id), ["alice-3"]);
});

test("旧身份的迟到 Home widget 结果不能提交到新身份 projection", () => {
  const continuity = createStateContinuity({ adapter: createMemoryAdapter() });
  const alice = continuity.transition({ id: "alice" });
  const commitAliceHome = alice.supplemental.beginHomeUpdate();
  const bob = continuity.transition({ id: "bob" });
  const commitBobHome = bob.supplemental.beginHomeUpdate();

  assert.equal(commitAliceHome({ weather: { location: "Alice" } }), false);
  assert.equal(commitBobHome({ weather: { location: "Bob" } }), true);
  assert.deepEqual(alice.view(views.home()).data.supplemental, {});
  assert.equal(bob.view(views.home()).data.supplemental.weather.location, "Bob");
});

test("账号 reset 后拒绝此前开始的 Home widget 提交", () => {
  const continuity = createStateContinuity({ adapter: createMemoryAdapter() });
  const scope = continuity.open({ id: "alice" });
  const commitHome = scope.supplemental.beginHomeUpdate();

  scope.control.reset({ purge: true });

  assert.equal(commitHome({ weather: { location: "旧地点" } }), false);
  assert.deepEqual(scope.view(views.home()).data.supplemental, {});
});

test("账号清空通过当前 scope reset，不会被迟到写入复活", async () => {
  const write = createDeferred();
  const adapter = createMemoryAdapter({
    snapshots: {
      alice: { tasks: [{ id: "old", name: "旧任务" }], dailyRecords: {}, drafts: {} },
    },
    write: () => write.promise,
  });
  const scope = createStateContinuity({ adapter }).open({ id: "alice" });
  const saving = scope.change((catalog) => catalog.today.createTask({ name: "迟到任务" }));
  await Promise.resolve();

  assert.equal(scope.control.reset({ purge: true }), true);
  write.resolve({ task: { id: "late", name: "迟到任务" } });
  await saving;

  assert.deepEqual(scope.view(views.today()).data.tasks, []);
  assert.deepEqual(scope.view(views.periodReviewFacts()).data.tasks, []);
});

test("账号导入后 force refresh 即使已同步也会提交新快照", async () => {
  let snapshot = { tasks: [{ id: "before" }], dailyRecords: {}, drafts: {} };
  const scope = createStateContinuity({
    adapter: createMemoryAdapter({ sync: async () => structuredClone(snapshot) }),
  }).open({ id: "alice" });
  await scope.control.sync();
  snapshot = { tasks: [{ id: "after" }], dailyRecords: {}, drafts: {} };

  await scope.control.refresh();

  assert.deepEqual(scope.view(views.today()).data.tasks.map((task) => task.id), ["after"]);
});

test("真实缓存 adapter 在 scope purge 后不会被迟到同步重新写回", async () => {
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const response = createDeferred();
  const storage = createMemoryStorage({
    "lifeflow-private-dashboard-api-base": "http://state-continuity.test",
    "lifeflow-private-dashboard-vue-dashboard-cache": JSON.stringify({
      version: DASHBOARD_CACHE_VERSION,
      users: {
        alice: {
          tasks: [{ id: "cached", name: "缓存任务" }],
          dailyRecords: {},
          sync: { cursor: "" },
        },
      },
    }),
  });
  globalThis.localStorage = storage;
  globalThis.window = {
    setTimeout,
    clearTimeout,
    location: { hostname: "state-continuity.test", protocol: "http:" },
  };
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/health")) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return response.promise;
  };

  try {
    const scope = createStateContinuity().open({ id: "alice" });
    const syncing = scope.control.sync();
    await Promise.resolve();
    scope.control.close({ purge: true });
    response.resolve(new Response(JSON.stringify({
      reset: true,
      cursor: "2026-08-11T00:00:00.000Z",
      snapshot: {
        tasks: [{ id: "late", name: "迟到任务" }],
        dailyRecords: [],
        weeklySummaries: [],
      },
    }), { status: 200 }));
    await syncing;

    assert.deepEqual(scope.view(views.today({ date: "2026-08-11" })).data.tasks.map((task) => task.id), ["cached"]);
    const cache = JSON.parse(storage.getItem("lifeflow-private-dashboard-vue-dashboard-cache"));
    assert.equal(Object.hasOwn(cache.users, "alice"), false);
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});

test("真实资讯 mutation 已确认后，独立 reconciliation 失败不会回滚收藏", async () => {
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
          content: {
            items: { news: { first: {
              id: "first",
              channel: "news",
              title: "第一条",
              canonical_url: "https://example.com/first",
              published_at: "2026-08-11T08:00:00Z",
            } } },
            sources: {},
            favorites: { news: {} },
          },
          sync: { cursor: "" },
        },
      },
    }),
  });
  globalThis.localStorage = storage;
  globalThis.window = {
    setTimeout,
    clearTimeout,
    location: { hostname: "state-continuity.test", protocol: "http:" },
  };
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).endsWith("/api/content/favorites") && options.method === "POST") {
      const item = JSON.parse(options.body);
      return new Response(JSON.stringify({
        item: { ...item, is_favorite: true, favorited_at: "2026-08-11T09:00:00Z" },
      }), { status: 201 });
    }
    return new Response(JSON.stringify({ error: "sync unavailable" }), { status: 503 });
  };

  try {
    const scope = createStateContinuity().open({ id: "alice", preferences: { content: {} } });
    const input = attachInformationInput(scope);
    const item = input.news().projection.items[0];
    await input.change((catalog) => catalog.toggleFavorite(item.ref));

    assert.equal(input.news().projection.items[0].is_favorite, true);
    await assert.rejects(scope.control.refresh(), /sync unavailable/);
    assert.equal(input.news().projection.items[0].is_favorite, true);
    const cache = JSON.parse(storage.getItem("lifeflow-private-dashboard-vue-dashboard-cache"));
    assert.equal(cache.users.alice.content.favorites.news.first.is_favorite, true);
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});

test("真实资讯偏好 mutation 会写入最近确认的离线快照", async () => {
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const storage = createMemoryStorage({
    "lifeflow-private-dashboard-api-base": "http://state-continuity.test",
    "lifeflow-private-dashboard-vue-dashboard-cache": JSON.stringify({
      version: DASHBOARD_CACHE_VERSION,
      users: { alice: { tasks: [], dailyRecords: {}, content: { items: {}, sources: {}, favorites: {} }, sync: { cursor: "" } } },
    }),
  });
  globalThis.localStorage = storage;
  globalThis.window = { setTimeout, clearTimeout, location: { hostname: "state-continuity.test", protocol: "http:" } };
  globalThis.fetch = async (_url, options = {}) => {
    const preferences = JSON.parse(options.body || "{}");
    return new Response(JSON.stringify({ preferences }), { status: 200 });
  };

  try {
    const scope = createStateContinuity().open({ id: "alice", preferences: { content: { readItems: {} } } });
    await scope.change((writes) => writes.information.markRead("news:item-1", "item-1"));

    const cache = JSON.parse(storage.getItem("lifeflow-private-dashboard-vue-dashboard-cache"));
    assert.equal(Boolean(cache.users.alice.preferences.content.readItems["news:item-1"]), true);
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});

test("任务生命周期与归档状态作为同一命令乐观更新并一起回滚", async () => {
  const writeResult = createDeferred();
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      snapshots: { alice: { tasks: [{ id: "task-1", archived: false, lifecycle_events: [] }], dailyRecords: {}, drafts: {} } },
      write: () => writeResult.promise,
    }),
  });
  const scope = continuity.open({ id: "alice" });
  const event = { taskId: "task-1", type: "archive", changedAt: "2026-08-11T08:00:00.000Z" };
  const saving = scope.change((writes) => writes.today.updateTask("task-1", {
    archived: true,
    archivedAt: event.changedAt,
    lifecycleEvents: [event],
  }));

  assert.equal(scope.view(views.today()).data.tasks[0].archived, true);
  assert.deepEqual(scope.view(views.today()).data.tasks[0].lifecycle_events, [event]);
  writeResult.reject(new Error("save failed"));
  await assert.rejects(saving, /save failed/);

  assert.equal(scope.view(views.today()).data.tasks[0].archived, false);
  assert.deepEqual(scope.view(views.today()).data.tasks[0].lifecycle_events, []);
});

test("首次 lifecycle mutation 会先迁移 legacy archived_at 事实", async () => {
  let sentCommand;
  const legacyArchivedAt = "2026-08-01T08:00:00.000Z";
  const restoreAt = "2026-08-11T08:00:00.000Z";
  const continuity = createStateContinuity({
    adapter: createMemoryAdapter({
      snapshots: { alice: { tasks: [{ id: "task-1", archived: true, archived_at: legacyArchivedAt }], dailyRecords: {}, drafts: {} } },
      write: async (_identity, command) => {
        sentCommand = command;
        return { task: { id: "task-1", archived: false, lifecycle_events: command.payload.lifecycleEvents } };
      },
    }),
  });
  const scope = continuity.open({ id: "alice" });

  await scope.change((writes) => writes.today.updateTask("task-1", {
    archived: false,
    lifecycleEvents: [{ taskId: "task-1", type: "restore", changedAt: restoreAt }],
  }));

  assert.deepEqual(sentCommand.payload.lifecycleEvents, [
    { taskId: "task-1", type: "archive", changedAt: legacyArchivedAt },
    { taskId: "task-1", type: "restore", changedAt: restoreAt },
  ]);
});

test("mutation 前启动的旧 sync 不会撤销已确认收藏", async () => {
  const oldSync = createDeferred();
  const initial = {
    tasks: [],
    dailyRecords: {},
    content: {
      items: { news: { first: { id: "first", channel: "news", title: "第一条", canonical_url: "https://example.com/first" } } },
      sources: {},
      favorites: { news: {} },
    },
  };
  const adapter = createMemoryAdapter({
    snapshots: { alice: initial },
    sync: () => oldSync.promise,
    write: async (_identity, command) => ({
      favorite: {
        ...JSON.parse(JSON.stringify(command.item)),
        is_favorite: true,
        favorited_at: "2026-08-11T09:00:00Z",
      },
    }),
  });
  const scope = createStateContinuity({ adapter }).open({ id: "alice", preferences: { content: {} } });
  const input = attachInformationInput(scope);
  const syncing = scope.control.sync();
  const saving = input.change((catalog) => catalog.toggleFavorite(input.news().projection.items[0].ref));

  assert.equal(input.news().projection.items[0].is_favorite, true);
  oldSync.resolve(structuredClone(initial));
  await syncing;
  await saving;

  assert.equal(input.news().projection.items[0].is_favorite, true);
});

test("Demo scope 不发远端同步请求", async () => {
  const previousStorage = globalThis.localStorage;
  const previousFetch = globalThis.fetch;
  let remoteCalls = 0;
  globalThis.localStorage = createMemoryStorage();
  globalThis.fetch = async () => {
    remoteCalls += 1;
    throw new Error("network should not run");
  };

  try {
    const scope = createStateContinuity().open({ mode: "demo" });
    await scope.control.sync();

    assert.equal(remoteCalls, 0);
    assert.equal(scope.view(views.today({ date: "2026-08-11" })).freshness, "demo");
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.fetch = previousFetch;
  }
});

test("状态连续性在 open 时选择 Demo 或账户 adapter，caller interface 保持不变", () => {
  const selected = [];
  const createAdapter = (name, taskId) => ({
    ...createMemoryAdapter({
      snapshots: {
        demo: { tasks: [{ id: taskId }], dailyRecords: {}, drafts: {} },
        alice: { tasks: [{ id: taskId }], dailyRecords: {}, drafts: {} },
      },
    }),
    begin(identity) {
      selected.push(`${name}:${identity.id}`);
    },
  });
  const continuity = createStateContinuity({
    adapters: {
      demo: createAdapter("demo", "demo-task"),
      account: createAdapter("account", "account-task"),
    },
  });

  const demo = continuity.open({ mode: "demo" });
  assert.deepEqual(demo.view(views.today()).data.tasks.map((task) => task.id), ["demo-task"]);

  const account = continuity.open({ id: "alice" });
  assert.deepEqual(account.view(views.today()).data.tasks.map((task) => task.id), ["account-task"]);
  assert.deepEqual(selected, ["demo:demo", "account:alice"]);
});

test("安全 Demo 的偏好确认留在 Demo adapter，不穿透账户远端", async () => {
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  let remoteCalls = 0;
  globalThis.localStorage = createMemoryStorage();
  globalThis.window = {
    setTimeout,
    clearTimeout,
    location: { hostname: "state-continuity.test", protocol: "http:" },
  };
  globalThis.fetch = async () => {
    remoteCalls += 1;
    return new Response(JSON.stringify({ preferences: {} }), { status: 200 });
  };

  try {
    const scope = createStateContinuity().open({ mode: "demo" });
    await scope.change((catalog) => catalog.information.setSourceHidden("demo-source-product", true));

    assert.equal(remoteCalls, 0);
    assert.equal(
      scope.view(views.information()).data.preferences.content.hiddenSources["news:demo-source-product"],
      true,
    );
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
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
          sync: { cursor: "v1.a" },
        },
      },
    }),
  });
  globalThis.localStorage = storage;
  globalThis.window = { setTimeout, clearTimeout, location: { hostname: "state-continuity.test", protocol: "http:" } };
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response(JSON.stringify({
    cursor: "v1.b",
    changes: { tasks: [{ id: "remote", name: "远端任务" }] },
    }), { status: 200 });
  };

  try {
    const scope = createStateContinuity().open({ id: "alice" });
    await scope.control.sync();

    assert.ok(requests.some((url) => url.includes("/api/sync/changes?since=v1.a")));

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

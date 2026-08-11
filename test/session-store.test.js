import assert from "node:assert/strict";
import test from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { createServer } from "vite";

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

test("身份丢失的统一 lifecycle 会阻止迟到 sync 重建私有缓存", async () => {
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const entries = new Map([
    ["lifeflow-private-dashboard-api-base", "http://session.test"],
    ["lifeflow-private-dashboard-vue-dashboard-cache", JSON.stringify({
      version: 3,
      users: { alice: { tasks: [{ id: "cached" }], dailyRecords: {}, sync: { cursor: "" } } },
    })],
  ]);
  globalThis.localStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key),
  };
  globalThis.window = { setTimeout, clearTimeout, location: { hostname: "session.test", protocol: "http:" } };
  const response = deferred();
  globalThis.fetch = () => response.promise;
  const vite = await createServer({ server: { middlewareMode: true, hmr: { port: 24679 } }, appType: "custom" });

  try {
    const { useSessionStore } = await vite.ssrLoadModule("/src/stores/session.js");
    setActivePinia(createPinia());
    const session = useSessionStore();
    session.applySession({ user: { id: "alice", username: "Alice", preferences: {} }, session: { id: "session-a" } });
    await Promise.resolve();
    session.applySession(null, "会话失效");
    response.resolve(new Response(JSON.stringify({
      reset: true,
      cursor: "2026-08-11T00:00:00.000Z",
      snapshot: { tasks: [{ id: "late" }], dailyRecords: [], weeklySummaries: [] },
    }), { status: 200 }));
    await new Promise((resolve) => setImmediate(resolve));

    const cache = JSON.parse(entries.get("lifeflow-private-dashboard-vue-dashboard-cache"));
    assert.equal(session.status, "guest");
    assert.equal(Object.hasOwn(cache.users, "alice"), false);
  } finally {
    await vite.close();
    globalThis.localStorage = previousStorage;
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});

test("401、sign-out-all 与删除账号 caller 都进入统一身份关闭 lifecycle", async () => {
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const entries = new Map([["lifeflow-private-dashboard-api-base", "http://session.test"]]);
  globalThis.localStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key),
  };
  globalThis.window = { setTimeout, clearTimeout, location: { hostname: "session.test", protocol: "http:" } };
  let rejectSession = false;
  let taskWrite = null;
  let deleteCalls = 0;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.endsWith("/api/session") && rejectSession) {
      return new Response(JSON.stringify({ error: "expired" }), { status: 401 });
    }
    if (url.includes("/api/sync/")) {
      return new Response(JSON.stringify({
        reset: true,
        cursor: "2026-08-11T00:00:00.000Z",
        snapshot: { tasks: [], dailyRecords: [], weeklySummaries: [] },
      }), { status: 200 });
    }
    if (url.includes("/api/tasks/") && options.method === "PATCH" && taskWrite) {
      return taskWrite.promise;
    }
    if (url.endsWith("/api/account/delete")) {
      deleteCalls += 1;
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const vite = await createServer({ server: { middlewareMode: true, hmr: { port: 24682 } }, appType: "custom" });

  try {
    const [{ useSessionStore }, { useAccountStore }] = await Promise.all([
      vite.ssrLoadModule("/src/stores/session.js"),
      vite.ssrLoadModule("/src/stores/account.js"),
    ]);
    const { stateContinuity } = await vite.ssrLoadModule("/src/services/state-continuity.js");
    setActivePinia(createPinia());
    const session = useSessionStore();
    const account = useAccountStore();
    const login = () => session.applySession({
      user: { id: "alice", username: "Alice", preferences: {} },
      session: { id: "session-a" },
    });
    const beginLateWrite = async () => {
      await Promise.resolve();
      await Promise.resolve();
      taskWrite = deferred();
      const writing = stateContinuity.open({ id: "alice" }).change((writes) => (
        writes.today.updateTask("task-1", { name: "迟到写入" })
      ));
      await Promise.resolve();
      return { writing };
    };
    const resolveLateWrite = async ({ writing }) => {
      taskWrite.resolve(new Response(JSON.stringify({ task: { id: "task-1", name: "迟到写入" } }), { status: 200 }));
      await writing;
      const cache = JSON.parse(entries.get("lifeflow-private-dashboard-vue-dashboard-cache") || '{"users":{}}');
      assert.equal(Object.hasOwn(cache.users || {}, "alice"), false);
      taskWrite = null;
    };

    login();
    const writeBefore401 = await beginLateWrite();
    rejectSession = true;
    await session.refreshSession();
    assert.equal(session.status, "guest");
    await resolveLateWrite(writeBefore401);

    rejectSession = false;
    login();
    const writeBeforeSignOutAll = await beginLateWrite();
    await account.signOutAllSessions();
    assert.equal(session.status, "guest");
    await resolveLateWrite(writeBeforeSignOutAll);

    login();
    const writeBeforeDelete = await beginLateWrite();
    account.forms.account.deletePassword = "secret123";
    const deleting = account.removeAccount();
    await Promise.resolve();
    const deleteStartedBeforeWriteSettled = deleteCalls > 0;
    taskWrite.resolve(new Response(JSON.stringify({ task: { id: "task-1", name: "写入先完成" } }), { status: 200 }));
    await writeBeforeDelete.writing;
    await deleting;
    taskWrite = null;
    assert.equal(deleteStartedBeforeWriteSettled, false);
    assert.equal(session.status, "guest");
    assert.equal(deleteCalls, 1);
    const cache = JSON.parse(entries.get("lifeflow-private-dashboard-vue-dashboard-cache") || '{"users":{}}');
    assert.equal(Object.hasOwn(cache.users || {}, "alice"), false);
  } finally {
    await vite.close();
    globalThis.localStorage = previousStorage;
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});

test("离线恢复优先使用 dashboard 最近确认偏好而非旧 session 镜像", async () => {
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  const entries = new Map([
    ["lifeflow-private-dashboard-vue-dashboard-cache", JSON.stringify({
      version: 3,
      users: { alice: {
        tasks: [],
        dailyRecords: {},
        preferences: { content: { readItems: { "news:item-1": "2026-08-11T08:00:00.000Z" } } },
      } },
    })],
  ]);
  globalThis.localStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key),
  };
  globalThis.window = { setTimeout, clearTimeout, location: { hostname: "offline.test", protocol: "http:" } };
  const vite = await createServer({ server: { middlewareMode: true, hmr: { port: 24683 } }, appType: "custom" });

  try {
    const { useSessionStore } = await vite.ssrLoadModule("/src/stores/session.js");
    setActivePinia(createPinia());
    const session = useSessionStore();

    session.restoreOfflineSession({ user: { id: "alice", username: "Alice", preferences: { content: { readItems: {} } } } });

    assert.equal(Boolean(session.preferences.content.readItems["news:item-1"]), true);
  } finally {
    await vite.close();
    globalThis.localStorage = previousStorage;
    globalThis.window = previousWindow;
  }
});

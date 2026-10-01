import assert from "node:assert/strict";
import test from "node:test";
import { createStateContinuity, views } from "../src/services/state-continuity.js";
import { createAccountStateAdapter } from "../src/services/state-continuity/account-adapter.js";
import { loadDashboardUserCache } from "../src/services/state-continuity/account-cache.js";
import { commitDashboardSyncResult } from "../src/services/state-continuity/account-sync.js";
import { fetchJson } from "../src/services/api-client.js";
import { resetResolvedApiBase } from "../src/services/config.js";
import { createDemoStateRepository, DEMO_STORAGE_KEY } from "../src/services/demo-state.js";
import { CACHE_KEY, API_KEY, memoryStorage, installBrowser, deferred } from "./helpers/failure-testing.js";

const oldTask = { id: "old", name: "已确认任务" };
const remoteTask = { id: "remote", name: "云端任务 🧪" };
const snapshot = { tasks: [remoteTask], dailyRecords: [], weeklySummaries: [] };

test("F01 缺失、损坏 JSON 与旧版账号缓存可恢复且保留旧版有效草稿", (t) => {
  const storage = installBrowser(t);
  for (const raw of [null, "{broken", "null", JSON.stringify({ version: 999, users: {} })]) {
    if (raw === null) storage.removeItem(CACHE_KEY);
    else storage.setItem(CACHE_KEY, raw);
    assert.deepEqual(loadDashboardUserCache("alice").tasks, []);
  }
  for (const version of [1, 2, 3]) {
    storage.setItem(CACHE_KEY, JSON.stringify({ version, users: { alice: {
      tasks: [oldTask], drafts: { todayNotesByDate: { "2026-10-01": { old: "中文 e\u0301 👨‍👩‍👧‍👦" } } },
    } } }));
    const cache = loadDashboardUserCache("alice");
    assert.deepEqual(cache.tasks, [oldTask]);
    assert.equal(cache.drafts.todayNotesByDate["2026-10-01"].old, "中文 e\u0301 👨‍👩‍👧‍👦");
  }
});

test("F01 同版本但缺失必需集合的 Demo 数据仍可创建任务", () => {
  const storage = memoryStorage({ [DEMO_STORAGE_KEY]: JSON.stringify({ version: 1 }) });
  const repo = createDemoStateRepository({ storage, now: () => new Date("2026-10-01T08:00:00Z") });
  const result = repo.createTask({ name: "不完整数据后的任务" });
  assert.ok(result.tasks.some((task) => task.name === "不完整数据后的任务"));
});

test("F02 localStorage 配额耗尽不应丢弃成功同步的运行时结果", async (t) => {
  const storage = memoryStorage({
    [API_KEY]: "http://audit.invalid",
    [CACHE_KEY]: JSON.stringify({ version: 3, users: { alice: { tasks: [oldTask] } } }),
  });
  const originalSet = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === CACHE_KEY) throw new DOMException("fixture quota exhausted", "QuotaExceededError");
    originalSet(key, value);
  };
  resetResolvedApiBase();
  t.after(() => resetResolvedApiBase());
  installBrowser(t, { storage, fetch: async (input) => {
    assert.equal(new URL(input).origin, "http://audit.invalid");
    return Response.json(String(input).endsWith("/health") ? { ok: true } : { cursor: "v1.2", snapshot });
  } });
  const scope = createStateContinuity({ adapter: createAccountStateAdapter() }).open({ id: "alice" });
  await scope.control.sync();
  const view = scope.view(views.today());
  assert.deepEqual({ taskIds: view.data.tasks.map((task) => task.id), freshness: view.freshness },
    { taskIds: ["remote"], freshness: "confirmed" },
    "远端成功响应不能因 best-effort 缓存写入失败而把旧任务标为 confirmed");
});

test("F03 reset 响应缺失 snapshot 时应拒绝且保留已确认缓存", async (t) => {
  resetResolvedApiBase();
  t.after(() => resetResolvedApiBase());
  const storage = memoryStorage({
    [API_KEY]: "http://audit.invalid",
    [CACHE_KEY]: JSON.stringify({ version: 3, users: { alice: { tasks: [oldTask] } } }),
  });
  installBrowser(t, { storage, fetch: async (input) => {
    assert.equal(new URL(input).origin, "http://audit.invalid");
    return Response.json(String(input).endsWith("/health") ? { ok: true } : { reset: true, cursor: "v1.3" });
  } });
  const scope = createStateContinuity({ adapter: createAccountStateAdapter() }).open({ id: "alice" });
  const error = await scope.control.sync().then(() => null, (reason) => reason);
  assert.deepEqual({
    rejected: Boolean(error),
    taskIds: scope.view(views.today()).data.tasks.map((task) => task.id),
    cachedIds: loadDashboardUserCache("alice").tasks.map((task) => task.id),
  }, { rejected: true, taskIds: ["old"], cachedIds: ["old"] });
});

test("F03 非 JSON 的 200 与 503 均向 caller 报错", async (t) => {
  installBrowser(t, { fetch: async () => new Response("<html>bad gateway</html>", { status: 200 }) });
  await assert.rejects(fetchJson("/fixture", { apiBase: "http://audit.invalid" }),
    (error) => error.status === 200 && error.serverResponse === true);
  globalThis.fetch = async () => new Response("<html>bad gateway</html>", { status: 503 });
  await assert.rejects(fetchJson("/fixture", { apiBase: "http://audit.invalid" }), (error) => error.status === 503);
});

test("F04 请求 timeout 必须覆盖响应头之后的正文读取", async (t) => {
  const body = deferred();
  let requestSignal;
  let timer;
  installBrowser(t, { fetch: async (_url, options) => {
    requestSignal = options.signal;
    requestSignal.addEventListener("abort", () => body.reject(new DOMException("timeout", "AbortError")), { once: true });
    return { ok: true, status: 200, text: () => body.promise };
  } });
  // A controlled clock makes this test independent of CPU speed or wall time.
  window.setTimeout = (callback) => { timer = callback; return 1; };
  window.clearTimeout = () => { timer = null; };
  const result = fetchJson("/fixture", { apiBase: "http://audit.invalid", timeoutMs: 20 })
    .then(() => null, (error) => error);
  await Promise.resolve();
  timer?.();
  const abortedAtDeadline = requestSignal.aborted;
  body.resolve("{}");
  const error = await result;
  assert.deepEqual({ abortedAtDeadline, name: error?.name }, { abortedAtDeadline: true, name: "AbortError" });
});

test("F01 Demo 集合类型损坏可恢复，正常存储的修改不会被重建", () => {
  const storage = memoryStorage();
  const repo = createDemoStateRepository({ storage });
  const initial = repo.load();
  const broken = [
    { ...initial, tasks: null },
    { ...initial, dailyRecords: { "2026-10-01": { payload: null } } },
    { ...initial, content: { ...initial.content, items: [] } },
  ];
  for (const state of broken) {
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    const created = repo.createTask({ name: "恢复后任务" });
    assert.ok(created.tasks.some((task) => task.name === "恢复后任务"));
    assert.deepEqual(repo.load().tasks, created.tasks);
  }
});

test("F03 不完整全量或错误增量集合都保留缓存与游标", (t) => {
  const storage = installBrowser(t);
  commitDashboardSyncResult("alice", { payload: { cursor: "v1.1", snapshot } });
  const before = storage.getItem(CACHE_KEY);
  for (const payload of [
    null, {}, { cursor: "v1.2", reset: true, snapshot: {} },
    { cursor: "v1.2", snapshot: { ...snapshot, weeklySummaries: undefined } },
    { cursor: "v1.2", snapshot: { ...snapshot, tasks: [null] } },
    { cursor: "v1.2", changes: { tasks: {} } },
    { cursor: "v1.2", changes: { content: { items: [null] } } },
  ]) {
    assert.throws(() => commitDashboardSyncResult("alice", { payload }));
    assert.equal(storage.getItem(CACHE_KEY), before);
  }
  const next = commitDashboardSyncResult("alice", { payload: { cursor: "v1.2", changes: {} } });
  assert.deepEqual(next.tasks, snapshot.tasks);
  assert.equal(next.sync.cursor, "v1.2");
});

test("F04 caller 的取消信号与请求超时均有效，完成后清理计时器", async (t) => {
  let timer;
  let requestSignal;
  let body;
  installBrowser(t, { fetch: async (_url, options) => {
    requestSignal = options.signal;
    requestSignal.addEventListener("abort", () => body.reject(new DOMException("aborted", "AbortError")), { once: true });
    return { ok: true, status: 200, text: () => body.promise };
  } });
  window.setTimeout = (callback) => { timer = callback; return 1; };
  window.clearTimeout = () => { timer = null; };
  for (const reason of ["caller", "timeout", "success"]) {
    const caller = new AbortController();
    body = deferred();
    const result = fetchJson("/fixture", { apiBase: "http://audit.invalid", signal: caller.signal })
      .then((value) => value, (error) => error);
    await Promise.resolve();
    if (reason === "caller") caller.abort();
    else if (reason === "timeout") timer();
    else body.resolve('{"ok":true}');
    const value = await result;
    if (reason === "success") assert.deepEqual(value, { ok: true });
    else assert.equal(value.name, "AbortError");
    assert.equal(requestSignal.aborted, reason !== "success");
    assert.equal(timer, null);
  }
});

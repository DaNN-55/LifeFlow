const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createServer } = require("node:http");
const { execFileSync } = require("node:child_process");
const { createApp } = require("../src/app");
const { MemoryStore } = require("../src/store/memoryStore");
const { SupabaseStore } = require("../src/store/supabaseStore");
const { createInformationInput } = require("../src/information-input");
const { createInformationInputPersistence } = require("../src/information-input/persistence");

async function fixture() {
  const store = new MemoryStore();
  await store.createUser({ id: "audit", username: "audit", preferences: {} });
  return { store, scope: { userId: "audit" } };
}

async function httpFixture(t) {
  const { store, scope } = await fixture();
  await store.createSession({ id: "audit-session", user_id: scope.userId, expires_at: new Date(Date.now() + 3600000).toISOString() });
  const input = createInformationInput({
    persistence: createInformationInputPersistence(store),
    collector: { fetchIncrement: async () => { throw new Error("No external collection in audit"); } },
  });
  const server = createServer(createApp({
    store, informationInput: input,
    config: { corsOrigins: [], useSupabase: false, authChallengeProvider: "none" },
  }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  });
  return {
    store, scope,
    request: (path, method = "GET", body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, headers: { "content-type": "application/json", "x-session-id": "audit-session" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  };
}

test("F11 concurrent independent task patches preserve both confirmed fields", async () => {
  const { store, scope } = await fixture();
  await store.createTask(scope, { id: "task", name: "before", color: "blue", display_order: 1 });
  const before = await store.getUserSyncState(scope.userId);
  await Promise.all([
    store.updateTask(scope, "task", { name: "after" }),
    store.updateTask(scope, "task", { color: "red" }),
  ]);
  const [task] = await store.listTasks(scope);
  assert.equal((await store.getUserSyncState(scope.userId)).dataSyncVersion, before.dataSyncVersion + 2);
  assert.deepEqual({ name: task.name, color: task.color }, { name: "after", color: "red" });
});

test("F11 delete followed by a concurrent patch must not resurrect the task", async () => {
  const { store, scope } = await fixture();
  await store.createTask(scope, { id: "task", name: "before", color: "blue", display_order: 1 });
  const before = await store.getUserSyncState(scope.userId);
  const [, updated] = await Promise.all([
    store.deleteTask(scope, "task"),
    store.updateTask(scope, "task", { name: "late update" }),
  ]);
  assert.deepEqual(await store.listTasks(scope), []);
  assert.equal(updated, null);
  assert.equal((await store.getUserSyncState(scope.userId)).dataSyncVersion, before.dataSyncVersion + 1);
});

test("F12 invalid calendar date must be rejected without writing to a different day", async (t) => {
  const { store, scope, request } = await httpFixture(t);
  const response = await request("/api/daily-records/2026-02-30", "PUT", { tasks: {} });
  assert.deepEqual({ status: response.status, records: (await store.listDailyRecords(scope)).length },
    { status: 400, records: 0 });
});

test("F12 date-only record keys survive server timezones west of UTC", () => {
  const modulePath = require.resolve("../src/store/memoryStore");
  const script = `
    const { MemoryStore } = require(${JSON.stringify(modulePath)});
    (async () => {
      const store = new MemoryStore();
      await store.createUser({ id: 'audit', username: 'audit' });
      const record = await store.upsertDailyRecord({ userId: 'audit' }, '2026-10-01', { tasks: {} });
      process.stdout.write(JSON.stringify({ date: record.date }));
    })().catch((error) => { console.error(error); process.exitCode = 1; });
  `;
  const results = Object.fromEntries(["UTC", "Asia/Shanghai", "America/Los_Angeles"].map((timezone) => {
    const output = execFileSync(process.execPath, ["-e", script], {
      env: { ...process.env, TZ: timezone }, encoding: "utf8", timeout: 5000,
    });
    return [timezone, JSON.parse(output).date];
  }));
  assert.deepEqual(results, { UTC: "2026-10-01", "Asia/Shanghai": "2026-10-01", "America/Los_Angeles": "2026-10-01" });
});

test("F13 empty collections and Unicode boundaries round-trip; invalid or overlong input cannot mutate data", async (t) => {
  const { store, scope, request } = await httpFixture(t);
  assert.deepEqual((await (await request("/api/tasks")).json()).tasks, []);
  const name = "中😀e\u0301<&>";
  const created = await request("/api/tasks", "POST", { id: "task", name, color: "#112233", tags: ["中文", "👨‍👩‍👧‍👦"] });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).task.name, name);
  const boundaryName = "😀".repeat(20); // 40 UTF-16 code units, the existing schema's limit.
  assert.equal((await request("/api/tasks/task", "PATCH", { name: boundaryName })).status, 200);
  for (const invalid of ["", "中".repeat(41), "😀".repeat(21), null, []]) {
    assert.equal((await request("/api/tasks/task", "PATCH", { name: invalid })).status, 400);
  }
  assert.equal((await store.listTasks(scope))[0].name, boundaryName);
  const text = "中".repeat(497) + "🧪!";
  const payload = { tasks: { task: { completed: true, notes: [{ id: "note", text, createdAt: "2026-10-01T08:00:00Z" }] } } };
  assert.equal((await request("/api/daily-records/2026-10-01", "PUT", payload)).status, 200);
  payload.tasks.task.notes[0].text += "x";
  assert.equal((await request("/api/daily-records/2026-10-01", "PUT", payload)).status, 400);
  assert.equal((await store.getDailyRecord(scope, "2026-10-01")).payload.tasks.task.notes[0].text, text);
  assert.equal((await request("/api/daily-records/2026-10-01", "PUT", { tasks: {} })).status, 200);
  assert.deepEqual((await store.getDailyRecord(scope, "2026-10-01")).payload.tasks, {});
});

test("F09 history deletion is user-scoped, idempotent, and forces sync reset", async (t) => {
  const { store, scope, request } = await httpFixture(t);
  await store.createUser({ id: "other", username: "other" });
  for (const userId of [scope.userId, "other"]) {
    await store.upsertDailyRecord({ userId }, "2026-10-01", { tasks: {} });
    await store.upsertWeeklySummary({ userId }, "2026-W40", { content: "keep other user" });
  }
  const bootstrap = await (await request("/api/sync/bootstrap")).json();
  for (let repeat = 0; repeat < 2; repeat++) {
    assert.equal((await request("/api/daily-records/2026-10-01", "DELETE")).status, 204);
    assert.equal((await request("/api/weekly-summaries/2026-W40", "DELETE")).status, 204);
  }
  const changes = await (await request(`/api/sync/changes?since=${bootstrap.cursor}`)).json();
  assert.equal(changes.reset, true);
  assert.deepEqual(changes.snapshot.dailyRecords, []);
  assert.deepEqual(changes.snapshot.weeklySummaries, []);
  assert.ok(await store.getDailyRecord({ userId: "other" }, "2026-10-01"));
  assert.ok(await store.getWeeklySummary({ userId: "other" }, "2026-W40"));
});

test("F12 read/write/delete reject invalid dates; leap-day round-trip and range keep exact keys", async (t) => {
  const { store, scope, request } = await httpFixture(t);
  const before = await store.getUserSyncState(scope.userId);
  for (const method of ["GET", "PUT", "DELETE"]) {
    for (const date of ["2026-02-29", "2026-13-01", "2026-2-01"]) {
      assert.equal((await request(`/api/daily-records/${date}`, method, method === "PUT" ? { tasks: {} } : undefined)).status, 400);
    }
  }
  assert.deepEqual(await store.getUserSyncState(scope.userId), before);
  assert.equal((await request("/api/daily-records/2024-02-29", "PUT", { tasks: {} })).status, 200);
  const response = await (await request("/api/daily-records/2024-02-29")).json();
  assert.equal(response.record.date, "2024-02-29");
  assert.deepEqual((await store.listDailyRecordsBetween(scope, "2024-02-29", "2024-02-29")).map((record) => record.date), ["2024-02-29"]);
});

test("F09 Supabase history deletion retains ownership filters and surfaces database errors", async () => {
  const store = new SupabaseStore({ supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "fixture" });
  const calls = [];
  let error = null;
  store.client = { from(table) {
    const call = { table, deleted: false, filters: [] };
    calls.push(call);
    return {
      delete() { call.deleted = true; return this; },
      eq(key, value) { call.filters.push([key, value]); return this; },
      then(resolve) { return Promise.resolve({ error }).then(resolve); },
    };
  } };
  await store.deleteDailyRecord({ userId: "alice" }, "2024-02-29");
  await store.deleteWeeklySummary({ userId: "alice" }, "2024-W09");
  assert.deepEqual(calls, [
    { table: "daily_records", deleted: true, filters: [["user_id", "alice"], ["record_date", "2024-02-29"]] },
    { table: "weekly_summaries", deleted: true, filters: [["user_id", "alice"], ["week_key", "2024-W09"]] },
  ]);
  for (const method of ["getDailyRecord", "upsertDailyRecord", "deleteDailyRecord"]) {
    await assert.rejects(store[method]({ userId: "alice" }, "2026-02-30", { tasks: {} }), /Invalid calendar date/);
  }
  assert.equal(calls.length, 2, "invalid dates must not reach SQL queries");
  error = new Error("fixture SQL failure");
  await assert.rejects(store.deleteDailyRecord({ userId: "alice" }, "2024-02-29"), /fixture SQL failure/);
  await assert.rejects(store.deleteWeeklySummary({ userId: "alice" }, "2024-W09"), /fixture SQL failure/);
});

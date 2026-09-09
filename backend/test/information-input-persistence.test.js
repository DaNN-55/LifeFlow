const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createInformationInputPersistence } = require("../src/information-input/persistence");
const { MemoryStore } = require("../src/store/memoryStore");
const { SupabaseStore, applySyncVersionRange } = require("../src/store/supabaseStore");

async function makeUser(store) {
  const user = await store.createUser({
    id: "persistence-contract-user", email: "persistence@example.com", password_hash: "hash", display_name: "Persistence",
  });
  return { userId: user.id };
}

async function exercisePersistenceContract(store, userId) {
  const persistence = createInformationInputPersistence(store);
  const userContext = await makeUser(store);
  userContext.userId = userId;
  await persistence.createSource(userContext, { id: "source", channel: "news", type: "rss", name: "Source", url: "https://example.com/feed", enabled: true, sort_order: 1 });
  await persistence.updateSource(userContext, "source", { name: "Updated" });
  const before = await store.getUserSyncState(userId);
  await persistence.confirmRefresh(userContext, { channel: "news", cutoffIso: "2026-09-02T00:00:00.000Z", results: [{ ok: true, source: await persistence.getSource(userContext, "source"), syncedAt: "2026-09-09T10:00:00.000Z", latestPublishedAt: "2026-09-09T09:00:00.000Z", items: [{ id: "item", channel: "news", source_id: "source", canonical_url: "https://example.com/item", title: "Item", published_at: "2026-09-09T09:00:00.000Z", fetched_at: "2026-09-09T10:00:00.000Z", tags: [] }] }] });
  const upper = await store.getUserSyncState(userId);
  assert.equal((await persistence.syncProjection(userContext, { since: before.dataSyncVersion, upperVersion: upper.dataSyncVersion })).items.length, 1);
  await persistence.deleteSource(userContext, "source");
  assert.ok((await store.getUserSyncState(userId)).dataResetVersion > upper.dataSyncVersion);
}

test("Memory persistence satisfies source-refresh-range-reset contract", async () => {
  await exercisePersistenceContract(new MemoryStore({ now: () => "2026-09-09T10:00:00.000Z" }), "persistence-contract-user");
});

test("information input persistence confirms a refresh before it advances its projection", async () => {
  const store = new MemoryStore({ now: () => "2026-09-09T10:00:00.000Z" });
  const persistence = createInformationInputPersistence(store);
  const userContext = await makeUser(store);

  await persistence.createSource(userContext, {
    id: "source-1", channel: "news", type: "rss", name: "Example", url: "https://example.com/feed.xml", enabled: true, sort_order: 1,
  });
  const afterCreate = await store.getUserSyncState(userContext.userId);
  await persistence.updateSource(userContext, "source-1", { name: "Renamed" });
  const afterUpdate = await store.getUserSyncState(userContext.userId);
  assert.ok(afterUpdate.dataSyncVersion > afterCreate.dataSyncVersion, "same-millisecond writes retain their order");
  assert.equal((await persistence.getSource(userContext, "source-1")).name, "Renamed");

  const cursorBeforeConcurrentWrites = afterUpdate.dataSyncVersion;
  const [firstTask, secondTask] = await Promise.all([
    store.createTask(userContext, { id: "task-1", name: "First", color: "blue", display_order: 1 }),
    store.createTask(userContext, { id: "task-2", name: "Second", color: "blue", display_order: 2 }),
  ]);
  assert.deepEqual(
    [firstTask.sync_version, secondTask.sync_version].sort((left, right) => left - right),
    [cursorBeforeConcurrentWrites + 1, cursorBeforeConcurrentWrites + 2],
    "concurrent confirmation assigns unique, strictly increasing versions",
  );
  const upperAfterConcurrentWrites = (await store.getUserSyncState(userContext.userId)).dataSyncVersion;
  assert.deepEqual(
    (await store.listTasksUpdatedSince(userContext, cursorBeforeConcurrentWrites, upperAfterConcurrentWrites))
      .map((task) => task.id).sort(),
    ["task-1", "task-2"],
    "a client holding the preceding cursor does not miss either later confirmation",
  );

  const before = await store.getUserSyncState(userContext.userId);
  await persistence.confirmRefresh(userContext, {
    channel: "news",
    cutoffIso: "2026-09-02T10:00:00.000Z",
    results: [{
      ok: true,
      source: await persistence.getSource(userContext, "source-1"),
      syncedAt: "2026-09-09T10:00:00.000Z",
      latestPublishedAt: "2026-09-09T09:00:00.000Z",
      items: [{ id: "item-1", channel: "news", source_id: "source-1", canonical_url: "https://example.com/post", title: "Post", published_at: "2026-09-09T09:00:00.000Z", fetched_at: "2026-09-09T10:00:00.000Z", tags: [] }],
    }],
  });
  const confirmed = await store.getUserSyncState(userContext.userId);
  assert.ok(confirmed.dataSyncVersion > before.dataSyncVersion);
  const projection = await persistence.syncProjection(userContext, { since: before.dataSyncVersion, upperVersion: confirmed.dataSyncVersion });
  assert.equal(projection.items.length, 1);
  assert.equal(projection.sources.length, 1);

  await persistence.deleteSource(userContext, "source-1");
  const reset = await store.getUserSyncState(userContext.userId);
  assert.ok(reset.dataResetVersion > confirmed.dataSyncVersion, "source deletion requires a reset snapshot");
});

test("Memory facts stay invisible until their queued confirmation, including reset deletes", async () => {
  const store = new MemoryStore({ now: () => "2026-09-09T10:00:00.000Z" });
  const userContext = await makeUser(store);
  const originalAdvance = store.advanceUserSyncState.bind(store);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  store.advanceUserSyncState = async (...args) => { await gate; return originalAdvance(...args); };

  const pendingDaily = store.upsertDailyRecord(userContext, "2026-09-09", { tasks: {} });
  await Promise.resolve();
  assert.equal((await store.listDailyRecords(userContext, { upperVersion: 0 })).length, 0);
  release();
  await pendingDaily;

  const writes = await Promise.all([
    store.upsertWeeklySummary(userContext, "2026-W37", { content: "weekly" }),
    store.createContentSource(userContext, { id: "source", channel: "news", type: "rss", name: "Source", url: "https://example.com/feed" }),
    store.upsertFavoriteContent(userContext, { id: "favorite", channel: "news", canonical_url: "https://example.com/item", title: "Item" }),
  ]);
  assert.equal(new Set(writes.map((fact) => fact.sync_version)).size, 3);

  const beforeDelete = await store.getUserSyncState(userContext.userId);
  let releaseDelete;
  const deleteGate = new Promise((resolve) => { releaseDelete = resolve; });
  store.advanceUserSyncState = async (...args) => { await deleteGate; return originalAdvance(...args); };
  const pendingDelete = store.deleteFavoriteContent(userContext, "news", "https://example.com/item");
  await Promise.resolve();
  assert.equal((await store.listFavoriteContentUpdatedSince(userContext, null)).length, 1, "delete is not visible before reset confirmation");
  releaseDelete();
  await pendingDelete;
  assert.ok((await store.getUserSyncState(userContext.userId)).dataResetVersion > beforeDelete.dataSyncVersion);
});

test("Memory clear waits for reset confirmation and drains prior queued writes", async () => {
  const store = new MemoryStore({ now: () => "2026-09-09T10:00:00.000Z" });
  const userContext = await makeUser(store);
  await store.createTask(userContext, { id: "confirmed", name: "Confirmed", color: "blue", display_order: 1 });
  const beforeClear = await store.getUserSyncState(userContext.userId);
  const originalAdvance = store.advanceUserSyncState.bind(store);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  store.advanceUserSyncState = async (...args) => { await gate; return originalAdvance(...args); };
  const pendingClear = store.clearUserData(userContext.userId);
  await Promise.resolve();
  assert.equal((await store.listTasks(userContext, { upperVersion: beforeClear.dataSyncVersion })).length, 1);
  release();
  await pendingClear;
  const afterClear = await store.getUserSyncState(userContext.userId);
  assert.ok(afterClear.dataResetVersion > beforeClear.dataSyncVersion);
  assert.equal((await store.listTasks(userContext, { upperVersion: afterClear.dataSyncVersion })).length, 0);

  let releaseWrite;
  const writeGate = new Promise((resolve) => { releaseWrite = resolve; });
  store.advanceUserSyncState = async (...args) => { await writeGate; return originalAdvance(...args); };
  const queuedWrite = store.createTask(userContext, { id: "late", name: "Late", color: "blue", display_order: 2 });
  const queuedClear = store.clearUserData(userContext.userId);
  releaseWrite();
  await Promise.all([queuedWrite, queuedClear]);
  assert.equal((await store.listTasks(userContext)).length, 0, "clear acts on the current scope after queued writes");
});

test("Memory queued write after clear remains visible beyond the reset cursor", async () => {
  const store = new MemoryStore();
  const userContext = await makeUser(store);
  const clear = store.clearUserData(userContext.userId);
  const write = store.createTask(userContext, { id: "after-clear", name: "After", color: "blue", display_order: 1 });
  const [, task] = await Promise.all([clear, write]);
  const state = await store.getUserSyncState(userContext.userId);
  assert.ok(task.sync_version > state.dataResetVersion);
  assert.deepEqual((await store.listTasks(userContext)).map((item) => item.id), ["after-clear"]);
});

test("Memory projection uses id tie-breakers for equal source and item timestamps", async () => {
  const store = new MemoryStore({ now: () => "2026-09-09T10:00:00.000Z" });
  const userContext = await makeUser(store);
  await store.createContentSource(userContext, { id: "b", channel: "news", type: "rss", name: "Same", url: "https://example.com/b", sort_order: 1 });
  await store.createContentSource(userContext, { id: "a", channel: "news", type: "rss", name: "Same", url: "https://example.com/a", sort_order: 1 });
  await store.upsertContentItems(userContext, [
    { id: "b", channel: "news", source_id: "a", canonical_url: "https://example.com/b", title: "B", updated_at: "2026-09-09T10:00:00.000Z" },
    { id: "a", channel: "news", source_id: "a", canonical_url: "https://example.com/a", title: "A", updated_at: "2026-09-09T10:00:00.000Z" },
  ]);
  assert.deepEqual((await store.listContentSources(userContext)).map((source) => source.id), ["a", "b"]);
  assert.deepEqual((await store.listContentUpdatedSince(userContext, null)).map((item) => item.id), ["a", "b"]);
});

test("Supabase query double applies the version interval and leaves version assignment to the database trigger", async () => {
  const calls = [];
  const query = {
    gt(field, value) { calls.push(["gt", field, value]); return this; },
    lte(field, value) { calls.push(["lte", field, value]); return this; },
  };
  assert.equal(applySyncVersionRange(query, 11, 19), query);
  assert.deepEqual(calls, [["gt", "sync_version", 11], ["lte", "sync_version", 19]]);

  let insertPayload;
  const writeQuery = {
    insert(payload) { insertPayload = payload; return this; },
    select() { return this; },
    single() { return Promise.resolve({ data: { id: "task-1" }, error: null }); },
  };
  const store = new SupabaseStore({ supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "test-service-role-key" });
  store.client = { from() { return writeQuery; } };
  await store.createTask({ userId: "user-1" }, { id: "task-1", name: "Task", color: "blue", display_order: 1 });
  assert.equal(insertPayload.user_id, "user-1");
  assert.equal(Object.hasOwn(insertPayload, "sync_version"), false);
});

test("Supabase migration keeps database-owned cursor assignment explicit", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/2026-09-09-add-opaque-sync-cursors.sql"), "utf8");
  const schema = fs.readFileSync(path.join(__dirname, "../supabase/schema.sql"), "utf8");
  for (const table of ["tasks", "daily_records", "weekly_summaries", "content_sources", "content_items", "content_favorites"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} add column if not exists sync_version bigint`));
    assert.match(migration, new RegExp(`create trigger ${table}_assign_lifeflow_sync_version`));
    assert.match(schema, new RegExp(`create trigger ${table}_assign_lifeflow_sync_version`));
  }
  assert.match(migration, /data_sync_version = data_sync_version \+ 1/);
  assert.match(migration, /when tg_op = 'DELETE' then data_sync_version \+ 1/);
  assert.match(migration, /function public\.assign_lifeflow_sync_version\(\)[\s\S]*?set search_path = public/);
  assert.match(schema, /function public\.assign_lifeflow_sync_version\(\)[\s\S]*?set search_path = public/);
  for (const sql of [migration, schema]) {
    assert.match(sql, /create or replace function public\.clear_lifeflow_user_data\(target_user_id text\)/);
    assert.match(sql, /security invoker/);
    assert.match(sql, /revoke all on function public\.clear_lifeflow_user_data\(text\) from authenticated/);
    assert.match(sql, /grant execute on function public\.clear_lifeflow_user_data\(text\) to service_role/);
    assert.match(sql, /revoke all on function public\.read_lifeflow_sync_projection\(text,bigint\) from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.read_lifeflow_sync_projection\(text,bigint\) to service_role/);
    assert.match(sql, /lifeflow_sync_payload\(target_user_id,-1,upper\)/);
    assert.match(sql, /lifeflow_sync_payload\(target_user_id,coalesce\(since_version,0\),upper\)/);
    assert.match(sql, /sync_version>lower_version and x\.sync_version<=upper_version/);
    assert.match(sql, /order by x\.display_order,x\.id/);
    assert.match(sql, /order by x\.sort_order,x\.name,x\.id/);
    assert.match(sql, /data_reset_version = data_sync_version \+ 1/);
  }
  assert.equal((schema.match(/create or replace function public\.read_lifeflow_sync_projection/g) || []).length, 1);
  assert.equal((migration.match(/create or replace function public\.read_lifeflow_sync_projection/g) || []).length, 1);
});

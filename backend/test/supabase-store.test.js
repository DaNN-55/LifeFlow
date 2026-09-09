const test = require("node:test");
const assert = require("node:assert/strict");

const { SupabaseStore, buildTableAvailabilityError } = require("../src/store/supabaseStore");

test("reports missing table as migration issue", () => {
  const error = buildTableAvailabilityError("content_items", {
    code: "42P01",
    message: 'relation "public.content_items" does not exist',
  });

  assert.equal(error.message, "Supabase 表 content_items 不可用，请先执行最新 migration");
});

test("reports auth failures with key guidance", () => {
  const error = buildTableAvailabilityError("content_items", {
    status: 401,
    message: "Invalid API key",
  });

  assert.equal(
    error.message,
    "Supabase 表 content_items 检查失败，请确认 SUPABASE_SERVICE_ROLE_KEY 正确且具备访问权限"
  );
});

test("reports connectivity failures with network guidance", () => {
  const error = buildTableAvailabilityError("content_items", {
    message: "TypeError: fetch failed",
    details:
      "TypeError: fetch failed\nCaused by: Error: Client network socket disconnected before secure TLS connection was established (ECONNRESET)",
  });

  assert.equal(
    error.message,
    "Supabase 表 content_items 检查失败，当前无法连接到 Supabase，请确认 SUPABASE_URL、网络和目标服务状态"
  );
});

test("init rejects an old schema before the first sync query", async () => {
  const store = new SupabaseStore({ supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "test-service-role-key" });
  store.client = {
    from(table) {
      return {
        select(columns) {
          return {
            limit() {
              if (table === "users" && columns.includes("data_sync_version")) {
                return Promise.resolve({ error: { message: "column users.data_sync_version does not exist" } });
              }
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  await assert.rejects(
    store.init(),
    /Supabase 表 users 缺少同步版本字段，请先执行 2026-09-09-add-opaque-sync-cursors\.sql/,
  );
});

test("clearUserData delegates to the transactional Supabase RPC and surfaces its error", async () => {
  const store = new SupabaseStore({ supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "test-service-role-key" });
  let received;
  store.client = { rpc(name, args) { received = { name, args }; return Promise.resolve({ error: null }); } };
  await store.clearUserData("user-1");
  assert.deepEqual(received, { name: "clear_lifeflow_user_data", args: { target_user_id: "user-1" } });

  store.client = { rpc() { return Promise.resolve({ error: new Error("RPC unavailable") }); } };
  await assert.rejects(store.clearUserData("user-1"), /RPC unavailable/);
});

test("readStateContinuityProjection maps full and incremental RPC payloads", async () => {
  const store = new SupabaseStore({ supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "test-service-role-key" });
  const payload = { data_sync_version: 4, data_reset_version: 2, snapshot: { tasks: [{ id: "task" }], dailyRecords: [], weeklySummaries: [], content: { sources: [], items: [], favorites: [] } }, changes: { tasks: [], dailyRecords: [], weeklySummaries: [], content: { sources: [], items: [], favorites: [] } } };
  const calls = [];
  store.client = { rpc(name, args) { calls.push({ name, args }); return Promise.resolve({ data: payload, error: null }); } };
  assert.equal((await store.readStateContinuityProjection("user-1")).snapshot.tasks[0].id, "task");
  assert.equal((await store.readStateContinuityProjection("user-1", { since: 3 })).upperVersion, 4);
  assert.deepEqual(calls, [
    { name: "read_lifeflow_sync_projection", args: { target_user_id: "user-1", since_version: null } },
    { name: "read_lifeflow_sync_projection", args: { target_user_id: "user-1", since_version: 3 } },
  ]);
  store.client = { rpc() { return Promise.resolve({ error: new Error("read failed") }); } };
  await assert.rejects(store.readStateContinuityProjection("user-1"), /read failed/);
});

test("incremental Supabase queries preserve the shared ordering contract", async () => {
  const store = new SupabaseStore({ supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "test-service-role-key" });
  const orders = {};
  store.client = { from(table) {
    const query = {
      select() { return this; }, eq() { return this; }, gt() { return this; }, lte() { return this; },
      order(field, options) { (orders[table] ||= []).push([field, options.ascending]); return this; },
      then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
    };
    return query;
  } };
  await Promise.all([
    store.listContentSourcesUpdatedSince({ userId: "u" }, 1, 2),
    store.listContentUpdatedSince({ userId: "u" }, 1, "", 2),
    store.listFavoriteContentUpdatedSince({ userId: "u" }, 1, "", 2),
  ]);
  assert.deepEqual(orders.content_sources, [["sort_order", true], ["name", true], ["id", true]]);
  assert.deepEqual(orders.content_items, [["updated_at", false], ["id", true]]);
  assert.deepEqual(orders.content_favorites, [["updated_at", false], ["id", true]]);
});

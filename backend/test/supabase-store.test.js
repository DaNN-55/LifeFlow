const test = require("node:test");
const assert = require("node:assert/strict");

const { buildTableAvailabilityError } = require("../src/store/supabaseStore");

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

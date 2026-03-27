const test = require("node:test");
const assert = require("node:assert/strict");
const { MemoryStore } = require("../src/store/memoryStore");

test("memory store can update recovery code and clear user data", async () => {
  const store = new MemoryStore();
  const user = await store.createUser({
    id: "user-1",
    username: "tester",
    password_hash: "hash-1",
    recovery_code_hash: "recovery-1",
    preferences: {},
  });

  await store.createTask({ userId: user.id }, { id: "task-1", name: "Task 1", color: "#000", display_order: 1 });
  await store.upsertDailyRecord({ userId: user.id }, "2026-03-14", {
    tasks: {
      "task-1": { completed: true, notes: [{ id: "n1", text: "done", createdAt: "2026-03-14T00:00:00.000Z" }] },
    },
  });
  await store.upsertWeeklySummary({ userId: user.id }, "2026-W11", { content: "summary" });

  const updated = await store.updateUserRecoveryCode(user.id, "recovery-2");
  assert.equal(updated.recovery_code_hash, "recovery-2");

  await store.clearUserData(user.id);
  const profile = await store.getAccountProfile(user.id);
  assert.deepEqual(profile.counts, {
    tasks: 0,
    dailyRecords: 0,
    weeklySummaries: 0,
  });
});

test("memory store can rename user and delete all sessions for that user", async () => {
  const store = new MemoryStore();
  const user = await store.createUser({
    id: "user-2",
    username: "old-name",
    password_hash: "hash-2",
    recovery_code_hash: "recovery-2",
    preferences: {},
  });
  const otherUser = await store.createUser({
    id: "user-3",
    username: "other-name",
    password_hash: "hash-3",
    recovery_code_hash: "recovery-3",
    preferences: {},
  });

  await store.createSession({ id: "session-a", user_id: user.id, expires_at: "2099-01-01T00:00:00.000Z" });
  await store.createSession({ id: "session-b", user_id: user.id, expires_at: "2099-01-02T00:00:00.000Z" });
  await store.createSession({ id: "session-c", user_id: otherUser.id, expires_at: "2099-01-03T00:00:00.000Z" });

  const renamed = await store.updateUserUsername(user.id, "new-name");
  assert.equal(renamed.username, "new-name");
  assert.equal(await store.findUserByUsername("old-name"), null);
  assert.equal((await store.findUserByUsername("new-name"))?.id, user.id);

  await store.deleteSessionsByUser(user.id);
  assert.equal(await store.getSessionWithUser("session-a"), null);
  assert.equal(await store.getSessionWithUser("session-b"), null);
  assert.equal((await store.getSessionWithUser("session-c"))?.user?.id, otherUser.id);
});

test("memory store dedupes content sources by source identity", async () => {
  const store = new MemoryStore();
  const user = await store.createUser({
    id: "user-4",
    username: "content-user",
    password_hash: "hash-4",
    recovery_code_hash: "recovery-4",
    preferences: {},
  });

  const first = await store.createContentSource({ userId: user.id }, {
    id: "source-1",
    channel: "news",
    type: "rsshub",
    name: "AI Papers",
    url: "/papers/category/arxiv/cs.AI",
    parser_key: "",
    enabled: true,
    sort_order: 1,
  });
  const second = await store.createContentSource({ userId: user.id }, {
    id: "source-2",
    channel: "news",
    type: "rsshub",
    name: "AI Papers Duplicate",
    url: "/papers/category/arxiv/cs.AI",
    parser_key: "",
    enabled: true,
    sort_order: 2,
  });

  const sources = await store.listContentSources({ userId: user.id }, "news");
  assert.equal(first.id, "source-1");
  assert.equal(second.id, "source-1");
  assert.equal(sources.length, 1);
});

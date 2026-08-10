const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { once } = require("node:events");

const { createApp } = require("../src/app");
const { MemoryStore } = require("../src/store/memoryStore");

function createTestConfig() {
  return {
    corsOrigins: [],
    useSupabase: false,
    authChallengeProvider: "none",
    turnstileSiteKey: "",
    turnstileSecretKey: "",
  };
}

test("sync endpoints return bootstrap, incremental changes, and reset snapshots", async () => {
  const store = new MemoryStore();
  const user = await store.createUser({
    id: "user-sync-1",
    username: "sync-user",
    password_hash: "hash-1",
    recovery_code_hash: "recovery-1",
    preferences: {},
    created_at: "2026-03-01T00:00:00.000Z",
  });
  await store.createSession({
    id: "session-sync-1",
    user_id: user.id,
    expires_at: "2099-01-01T00:00:00.000Z",
  });
  await store.createTask(
    { userId: user.id },
    { id: "task-1", name: "Task 1", color: "#000", display_order: 1 },
  );
  await store.upsertDailyRecord({ userId: user.id }, "2026-03-20", {
    tasks: {
      "task-1": {
        completed: true,
        notes: [{ id: "note-1", text: "first", createdAt: "2026-03-20T08:00:00.000Z" }],
      },
    },
  });
  await store.upsertWeeklySummary({ userId: user.id }, "2026-W12", { content: "initial summary" });

  const app = createApp({
    config: createTestConfig(),
    store,
  });
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const headers = {
    "x-session-id": "session-sync-1",
  };

  try {
    const bootstrapResponse = await fetch(`${baseUrl}/api/sync/bootstrap`, { headers });
    assert.equal(bootstrapResponse.status, 200);
    const bootstrap = await bootstrapResponse.json();
    assert.equal(Array.isArray(bootstrap.snapshot.tasks), true);
    assert.equal(bootstrap.snapshot.tasks.length, 1);
    assert.equal(bootstrap.snapshot.dailyRecords.length, 1);
    assert.equal(bootstrap.snapshot.weeklySummaries.length, 1);
    assert.ok(bootstrap.cursor);

    await store.upsertDailyRecord({ userId: user.id }, "2026-03-21", {
      tasks: {
        "task-1": {
          completed: false,
          notes: [{ id: "note-2", text: "delta", createdAt: "2026-03-21T09:00:00.000Z" }],
        },
      },
    });

    const changesResponse = await fetch(
      `${baseUrl}/api/sync/changes?since=${encodeURIComponent(bootstrap.cursor)}`,
      { headers },
    );
    assert.equal(changesResponse.status, 200);
    const changes = await changesResponse.json();
    assert.equal(changes.reset, false);
    assert.equal(Array.isArray(changes.changes.tasks), true);
    assert.equal(changes.changes.dailyRecords.length, 1);
    assert.equal(changes.changes.dailyRecords[0].date, "2026-03-21");

    await store.deleteTask({ userId: user.id }, "task-1");

    const resetResponse = await fetch(
      `${baseUrl}/api/sync/changes?since=${encodeURIComponent(changes.cursor)}`,
      { headers },
    );
    assert.equal(resetResponse.status, 200);
    const resetPayload = await resetResponse.json();
    assert.equal(resetPayload.reset, true);
    assert.equal(Array.isArray(resetPayload.snapshot.tasks), true);
    assert.equal(resetPayload.snapshot.tasks.length, 0);
  } finally {
    server.close();
    await once(server, "close");
  }
});

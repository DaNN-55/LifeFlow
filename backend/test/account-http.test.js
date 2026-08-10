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

async function startTestServer() {
  const app = createApp({
    config: createTestConfig(),
    store: new MemoryStore(),
  });
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

async function stopTestServer(server) {
  server.close();
  await once(server, "close");
}

async function signup(baseUrl, username) {
  const response = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password: "secret123" }),
  });
  const payload = await response.json();
  assert.equal(response.status, 201);
  return payload;
}

test("a registered user can read and end the current session", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const account = await signup(baseUrl, "session-user");
    const sessionHeaders = { "x-session-id": account.session.id };

    const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: sessionHeaders,
    });
    const mePayload = await meResponse.json();

    assert.equal(meResponse.status, 200);
    assert.equal(mePayload.user.id, account.user.id);
    assert.equal(mePayload.user.username, "session-user");
    assert.equal(mePayload.session.id, account.session.id);

    const signoutResponse = await fetch(`${baseUrl}/api/auth/signout`, {
      method: "POST",
      headers: sessionHeaders,
    });
    assert.equal(signoutResponse.status, 204);

    const signedOutMeResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: sessionHeaders,
    });
    assert.equal(signedOutMeResponse.status, 401);
    assert.deepEqual(await signedOutMeResponse.json(), {
      error: "Authentication required",
    });
  } finally {
    await stopTestServer(server);
  }
});

test("task endpoints isolate records between authenticated users", async () => {
  const { server, baseUrl } = await startTestServer();

  try {
    const firstAccount = await signup(baseUrl, "task-user-a");
    const secondAccount = await signup(baseUrl, "task-user-b");
    const firstHeaders = {
      "content-type": "application/json",
      "x-session-id": firstAccount.session.id,
    };
    const secondHeaders = {
      "content-type": "application/json",
      "x-session-id": secondAccount.session.id,
    };

    const createResponse = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: firstHeaders,
      body: JSON.stringify({ name: "First user's task", color: "#112233" }),
    });
    const createdTask = (await createResponse.json()).task;
    assert.equal(createResponse.status, 201);

    const [firstListResponse, secondListResponse] = await Promise.all([
      fetch(`${baseUrl}/api/tasks`, { headers: firstHeaders }),
      fetch(`${baseUrl}/api/tasks`, { headers: secondHeaders }),
    ]);
    const [firstList, secondList] = await Promise.all([
      firstListResponse.json(),
      secondListResponse.json(),
    ]);

    assert.equal(firstListResponse.status, 200);
    assert.deepEqual(firstList.tasks.map((task) => task.id), [createdTask.id]);
    assert.equal(secondListResponse.status, 200);
    assert.deepEqual(secondList.tasks, []);

    const crossAccountUpdate = await fetch(`${baseUrl}/api/tasks/${createdTask.id}`, {
      method: "PATCH",
      headers: secondHeaders,
      body: JSON.stringify({ name: "Changed by another user" }),
    });
    assert.equal(crossAccountUpdate.status, 404);

    const ownerListResponse = await fetch(`${baseUrl}/api/tasks`, {
      headers: firstHeaders,
    });
    const ownerList = await ownerListResponse.json();
    assert.equal(ownerList.tasks[0].name, "First user's task");
  } finally {
    await stopTestServer(server);
  }
});

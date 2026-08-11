const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { once } = require("node:events");

const { createApp } = require("../src/app");
const { createInformationInput } = require("../src/information-input");
const { createMemoryContentCollector } = require("../src/information-input/memoryCollector");
const { createInformationInputPersistence } = require("../src/information-input/persistence");
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

test("information input validates source invariants outside HTTP", async () => {
  const store = new MemoryStore();
  const informationInput = createInformationInput({
    persistence: createInformationInputPersistence(store),
    collector: createMemoryContentCollector(),
  });

  await assert.rejects(
    () => informationInput.createSource({ userId: "source-validation-user" }, {
      channel: "news",
      type: "rsshub",
      name: "Invalid RSSHub",
      url: "not-a-route",
      parserKey: "not-a-url",
    }),
    (error) => error.issues?.some((issue) => issue.message === "RSSHub 路由需填写完整 URL，或以 / 开头的 route") &&
      error.issues?.some((issue) => issue.message === "RSSHub 实例地址需为有效的 http(s) URL"),
  );

  const source = await informationInput.createSource({ userId: "source-validation-user" }, {
    channel: "news",
    type: "rss",
    name: "Example",
    url: "https://example.com/feed.xml",
  });
  assert.equal(source.enabled, true);

  const updated = await informationInput.updateSource(
    { userId: "source-validation-user" },
    source.id,
    { name: "Renamed" },
  );
  assert.equal(updated.name, "Renamed");

  const rsshubSource = await informationInput.createSource({ userId: "source-validation-user" }, {
    channel: "news",
    type: "rsshub",
    name: "RSSHub Example",
    url: "/old-route",
    parserKey: "https://rsshub.example.com",
  });
  const updatedRsshubSource = await informationInput.updateSource(
    { userId: "source-validation-user" },
    rsshubSource.id,
    { url: "/new-route" },
  );
  assert.equal(updatedRsshubSource.url, "/new-route");
});

test("information input routes retain authentication and response mappings", async () => {
  const store = new MemoryStore();
  const informationInput = createInformationInput({
    persistence: createInformationInputPersistence(store),
    collector: createMemoryContentCollector(),
  });
  const user = await store.createUser({
    id: "information-input-user",
    username: "information-input-user",
    password_hash: "hash",
    recovery_code_hash: "recovery",
    preferences: {},
  });
  await store.createSession({
    id: "information-input-session",
    user_id: user.id,
    expires_at: "2099-01-01T00:00:00.000Z",
  });

  const server = createServer(createApp({ config: createTestConfig(), store, informationInput }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    "content-type": "application/json",
    "x-session-id": "information-input-session",
  };

  try {
    const unauthenticated = await fetch(`${baseUrl}/api/content?channel=news`);
    assert.equal(unauthenticated.status, 401);
    assert.deepEqual(await unauthenticated.json(), { error: "Authentication required" });

    const invalidSourceResponse = await fetch(`${baseUrl}/api/content-sources`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        channel: "news",
        type: "rsshub",
        name: "Invalid RSSHub",
        url: "not-a-route",
        parserKey: "not-a-url",
      }),
    });
    assert.equal(invalidSourceResponse.status, 400);
    assert.deepEqual((await invalidSourceResponse.json()).details.fieldErrors.url, [
      "RSSHub 路由需填写完整 URL，或以 / 开头的 route",
    ]);

    const sourceResponse = await fetch(`${baseUrl}/api/content-sources`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        channel: "news",
        type: "rss",
        name: "Example",
        url: "https://example.com/feed.xml",
      }),
    });
    assert.equal(sourceResponse.status, 201);
    const sourcePayload = await sourceResponse.json();
    assert.equal(sourcePayload.source.name, "Example");
    assert.equal(sourcePayload.source.sort_order, 1);

    const updateResponse = await fetch(`${baseUrl}/api/content-sources/${sourcePayload.source.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: "Renamed" }),
    });
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).source.name, "Renamed");

    const invalidUpdateResponse = await fetch(`${baseUrl}/api/content-sources/${sourcePayload.source.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ url: "not-a-url" }),
    });
    assert.equal(invalidUpdateResponse.status, 400);
    assert.deepEqual((await invalidUpdateResponse.json()).details.fieldErrors.url, [
      "请输入有效的 http(s) URL",
    ]);

    const favoriteResponse = await fetch(`${baseUrl}/api/content/favorites`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "favorite-1",
        channel: "news",
        title: "Favorite",
        canonical_url: "https://example.com/favorite",
      }),
    });
    assert.equal(favoriteResponse.status, 201);
    assert.equal((await favoriteResponse.json()).item.is_favorite, true);

    const contentResponse = await fetch(`${baseUrl}/api/content?channel=news&favorite=favorites`, {
      headers,
    });
    assert.equal(contentResponse.status, 200);
    const content = await contentResponse.json();
    assert.equal(content.items.length, 1);
    assert.equal(content.items[0].is_favorite, true);
    assert.equal(content.sources.length, 1);
    assert.equal(content.sources[0].id, sourcePayload.source.id);

    const bootstrapResponse = await fetch(`${baseUrl}/api/sync/bootstrap`, { headers });
    assert.equal(bootstrapResponse.status, 200);
    const bootstrap = await bootstrapResponse.json();
    assert.equal(bootstrap.snapshot.content.sources.length, 1);
    assert.equal(bootstrap.snapshot.content.favorites.length, 1);
  } finally {
    server.close();
    await once(server, "close");
  }
});

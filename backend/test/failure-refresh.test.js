const test = require("node:test");
const assert = require("node:assert/strict");
const { MemoryStore } = require("../src/store/memoryStore");
const { createInformationInput } = require("../src/information-input");
const { createInformationInputPersistence } = require("../src/information-input/persistence");
const { createProductionContentCollector } = require("../src/information-input/productionCollector");

const NOW = "2026-10-01T08:00:00.000Z";
const now = () => new Date(NOW);
function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}
function item(id, sourceId = "source") {
  return { id, channel: "news", source_id: sourceId, canonical_url: `https://audit.invalid/${id}`, title: `中文 🧪 ${id}`, published_at: NOW, fetched_at: NOW, tags: [] };
}
async function fixture(collector) {
  const store = new MemoryStore({ now: () => NOW });
  await store.createUser({ id: "audit", username: "audit" });
  const scope = { userId: "audit" };
  const persistence = createInformationInputPersistence(store);
  await persistence.createSource(scope, { id: "source", channel: "news", type: "rss", name: "Source", url: "https://audit.invalid/feed", enabled: true, sort_order: 1 });
  const input = createInformationInput({ persistence, collector, now });
  return { store, scope, input, persistence };
}

test("F14 rapid duplicate refreshes coalesce and deduplicate collected items", async () => {
  const gate = deferred();
  const entered = deferred();
  let calls = 0;
  const { store, scope, input } = await fixture({ fetchIncrement: async () => {
    calls += 1;
    entered.resolve();
    await gate.promise;
    return [item("same"), item("same")];
  } });
  const one = input.refresh(scope, { channel: "news" });
  const two = input.refresh(scope, { channel: "news" });
  await entered.promise;
  gate.resolve();
  const [first, second] = await Promise.all([one, two]);
  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.equal((await store.listContent(scope, { channel: "news" })).total, 1);
});

test("F14 a persistence failure releases refresh lock and permits an idempotent retry", async (t) => {
  const { store, scope, input } = await fixture({ fetchIncrement: async () => [item("same")] });
  const original = store.updateContentSourceSync.bind(store);
  let fail = true;
  t.mock.method(store, "updateContentSourceSync", async (...args) => {
    if (fail) throw new Error("fixture persistence failure");
    return original(...args);
  });
  await assert.rejects(input.refresh(scope, { channel: "news" }), /fixture persistence failure/);
  assert.equal(input.getCacheStatus(scope.userId, "news").refreshedAt, 0);
  fail = false;
  await input.refresh(scope, { channel: "news" });
  assert.equal((await store.listContent(scope, { channel: "news" })).total, 1);
  assert.equal((await store.getContentSource(scope, "source")).last_success_at, NOW);
});

test("F14 malformed RSS retains prior items while a successful source remains usable", async (t) => {
  const { store, scope, input, persistence } = await fixture(createProductionContentCollector({ now }));
  await persistence.createSource(scope, { id: "good", channel: "news", type: "rss", name: "Good", url: "https://audit.invalid/good", enabled: true, sort_order: 2 });
  await store.upsertContentItems(scope, [item("retained")]);
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(new URL(url).origin, "https://audit.invalid");
    if (String(url).endsWith("/feed")) return new Response("<rss><channel>");
    return new Response(`<rss version="2.0"><channel><title>Fixture</title><item><title><![CDATA[中文 🧪 <&>]]></title><link>https://audit.invalid/new</link><pubDate>Thu, 01 Oct 2026 08:00:00 GMT</pubDate></item></channel></rss>`);
  });
  const result = await input.refresh(scope, { channel: "news" });
  assert.equal(result.stats.failureCount, 1);
  assert.equal(result.stats.successCount, 1);
  assert.deepEqual(result.items.map((entry) => entry.canonical_url).sort(), ["https://audit.invalid/new", "https://audit.invalid/retained"]);
});

test("F15 deleting a source during refresh must not resurrect its ordinary content", async () => {
  const fetched = deferred();
  const entered = deferred();
  const { store, scope, input } = await fixture({ fetchIncrement: async () => {
    entered.resolve();
    return fetched.promise;
  } });
  await store.upsertContentItems(scope, [item("saved")]);
  await store.upsertFavoriteContent(scope, item("saved"));
  const refresh = input.refresh(scope, { channel: "news" });
  await entered.promise;
  await input.deleteSource(scope, "source");
  fetched.resolve([item("late")]);
  await refresh;
  assert.equal((await store.listFavoriteContent(scope, { channel: "news" })).total, 1);
  assert.deepEqual({
    sources: (await store.listContentSources(scope, "news")).length,
    ordinaryItems: (await store.listContent(scope, { channel: "news" })).items.map((entry) => entry.id),
  }, { sources: 0, ordinaryItems: [] });
});

test("F15 disabling or changing a source discards in-flight results but retains prior items", async () => {
  for (const patch of [{ enabled: false }, { url: "https://audit.invalid/new-feed" }]) {
    const fetched = deferred();
    const entered = deferred();
    const { store, scope, input } = await fixture({ fetchIncrement: async () => {
      entered.resolve();
      return fetched.promise;
    } });
    await store.upsertContentItems(scope, [item("prior")]);
    const refresh = input.refresh(scope, { channel: "news" });
    await entered.promise;
    await input.updateSource(scope, "source", patch);
    fetched.resolve([item("late")]);
    await refresh;
    assert.deepEqual((await store.listContent(scope, { channel: "news" })).items.map((entry) => entry.id), ["prior"]);
    const source = await store.getContentSource(scope, "source");
    assert.equal(source.last_success_at, "");
    for (const [field, value] of Object.entries(patch)) assert.equal(source[field], value);
  }
});

test("F15 delete arriving during confirmation waits for the write and removes its result", async (t) => {
  const { store, scope, input } = await fixture({ fetchIncrement: async () => [item("late")] });
  const entered = deferred();
  const release = deferred();
  const original = store.upsertContentItems.bind(store);
  t.mock.method(store, "upsertContentItems", async (...args) => {
    entered.resolve();
    await release.promise;
    return original(...args);
  });
  const refresh = input.refresh(scope, { channel: "news" });
  await entered.promise;
  const deletion = input.deleteSource(scope, "source");
  release.resolve();
  await Promise.all([refresh, deletion]);
  assert.deepEqual(await store.listContentSources(scope, "news"), []);
  assert.deepEqual((await store.listContent(scope, { channel: "news" })).items, []);
});

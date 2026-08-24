const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createInformationInputPersistence,
  INFORMATION_INPUT_PERSISTENCE_METHODS,
} = require("../src/information-input/persistence");
const { MemoryStore } = require("../src/store/memoryStore");
const { SupabaseStore } = require("../src/store/supabaseStore");

test("MemoryStore and SupabaseStore expose the information input persistence seam", () => {
  const storeMethods = [
    "listContentSources",
    "getContentSource",
    "createContentSource",
    "updateContentSource",
    "updateContentSourceSync",
    "deleteContentSource",
    "listContentSourcesUpdatedSince",
    "upsertContentItems",
    "replaceContentItems",
    "pruneExpiredContentItems",
    "listContent",
    "listContentUpdatedSince",
    "listContentFacets",
    "getFeaturedContent",
    "listFavoriteContent",
    "listFavoriteContentUpdatedSince",
    "listFavoriteContentFacets",
    "listFavoriteContentUrls",
    "upsertFavoriteContent",
    "deleteFavoriteContent",
    "getUserSyncState",
    "touchUserSyncState",
  ];
  const stores = [
    new MemoryStore(),
    new SupabaseStore({
      supabaseUrl: "https://example.supabase.co",
      supabaseServiceRoleKey: "test-service-role-key",
    }),
  ];

  for (const store of stores) {
    for (const method of storeMethods) {
      assert.equal(typeof store[method], "function", `${store.constructor.name}.${method}`);
    }
    const persistence = createInformationInputPersistence(store);
    for (const method of INFORMATION_INPUT_PERSISTENCE_METHODS) {
      assert.equal(typeof persistence[method], "function", `${store.constructor.name}.${method}`);
    }
  }
});

test("MemoryStore persistence seam supports source lifecycle", async () => {
  const store = new MemoryStore();
  const persistence = createInformationInputPersistence(store);
  const userContext = { userId: "persistence-contract-user" };

  await persistence.createSource(userContext, {
    id: "source-1",
    channel: "news",
    type: "rss",
    name: "Example",
    url: "https://example.com/feed.xml",
    enabled: true,
    sort_order: 1,
    parser_key: "",
  });

  assert.equal((await persistence.listSources(userContext, "news")).length, 1);
  assert.equal((await persistence.getSource(userContext, "source-1")).name, "Example");
  await persistence.updateSource(userContext, "source-1", { name: "Renamed" });
  assert.equal((await persistence.getSource(userContext, "source-1")).name, "Renamed");
  await persistence.deleteSource(userContext, "source-1");
  assert.equal((await persistence.listSources(userContext, "news")).length, 0);
});

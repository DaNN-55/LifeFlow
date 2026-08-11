const test = require("node:test");
const assert = require("node:assert/strict");
const { extractFeedItemImage, createProductionContentCollector } = require("../src/information-input/productionCollector");
const { createInformationInput } = require("../src/information-input");
const { createInformationInputPersistence } = require("../src/information-input/persistence");
const { MemoryStore } = require("../src/store/memoryStore");

function createInput(store) {
  return createInformationInput({
    persistence: createInformationInputPersistence(store),
    collector: createProductionContentCollector(),
  });
}

function buildRssFeed(items = []) {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>Example Feed</title>
        ${items.join("\n")}
      </channel>
    </rss>`;
}

function buildRssItem({ title, link, pubDate, description = "" }) {
  return `
    <item>
      <title><![CDATA[${title}]]></title>
      <link>${link}</link>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${description}]]></description>
    </item>
  `;
}

test("extractFeedItemImage prefers direct enclosure urls", () => {
  const imageUrl = extractFeedItemImage(
    {
      enclosure: {
        url: "https://cdn.example.com/story.jpg",
      },
      description: '<p>Body</p><img src="https://cdn.example.com/fallback.jpg" />',
    },
    "https://example.com/feed.xml",
    "https://example.com/story",
  );

  assert.equal(imageUrl, "https://cdn.example.com/story.jpg");
});

test("extractFeedItemImage resolves relative image urls from html content", () => {
  const imageUrl = extractFeedItemImage(
    {
      content:
        '<div><img src="/images/story-cover.webp" alt="cover" /></div>',
    },
    "https://example.com/feed.xml",
    "https://example.com/posts/story-1",
  );

  assert.equal(imageUrl, "https://example.com/images/story-cover.webp");
});

test("refresh with no available sources clears items and emits reset sync semantics", async () => {
  const store = new MemoryStore();
  const user = await store.createUser({
    id: "user-news-empty-sources",
    username: "news-empty-sources-user",
    password_hash: "hash",
    recovery_code_hash: "recovery",
    preferences: {},
  });
  await store.upsertContentItems({ userId: user.id }, [{
    id: "stale-item",
    channel: "news",
    title: "Existing",
    canonical_url: "https://example.com/existing",
    published_at: "2026-03-30T00:00:00.000Z",
  }]);
  const before = await store.getUserSyncState(user.id);

  await createInput(store).refresh({ userId: user.id }, { channel: "news" });

  assert.equal((await store.listContent({ userId: user.id }, { channel: "news" })).total, 0);
  const after = await store.getUserSyncState(user.id);
  assert.equal(Boolean(after.dataResetAt), true);
  assert.notEqual(after.dataUpdatedAt, before.dataUpdatedAt);
});

test("partial refresh only prunes successfully refreshed sources", async () => {
  const store = new MemoryStore();
  const user = await store.createUser({
    id: "user-news-partial",
    username: "news-partial-user",
    password_hash: "hash",
    recovery_code_hash: "recovery",
    preferences: {},
  });
  const context = { userId: user.id };
  for (const source of [
    { id: "success-source", name: "Success" },
    { id: "failed-source", name: "Failed" },
  ]) {
    await store.createContentSource(context, {
      ...source,
      channel: "news",
      type: "rss",
      url: `https://example.com/${source.id}.xml`,
      enabled: true,
      sort_order: 1,
      parser_key: "",
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-01T00:00:00.000Z",
    });
  }
  await store.upsertContentItems(context, [
    { id: "success-old", channel: "news", source_id: "success-source", canonical_url: "https://example.com/success-old", published_at: "2026-03-01T00:00:00.000Z" },
    { id: "failed-old", channel: "news", source_id: "failed-source", canonical_url: "https://example.com/failed-old", published_at: "2026-03-01T00:00:00.000Z" },
  ]);
  const input = createInformationInput({
    persistence: createInformationInputPersistence(store),
    collector: {
      async fetchIncrement(source) {
        if (source.id === "failed-source") throw new Error("source unavailable");
        return [];
      },
    },
    now: () => new Date("2026-03-30T12:00:00.000Z"),
  });

  const result = await input.refresh(context, { channel: "news" });
  const remaining = await store.listContent(context, { channel: "news", page: 1, pageSize: 10 });

  assert.equal(result.stats.failureCount, 1);
  assert.deepEqual(result.items.map((item) => item.id), ["failed-old"]);
  assert.deepEqual(remaining.items.map((item) => item.id), ["failed-old"]);
});

test("refresh confirmation returns the complete retained channel projection", async () => {
  const store = new MemoryStore();
  const user = await store.createUser({
    id: "user-news-complete-refresh",
    username: "news-complete-refresh-user",
    password_hash: "hash",
    recovery_code_hash: "recovery",
    preferences: {},
  });
  const context = { userId: user.id };
  await store.createContentSource(context, {
    id: "complete-source",
    channel: "news",
    type: "rss",
    name: "Complete",
    url: "https://example.com/complete.xml",
    enabled: true,
    sort_order: 1,
    parser_key: "",
    created_at: "2026-03-30T00:00:00.000Z",
    updated_at: "2026-03-30T00:00:00.000Z",
  });
  const input = createInformationInput({
    persistence: createInformationInputPersistence(store),
    collector: {
      async fetchIncrement() {
        return Array.from({ length: 12 }, (_, index) => ({
          id: `item-${index + 1}`,
          channel: "news",
          source_id: "complete-source",
          title: `Item ${index + 1}`,
          canonical_url: `https://example.com/item-${index + 1}`,
          published_at: `2026-03-30T${String(index).padStart(2, "0")}:00:00.000Z`,
          fetched_at: "2026-03-30T12:00:00.000Z",
        }));
      },
    },
    now: () => new Date("2026-03-30T12:00:00.000Z"),
  });

  const result = await input.refresh(context, { channel: "news" });

  assert.equal(result.stats.latestItemCount, 12);
  assert.equal(result.items.length, 12);
});

test("refreshChannelContent normalizes nested feed categories to first-level tags", async () => {
  const store = new MemoryStore();
  const user = await store.createUser({
    id: "user-news-tags-1",
    username: "news-tags-user-1",
    password_hash: "hash-tags-1",
    recovery_code_hash: "recovery-tags-1",
    preferences: {},
  });
  await store.createContentSource(
    { userId: user.id },
    {
      id: "source-news-tags-1",
      channel: "news",
      type: "rss",
      name: "Tagged Feed",
      url: "https://example.com/feed.xml",
      enabled: true,
      sort_order: 1,
      parser_key: "",
      created_at: "2026-03-28T00:00:00.000Z",
      updated_at: "2026-03-28T00:00:00.000Z",
    },
  );

  const originalDateNow = Date.now;
  Date.now = () => new Date("2026-03-30T12:00:00.000Z").getTime();

  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(
      buildRssFeed([
        `
          <item>
            <title><![CDATA[Story Tags]]></title>
            <link>https://example.com/story-tags</link>
            <pubDate>Fri, 28 Mar 2026 09:00:00 GMT</pubDate>
            <category>Business / Tech Culture</category>
            <category>Security / Privacy</category>
          </item>
        `,
      ]),
      {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      },
    );

  try {
    await createInput(store).refresh({ userId: user.id }, {
      channel: "news",
      limit: 10,
    });
    const result = await store.listContent(
      { userId: user.id },
      { channel: "news", page: 1, pageSize: 10, sort: "latest" },
    );
    assert.deepEqual(result.items[0].tags, ["Business", "Security"]);
  } finally {
    Date.now = originalDateNow;
    global.fetch = originalFetch;
  }
});

test("refreshChannelContent stores source sync metadata and avoids article fetch fan-out", async () => {
  const store = new MemoryStore();
  const user = await store.createUser({
    id: "user-news-1",
    username: "news-user-1",
    password_hash: "hash-1",
    recovery_code_hash: "recovery-1",
    preferences: {},
  });
  await store.createContentSource(
    { userId: user.id },
    {
      id: "source-news-1",
      channel: "news",
      type: "rss",
      name: "Example Feed",
      url: "https://example.com/feed.xml",
      enabled: true,
      sort_order: 1,
      parser_key: "",
      created_at: "2026-03-28T00:00:00.000Z",
      updated_at: "2026-03-28T00:00:00.000Z",
    },
  );

  const originalDateNow = Date.now;
  Date.now = () => new Date("2026-03-30T12:00:00.000Z").getTime();

  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    requests.push(String(url));
    return new Response(
      buildRssFeed([
        buildRssItem({
          title: "Story A",
          link: "https://example.com/story-a",
          pubDate: "Fri, 28 Mar 2026 09:00:00 GMT",
          description: "<p>Alpha</p>",
        }),
        buildRssItem({
          title: "Story B",
          link: "https://example.com/story-b",
          pubDate: "Thu, 27 Mar 2026 09:00:00 GMT",
          description: "<p>Beta</p>",
        }),
      ]),
      {
        status: 200,
        headers: {
          "content-type": "application/rss+xml",
        },
      },
    );
  };

  try {
    const result = await createInput(store).refresh({ userId: user.id }, {
      channel: "news",
      limit: 10,
    });

    assert.equal(result.items.length, 2);
    assert.deepEqual(requests, ["https://example.com/feed.xml"]);

    const source = await store.getContentSource({ userId: user.id }, "source-news-1");
    assert.equal(Boolean(source.last_success_at), true);
    assert.equal(source.last_error, "");
    assert.equal(source.latest_published_at, "2026-03-28T09:00:00.000Z");
  } finally {
    Date.now = originalDateNow;
    global.fetch = originalFetch;
  }
});

test("refreshChannelContent only appends newer feed items on subsequent syncs", async () => {
  const store = new MemoryStore();
  const user = await store.createUser({
    id: "user-news-2",
    username: "news-user-2",
    password_hash: "hash-2",
    recovery_code_hash: "recovery-2",
    preferences: {},
  });
  await store.createContentSource(
    { userId: user.id },
    {
      id: "source-news-2",
      channel: "news",
      type: "rss",
      name: "Example Feed",
      url: "https://example.com/feed.xml",
      enabled: true,
      sort_order: 1,
      parser_key: "",
      created_at: "2026-03-28T00:00:00.000Z",
      updated_at: "2026-03-28T00:00:00.000Z",
    },
  );

  const payloads = [
    buildRssFeed([
      buildRssItem({
        title: "Story A",
        link: "https://example.com/story-a",
        pubDate: "Fri, 28 Mar 2026 09:00:00 GMT",
      }),
      buildRssItem({
        title: "Story B",
        link: "https://example.com/story-b",
        pubDate: "Thu, 27 Mar 2026 09:00:00 GMT",
      }),
    ]),
    buildRssFeed([
      buildRssItem({
        title: "Story C",
        link: "https://example.com/story-c",
        pubDate: "Sat, 29 Mar 2026 09:00:00 GMT",
      }),
      buildRssItem({
        title: "Story A",
        link: "https://example.com/story-a",
        pubDate: "Fri, 28 Mar 2026 09:00:00 GMT",
      }),
      buildRssItem({
        title: "Story B",
        link: "https://example.com/story-b",
        pubDate: "Thu, 27 Mar 2026 09:00:00 GMT",
      }),
    ]),
  ];
  const originalDateNow = Date.now;
  Date.now = () => new Date("2026-03-30T12:00:00.000Z").getTime();

  let fetchIndex = 0;
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(payloads[Math.min(fetchIndex++, payloads.length - 1)], {
      status: 200,
      headers: {
        "content-type": "application/rss+xml",
      },
    });

  try {
    const input = createInput(store);
    await input.refresh({ userId: user.id }, {
      channel: "news",
      limit: 10,
    });
    await input.refresh({ userId: user.id }, {
      channel: "news",
      limit: 10,
    });

    const result = await store.listContent(
      { userId: user.id },
      {
        channel: "news",
        page: 1,
        pageSize: 10,
        sort: "latest",
      },
    );

    assert.equal(result.total, 3);
    assert.deepEqual(
      result.items.map((item) => item.title),
      ["Story C", "Story A", "Story B"],
    );
  } finally {
    Date.now = originalDateNow;
    global.fetch = originalFetch;
  }
});

test("refreshChannelContent prunes stale news items older than one week", async () => {
  const store = new MemoryStore();
  const user = await store.createUser({
    id: "user-news-retention-1",
    username: "news-retention-user-1",
    password_hash: "hash-retention-1",
    recovery_code_hash: "recovery-retention-1",
    preferences: {},
  });
  await store.createContentSource(
    { userId: user.id },
    {
      id: "source-news-retention-1",
      channel: "news",
      type: "rss",
      name: "Retention Feed",
      url: "https://example.com/retention.xml",
      enabled: true,
      sort_order: 1,
      parser_key: "",
      created_at: "2026-03-28T00:00:00.000Z",
      updated_at: "2026-03-28T00:00:00.000Z",
    },
  );
  await store.upsertContentItems(
    { userId: user.id },
    [
      {
        id: "stale-news-1",
        channel: "news",
        source_id: "source-news-retention-1",
        title: "Old News",
        canonical_url: "https://example.com/old-news",
        source_url: "https://example.com/old-news",
        published_at: "2026-03-01T09:00:00.000Z",
        fetched_at: "2026-03-01T09:00:00.000Z",
        created_at: "2026-03-01T09:00:00.000Z",
        updated_at: "2026-03-01T09:00:00.000Z",
      },
    ],
  );

  const originalDateNow = Date.now;
  Date.now = () => new Date("2026-03-30T12:00:00.000Z").getTime();

  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(
      buildRssFeed([
        buildRssItem({
          title: "Fresh News",
          link: "https://example.com/fresh-news",
          pubDate: "Sun, 30 Mar 2026 09:00:00 GMT",
        }),
      ]),
      {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      },
    );

  try {
    await createInput(store).refresh({ userId: user.id }, {
      channel: "news",
      limit: 10,
    });

    const result = await store.listContent(
      { userId: user.id },
      { channel: "news", page: 1, pageSize: 10, sort: "latest" },
    );

    assert.equal(result.total, 1);
    assert.equal(result.items[0].canonical_url, "https://example.com/fresh-news");
  } finally {
    Date.now = originalDateNow;
    global.fetch = originalFetch;
  }
});

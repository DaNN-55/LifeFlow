import assert from "node:assert/strict";
import test from "node:test";

import { attachInformationInput } from "../src/services/information-input.js";
import { createStateContinuity } from "../src/services/state-continuity.js";

function snapshot() {
  return {
    tasks: [], dailyRecords: {},
    content: {
      sources: { news: {
        sourceA: { id: "sourceA", channel: "news", name: "A", enabled: true },
        sourceB: { id: "sourceB", channel: "news", name: "B", enabled: true },
      } },
      items: { news: {
        first: { id: "first", channel: "news", title: "第一条", source_id: "sourceA", canonical_url: "https://example.com/first", published_at: "2026-08-11T08:00:00Z", tags: ["工程"] },
        second: { id: "second", channel: "news", title: "第二条", source_id: "sourceB", canonical_url: "https://example.com/second", published_at: "2026-08-11T07:00:00Z", tags: ["产品"] },
      } },
      favorites: { news: {} },
      readItems: {},
    },
  };
}

function createAdapter(initial = snapshot()) {
  let current = structuredClone(initial);
  const commands = [];
  return {
    commands,
    load: () => structuredClone(current),
    hasData: () => true,
    sync: async () => structuredClone(current),
    saveConfirmed: () => {},
    loadDrafts: () => ({}), saveDrafts: () => {}, purge: () => {},
    async write(_identity, command) {
      commands.push(command);
      if (_identity.demo && command.type.startsWith("information.source")) throw new Error("安全 Demo 不支持真实信源管理");
      if (_identity.demo && (command.type === "information.toggleRead" || command.type === "information.markRead")) {
        const itemId = command.internalItemId;
        current.content.readItems ||= {};
        if (command.type === "information.toggleRead" && current.content.readItems[itemId]) {
          delete current.content.readItems[itemId];
        } else {
          current.content.readItems[itemId] = "2026-08-11T09:00:00.000Z";
        }
        return { snapshot: structuredClone(current) };
      }
      if (command.type === "information.refresh") return { snapshot: structuredClone(current), report: { successCount: 1, failureCount: 1, failures: [{ sourceId: "sourceB" }] } };
      if (command.type === "information.toggleFavorite") {
        const item = current.content.items.news[command.itemId];
        current.content.favorites.news[command.itemId] = { ...item, is_favorite: true };
        return { snapshot: structuredClone(current) };
      }
      if (command.type === "information.sourceDelete") {
        delete current.content.sources.news[command.sourceId];
        delete current.content.items.news.first;
        return { snapshot: structuredClone(current) };
      }
      return { preferences: command.preferences };
    },
  };
}

test("同一 scope 的重复 attach 复用 NewsSession，筛选状态不会丢失", () => {
  const scope = createStateContinuity({ adapter: createAdapter() }).open({ id: "alice", preferences: { content: {} } });
  const input = attachInformationInput(scope);
  const news = input.news();

  assert.equal(news.projection.items.length, 2);
  assert.equal(input.home().summary[0].title, "第一条");
  assert.equal(input.sidebar().news[0].title, "第一条");
  news.browse({ page: 2 });
  news.browse({ tag: "工程" });
  const attachedAgain = attachInformationInput(scope);
  assert.equal(attachedAgain, input);
  assert.equal(attachedAgain.news(), news);
  assert.equal(news.projection.page, 1);
  assert.equal(news.projection.total, 1);
});

test("open 立即返回导航目标并在后台标记已读，收藏与隐藏同步影响所有投影", async () => {
  const adapter = createAdapter();
  const scope = createStateContinuity({ adapter }).open({ id: "alice", preferences: { content: {} } });
  const input = attachInformationInput(scope);
  const first = input.news().projection.items[0];

  assert.deepEqual(input.open(first.ref), { href: "https://example.com/first" });
  await Promise.resolve();
  await input.change((catalog) => catalog.toggleFavorite(first.ref));
  await input.change((catalog) => catalog.setSourceHidden({ id: "sourceA" }, true));

  assert.equal(adapter.commands.some((command) => command.type === "information.markRead"), true);
  assert.equal(input.news().projection.items.some((item) => item.title === "第一条"), false);
  assert.equal(input.home().summary.some((item) => item.title === "第一条"), false);
  assert.equal(input.sidebar().favorites.items.some((item) => item.title === "第一条"), false);
});

test("删除信源后保留收藏副本，刷新复用请求并返回部分失败报告", async () => {
  const adapter = createAdapter();
  const scope = createStateContinuity({ adapter }).open({ id: "alice", preferences: { content: {} } });
  const input = attachInformationInput(scope);
  const first = input.news().projection.items[0];
  await input.change((catalog) => catalog.toggleFavorite(first.ref));
  await input.change((catalog) => catalog.deleteSource({ id: "sourceA" }));

  assert.equal(input.news().projection.items.some((item) => item.title === "第一条"), true);
  const one = input.refresh();
  const two = input.refresh();
  assert.equal(one, two);
  assert.deepEqual(await one, { successCount: 1, failureCount: 1, failures: [{ sourceId: "sourceB" }] });
});

test("安全 Demo 拒绝真实信源操作", async () => {
  const adapter = createAdapter();
  const scope = createStateContinuity({ adapter }).open({ mode: "demo" });
  const input = attachInformationInput(scope);
  await assert.rejects(input.change((catalog) => catalog.createSource({ name: "真实 RSS", url: "https://example.com/feed.xml" })), /安全 Demo/);
});

test("Demo 用内部 item id 确认已读，但对外 canonical ItemRef 的投影同步更新", async () => {
  const scope = createStateContinuity({ adapter: createAdapter() }).open({ mode: "demo" });
  const input = attachInformationInput(scope);
  const first = input.news().projection.items[0];

  input.open(first.ref);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(input.news().projection.items[0].is_read, true);
  assert.equal(input.home().summary.find((item) => item.ref.id === first.ref.id).is_read, true);
  input.news().browse({ favoriteFilter: "read" });
  assert.deepEqual(input.news().projection.items.map((item) => item.ref.id), [first.ref.id]);
  input.news().browse({ favoriteFilter: "all" });
  await input.change((catalog) => catalog.toggleRead(first.ref));
  assert.equal(input.news().projection.items[0].is_read, false);
});

test("账号偏好中的 canonical 已读记录不会被空的 Demo readItems 形状遮蔽", () => {
  const scope = createStateContinuity({ adapter: createAdapter() }).open({
    id: "alice",
    preferences: { content: { readItems: { "https://example.com/first": "2026-08-11T09:00:00.000Z" } } },
  });
  const input = attachInformationInput(scope);

  assert.equal(input.news().projection.items.find((item) => item.id === "first").is_read, true);
  assert.equal(input.home().summary.at(-1).id, "first");
  input.news().browse({ favoriteFilter: "read" });
  assert.deepEqual(input.news().projection.items.map((item) => item.id), ["first"]);
});

import assert from "node:assert/strict";
import test from "node:test";

import { attachInformationInput } from "../src/services/information-input.js";
import { createStateContinuity } from "../src/services/state-continuity.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

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
        if (command.favorited) {
          delete current.content.favorites.news[command.itemId];
        } else {
          const item = current.content.items.news[command.itemId];
          current.content.favorites.news[command.itemId] = { ...item, is_favorite: true };
        }
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

test("同一资讯同时存在于普通列表和收藏时可以 add 后 remove", async () => {
  const adapter = createAdapter();
  const scope = createStateContinuity({ adapter }).open({ id: "alice", preferences: { content: {} } });
  const input = attachInformationInput(scope);
  const firstRef = input.news().projection.items.find((item) => item.id === "first").ref;

  await input.change((catalog) => catalog.toggleFavorite(firstRef));
  assert.equal(input.news().projection.items.find((item) => item.id === "first").is_favorite, true);
  await input.change((catalog) => catalog.toggleFavorite(firstRef));

  assert.deepEqual(
    adapter.commands.filter((command) => command.type === "information.toggleFavorite").map((command) => command.favorited),
    [false, true],
  );
  assert.equal(input.news().projection.items.find((item) => item.id === "first").is_favorite, false);
});

test("Home 最近收藏按 favorited_at 倒序并使用发布时间和 id 稳定排序", () => {
  const initial = snapshot();
  initial.content.items.news = {
    oldest: { id: "oldest", canonical_url: "https://example.com/oldest", published_at: "2026-08-11T10:00:00Z" },
    tieB: { id: "tie-b", canonical_url: "https://example.com/tie-b", published_at: "2026-08-11T09:00:00Z" },
    tieA: { id: "tie-a", canonical_url: "https://example.com/tie-a", published_at: "2026-08-11T08:00:00Z" },
    newest: { id: "newest", canonical_url: "https://example.com/newest", published_at: "2026-08-01T08:00:00Z" },
  };
  initial.content.favorites.news = {
    oldest: { ...initial.content.items.news.oldest, favorited_at: "2026-08-01T00:00:00Z" },
    tieB: { ...initial.content.items.news.tieB, favorited_at: "2026-08-10T00:00:00Z" },
    tieA: { ...initial.content.items.news.tieA, favorited_at: "2026-08-10T00:00:00Z" },
    newest: { ...initial.content.items.news.newest, favorited_at: "2026-08-11T00:00:00Z" },
  };
  const scope = createStateContinuity({ adapter: createAdapter(initial) }).open({ id: "alice", preferences: { content: {} } });

  assert.deepEqual(attachInformationInput(scope).home().favorites.map((item) => item.id), ["newest", "tie-b", "tie-a"]);
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

test("Today 局部偏好确认后，资讯操作保留新标签和图标", async () => {
  const adapter = createAdapter();
  const scope = createStateContinuity({ adapter }).open({
    id: "alice",
    preferences: {
      tasks: { tagsByTaskId: { first: ["旧标签"] }, iconByTaskId: { first: "旧" } },
      content: { readItems: {}, hiddenSources: {} },
    },
  });
  const input = attachInformationInput(scope);

  await scope.change((catalog) => catalog.today.updateTaskPreferences("first", {
    tags: ["新标签"],
    icon: "新",
  }));
  await input.change((catalog) => catalog.toggleRead({ id: "https://example.com/first" }));

  const readCommand = adapter.commands.find((command) => command.type === "information.toggleRead");
  assert.deepEqual(readCommand.preferences.tasks.tagsByTaskId.first, ["新标签"]);
  assert.equal(readCommand.preferences.tasks.iconByTaskId.first, "新");
  assert.equal(input.news().projection.items.find((item) => item.id === "first").is_read, true);
});

test("资讯偏好失败只回滚对应 mutation，不撤销已确认的任务偏好", async () => {
  const adapter = createAdapter();
  const originalWrite = adapter.write.bind(adapter);
  const readWrite = deferred();
  adapter.write = async (identity, command) => {
    if (command.type === "information.toggleRead") {
      adapter.commands.push(command);
      return readWrite.promise;
    }
    return originalWrite(identity, command);
  };
  const scope = createStateContinuity({ adapter }).open({ id: "alice", preferences: { content: {} } });
  const input = attachInformationInput(scope);
  await scope.change((catalog) => catalog.today.updateTaskPreferences("first", { tags: ["保留"] }));

  const reading = input.change((catalog) => catalog.toggleRead({ id: "https://example.com/first" }));
  assert.equal(input.news().projection.items.find((item) => item.id === "first").is_read, true);
  readWrite.reject(new Error("preferences failed"));
  await assert.rejects(reading, /preferences failed/);

  assert.equal(input.news().projection.items.find((item) => item.id === "first").is_read, false);
  await input.change((catalog) => catalog.setSourceHidden({ id: "sourceB" }, true));
  const hiddenCommand = adapter.commands.find((command) => command.type === "information.setSourceHidden");
  assert.deepEqual(hiddenCommand.preferences.tasks.tagsByTaskId.first, ["保留"]);
});

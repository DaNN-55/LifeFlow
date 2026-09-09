import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMO_STORAGE_KEY,
  createDemoStateRepository,
} from "../src/services/demo-state.js";
import { createPeriodReview, reviewPeriods, reviewViews } from "../src/services/period-review.js";
import { createStateContinuity } from "../src/services/state-continuity.js";

function createMemoryStorage(initialEntries = {}) {
  const entries = new Map(Object.entries(initialEntries));
  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
    removeItem(key) {
      entries.delete(key);
    },
    entries,
  };
}

test("Demo 初始化只写独立存储键，并生成可演示的完整快照", () => {
  const storage = createMemoryStorage({
    "lifeflow-private-dashboard-vue-dashboard-cache": "real-user-cache",
  });
  const repository = createDemoStateRepository({
    storage,
    now: () => new Date("2026-08-10T09:00:00+08:00"),
  });

  const snapshot = repository.ensure();

  assert.equal(storage.entries.get("lifeflow-private-dashboard-vue-dashboard-cache"), "real-user-cache");
  assert.ok(storage.entries.has(DEMO_STORAGE_KEY));
  assert.ok(snapshot.tasks.length >= 2);
  assert.ok(snapshot.dailyRecords["2026-08-10"]);
  assert.ok(Object.keys(snapshot.content.items.news).length >= 3);
  assert.equal(snapshot.home.weather.status, "ready");
  assert.equal(snapshot.home.github.url, "https://github.com/DaNN-55/LifeFlow");
  assert.equal(snapshot.home.github.repos[0].url, "https://github.com/DaNN-55/LifeFlow");
});

test("Demo 任务、每日记录与周总结通过同一接口持久化", () => {
  const storage = createMemoryStorage();
  const repository = createDemoStateRepository({
    storage,
    now: () => new Date("2026-08-10T09:00:00+08:00"),
  });

  const created = repository.createTask({
    name: "验证 Demo 闭环",
    tags: ["验收"],
    icon: "verified",
  });
  const task = created.tasks.find((item) => item.name === "验证 Demo 闭环");
  const record = created.dailyRecords["2026-08-10"];
  record.payload.tasks[task.id] = {
    completed: true,
    notes: [{ id: "note-test", text: "完成一次真实交互", createdAt: "2026-08-10T01:00:00.000Z" }],
  };
  repository.updateDailyRecord(record.date, record.payload);
  repository.saveWeeklySummary("2026-W33", "本周完成了 Demo 闭环。\n");

  const reloaded = createDemoStateRepository({ storage }).load();
  assert.equal(reloaded.dailyRecords["2026-08-10"].payload.tasks[task.id].completed, true);
  assert.equal(reloaded.dailyRecords["2026-08-10"].payload.tasks[task.id].notes[0].text, "完成一次真实交互");
  assert.equal(reloaded.weeklySummaries["2026-W33"].content, "本周完成了 Demo 闭环。");
});

test("Demo 资讯标记可持久化，重置后恢复固定 fixture", () => {
  const storage = createMemoryStorage();
  const repository = createDemoStateRepository({
    storage,
    now: () => new Date("2026-08-10T09:00:00+08:00"),
  });

  repository.ensure();
  repository.toggleFavorite("demo-news-1");
  repository.toggleRead("demo-news-1");
  repository.markRead(["demo-news-2", "demo-news-3"]);
  const marked = repository.load();
  assert.equal(marked.content.items.news["demo-news-1"].is_favorite, true);
  assert.ok(marked.content.readItems["demo-news-1"]);
  assert.ok(marked.content.readItems["demo-news-2"]);
  assert.ok(marked.content.readItems["demo-news-3"]);

  const reset = repository.reset();
  assert.equal(reset.content.items.news["demo-news-1"].is_favorite, false);
  assert.deepEqual(reset.content.readItems, {});
  assert.equal(reset.tasks.some((item) => item.name === "验证 Demo 闭环"), false);
});

test("Demo 引导中的资讯收藏只由实际收藏操作完成", () => {
  const repository = createDemoStateRepository({
    storage: createMemoryStorage(),
    now: () => new Date("2026-08-10T09:00:00+08:00"),
  });

  const initial = repository.ensure();
  assert.equal(initial.onboarding.syntheticNewsFavorited, false);

  repository.toggleRead("demo-news-1");
  assert.equal(repository.load().onboarding.syntheticNewsFavorited, false);

  repository.toggleFavorite("demo-news-1");
  const favorited = repository.load();
  assert.equal(favorited.content.items.news["demo-news-1"].is_favorite, true);
  assert.equal(favorited.onboarding.syntheticNewsFavorited, true);
});

test("Demo 重置用一次快照写入恢复任务、执行备注、复盘、资讯和全部引导进度", () => {
  const storage = createMemoryStorage();
  const repository = createDemoStateRepository({
    storage,
    now: () => new Date("2026-08-10T09:00:00+08:00"),
  });
  const fixture = repository.ensure();
  const taskId = fixture.tasks[0].id;

  repository.createTask({ name: "临时 Demo 任务" });
  repository.updateDailyRecord("2026-08-10", {
    tasks: {
      [taskId]: {
        completed: true,
        notes: [{ id: "visitor-note", text: "访客执行备注", createdAt: "2026-08-10T01:00:00.000Z" }],
      },
    },
  });
  repository.saveWeeklySummary("2026-W33", "访客周期复盘");
  repository.toggleFavorite("demo-news-1");
  repository.toggleRead("demo-news-2");
  repository.markPeriodReviewOpened();
  repository.setOnboardingCollapsed(true);

  const reset = repository.reset();
  assert.deepEqual(reset, fixture);
  assert.deepEqual(JSON.parse(storage.entries.get(DEMO_STORAGE_KEY)), fixture);
});

test("Demo 引导只记录访客实际完成的执行和复盘打开动作，并在刷新后保留", () => {
  const storage = createMemoryStorage({
    "lifeflow-private-dashboard-vue-dashboard-cache": "real-user-cache",
  });
  const repository = createDemoStateRepository({
    storage,
    now: () => new Date("2026-08-10T09:00:00+08:00"),
  });
  const initial = repository.ensure();
  const taskId = initial.tasks[0].id;

  assert.deepEqual(initial.onboarding, {
    collapsed: false,
    executionRecorded: false,
    syntheticNewsFavorited: false,
    periodReviewOpened: false,
  });

  repository.updateDailyRecord("2026-08-10", {
    tasks: { [taskId]: { completed: true, notes: [] } },
  });
  assert.equal(repository.load().onboarding.executionRecorded, false);

  repository.updateDailyRecord("2026-08-10", {
    tasks: {
      [taskId]: {
        completed: true,
        notes: [{ id: "visitor-note", text: "完成了今天的实际执行", createdAt: "2026-08-10T01:00:00.000Z" }],
      },
    },
  });
  repository.markPeriodReviewOpened();
  repository.setOnboardingCollapsed(true);

  const reloaded = createDemoStateRepository({ storage }).load();
  assert.equal(reloaded.onboarding.executionRecorded, true);
  assert.equal(reloaded.onboarding.periodReviewOpened, true);
  assert.equal(reloaded.onboarding.collapsed, true);
  assert.equal(storage.entries.get("lifeflow-private-dashboard-vue-dashboard-cache"), "real-user-cache");
});

test("Demo 的实际执行备注沿用每日记录事实，并出现在对应周期复盘中", () => {
  const repository = createDemoStateRepository({
    storage: createMemoryStorage(),
    now: () => new Date("2026-08-10T09:00:00+08:00"),
  });
  const initial = repository.ensure();
  const taskId = initial.tasks[0].id;
  const snapshot = repository.updateDailyRecord("2026-08-10", {
    tasks: {
      [taskId]: {
        completed: true,
        notes: [{ id: "execution-note", text: "完成首页信息架构检查", createdAt: "2026-08-10T01:00:00.000Z" }],
      },
    },
  });
  const continuity = createStateContinuity({
    adapter: {
      load: () => snapshot,
      hasData: () => true,
      sync: async () => snapshot,
      write: async () => ({}),
      loadDrafts: () => ({}),
      saveDrafts() {},
    },
  });
  const review = createPeriodReview(continuity.open({ id: "demo-test" }), {
    clock: { now: () => new Date("2026-08-10T09:00:00+08:00") },
  });
  const task = review.view(reviewViews.week(reviewPeriods.week("2026-W33"))).data.visibleTasks
    .find((item) => item.id === taskId);

  assert.ok(task.completionCount >= 1);
  assert.ok(task.notes.some((note) => note.note === "完成首页信息架构检查"));
});

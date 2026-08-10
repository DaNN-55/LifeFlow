import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMO_STORAGE_KEY,
  createDemoStateRepository,
} from "../src/services/demo-state.js";

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

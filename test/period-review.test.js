import assert from "node:assert/strict";
import test from "node:test";
import { isReadonly } from "vue";

import { createPeriodReview, reviewPeriods, reviewViews } from "../src/services/period-review.js";
import { createStateContinuity, views } from "../src/services/state-continuity.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createAdapter(snapshot, write = async () => ({})) {
  return {
    begin() {},
    load: () => structuredClone(snapshot),
    hasData: () => true,
    sync: async () => structuredClone(snapshot),
    write,
    saveConfirmed() {},
    loadDrafts: () => ({}),
    saveDrafts() {},
  };
}

function createReview(snapshot, options = {}) {
  const continuity = createStateContinuity({ adapter: createAdapter(snapshot, options.write) });
  const scope = continuity.open({ id: "alice" });
  const clock = { now: () => new Date(options.now || "2026-08-11T12:00:00+08:00") };
  return { scope, review: createPeriodReview(scope, { clock }) };
}

const snapshot = {
  tasks: [
    { id: "active", name: "活跃", display_order: 2, archived: false },
    { id: "archived", name: "归档", display_order: 1, archived: true, archived_at: "2026-08-05T08:00:00+08:00" },
  ],
  dailyRecords: {
    "2026-08-03": {
      date: "2026-08-03",
      payload: { tasks: { active: { completed: true, notes: [] } } },
    },
    "2026-08-04": {
      date: "2026-08-04",
      payload: { tasks: { active: { completed: true, notes: [] } } },
    },
    "2026-08-05": {
      date: "2026-08-05",
      payload: { tasks: { archived: { completed: true, notes: [{ text: "归档前备注", createdAt: "2026-08-05T09:00:00+08:00" }] } } },
    },
  },
  weeklySummaries: {
    "2026-W31": { week: "2026-W31", content: "已写总结", updatedAt: "2026-08-03T10:00:00+08:00" },
  },
};

test("状态概览集中归档可见性、排行和当前月进度规则", () => {
  const { review } = createReview(snapshot);
  const overview = review.view(reviewViews.statusOverview(reviewPeriods.month("2026-08"))).data;

  assert.deepEqual(overview.rankedTasks.map((task) => task.id), ["active", "archived"]);
  assert.equal(overview.activeTaskCount, 1);
  assert.equal(overview.progressDenominator, 11);
  assert.equal(overview.rankedTasks[0].progress.elapsedDays, 11);
  assert.equal(overview.rankedTasks[1].archived, true);
});

test("月度概览不把每日记录的空任务状态当作任务活动", () => {
  const withEmptyTaskStates = {
    tasks: [
      { id: "acted", name: "有操作", archived: false },
      { id: "untouched", name: "未操作", archived: false },
    ],
    dailyRecords: {
      "2026-08-11": {
        date: "2026-08-11",
        payload: {
          tasks: {
            acted: { completed: true, notes: [] },
            untouched: { completed: false, notes: [] },
          },
        },
      },
    },
    weeklySummaries: {},
  };
  const { review } = createReview(withEmptyTaskStates);
  const overview = review.view(reviewViews.statusOverview(reviewPeriods.month("2026-08"))).data;

  assert.deepEqual(overview.rankedTasks.map((task) => task.id), ["acted"]);
});

test("空白周总结只在下一周开始后成为待补", () => {
  const { review } = createReview(snapshot);
  const month = review.view(reviewViews.month(reviewPeriods.month("2026-08"))).data;
  const current = month.summaryEntries.find((entry) => entry.week === "2026-W33");
  const past = month.summaryEntries.find((entry) => entry.week === "2026-W32");

  assert.equal(current.status, "in-progress");
  assert.equal(past.status, "missing");
});

test("Today 的乐观备注会立即进入周期复盘，并在失败时一起回滚", async () => {
  const pendingWrite = deferred();
  const { scope, review } = createReview(snapshot, { write: () => pendingWrite.promise });
  const overview = review.view(reviewViews.statusOverview(reviewPeriods.month("2026-08")));
  const saving = scope.change((operations) => operations.today.saveRecord("2026-08-11", {
    tasks: { active: { completed: false, notes: [{ text: "乐观备注", createdAt: "2026-08-11T12:00:00+08:00" }] } },
  }));

  assert.equal(overview.data.rankedTasks.find((task) => task.id === "active").noteCount, 1);
  pendingWrite.reject(new Error("save failed"));
  await assert.rejects(saving, /save failed/);
  assert.equal(overview.data.rankedTasks.find((task) => task.id === "active").noteCount, 0);
  assert.equal(overview.issue, "error");
});

test("周总结写入只穿过周期复盘 interface，并共享 optimistic 与 rollback", async () => {
  const pendingWrite = deferred();
  const { review } = createReview(snapshot, { write: () => pendingWrite.promise });
  const week = reviewPeriods.week("2026-W33");
  const projection = review.view(reviewViews.week(week));
  const saving = review.saveWeeklySummary({ period: week, content: " 新总结 " });

  assert.equal(projection.data.summary.content, "新总结");
  assert.equal(projection.activity, "changing");
  pendingWrite.reject(new Error("summary failed"));
  await assert.rejects(saving, /summary failed/);
  assert.equal(projection.data.summary.content, "");
  assert.equal(projection.issue, "error");
});

test("周期复盘事实 projection 不向 caller 提供写权限", () => {
  const continuity = createStateContinuity({ adapter: createAdapter(snapshot) });
  const scope = continuity.open({ id: "alice" });
  const facts = scope.view(views.periodReviewFacts());

  assert.equal(isReadonly(facts.data.tasks), true);
});

test("当前月进度不计入用户本地今天之后的记录", () => {
  const futureSnapshot = structuredClone(snapshot);
  futureSnapshot.dailyRecords["2026-08-20"] = {
    date: "2026-08-20",
    payload: { tasks: { active: { completed: true, notes: [{ text: "未来备注" }] } } },
  };
  const { review } = createReview(futureSnapshot);
  const month = review.view(reviewViews.month(reviewPeriods.month("2026-08"))).data;
  const active = month.visibleTasks.find((task) => task.id === "active");

  assert.equal(active.completionCount, 2);
  assert.equal(active.noteCount, 0);
  assert.equal(month.overview.completionDays, 3);
});

test("周月投影统一使用未归档、完成数、备注数、手工顺序的排序", () => {
  const ordered = {
    tasks: [
      { id: "archived-many", display_order: 1, archived: true, archived_at: "2026-08-05T08:00:00+08:00" },
      { id: "active-note", display_order: 3, archived: false },
      { id: "active-complete", display_order: 4, archived: false },
      { id: "active-order", display_order: 2, archived: false },
    ],
    dailyRecords: {
      "2026-08-05": { payload: { tasks: {
        "archived-many": { completed: true, notes: [{ text: "a" }, { text: "b" }] },
        "active-note": { completed: true, notes: [{ text: "note" }] },
        "active-complete": { completed: true, notes: [] },
        "active-order": { completed: true, notes: [] },
      } } },
      "2026-08-06": { payload: { tasks: {
        "archived-many": { completed: true, notes: [] },
        "active-complete": { completed: true, notes: [] },
      } } },
    },
    weeklySummaries: {},
  };
  const { review } = createReview(ordered);
  const expected = ["active-complete", "active-note", "active-order", "archived-many"];

  assert.deepEqual(review.view(reviewViews.week(reviewPeriods.week("2026-W32"))).data.visibleTasks.map((task) => task.id), expected);
  assert.deepEqual(review.view(reviewViews.month(reviewPeriods.month("2026-08"))).data.visibleTasks.map((task) => task.id), expected);
});

test("任务恢复后仍保留 Timeline 的历史归档事件", () => {
  const restored = {
    tasks: [{ id: "restored", name: "已恢复", archived: false, archived_at: "2026-08-05T08:00:00+08:00" }],
    dailyRecords: {},
    weeklySummaries: {},
  };
  const { review } = createReview(restored);
  const timeline = review.view(reviewViews.timeline()).data;

  assert.equal(timeline.tasks[0].events[0].dateKey, "2026-08-05");
  assert.equal(timeline.tasks[0].events[0].archived, true);
});

test("Timeline 保留任务多次归档与恢复的完整生命周期", () => {
  const facts = {
    tasks: [{
      id: "cycled",
      name: "多次归档",
      archived: false,
      archived_at: "2026-08-09T08:00:00+08:00",
      lifecycle_events: [
        { taskId: "cycled", type: "archive", changedAt: "2026-08-05T08:00:00+08:00" },
        { taskId: "cycled", type: "restore", changedAt: "2026-08-05T09:00:00+08:00" },
        { taskId: "cycled", type: "archive", changedAt: "2026-08-09T08:00:00+08:00" },
        { taskId: "cycled", type: "restore", changedAt: "2026-08-09T09:00:00+08:00" },
      ],
    }],
    dailyRecords: {},
    weeklySummaries: {},
  };
  const { review } = createReview(facts);
  const events = review.view(reviewViews.timeline()).data.tasks[0].events;

  assert.deepEqual(events.map((event) => event.lifecycleType), ["restore", "archive", "restore", "archive"]);
});

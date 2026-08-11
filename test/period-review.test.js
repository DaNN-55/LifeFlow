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

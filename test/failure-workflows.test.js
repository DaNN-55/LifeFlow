import assert from "node:assert/strict";
import test from "node:test";
import { createStateContinuity, views } from "../src/services/state-continuity.js";
import { createAccountStateAdapter } from "../src/services/state-continuity/account-adapter.js";
import { backupFile, deferred, isolatedAccount } from "./helpers/failure-testing.js";

const DATE = "2026-10-01";
const OTHER_DATE = "2026-09-30";
const ARCHIVED_AT = "2026-09-30T08:00:00.000Z";

async function seedTask(harness, fields = {}) {
  return harness.store.createTask(harness.scope, {
    id: "task-1", name: "写作 🧪", color: "#112233", display_order: 1,
    archived: false, archived_at: null, tags: ["中文", "e\u0301"], icon: "target",
    ...fields,
  });
}

async function preparePendingNote(t) {
  const harness = await isolatedAccount(t);
  await seedTask(harness);
  harness.today.selectedDate = DATE;
  await harness.today.bootstrap();
  assert.equal(harness.today.ready, true, harness.today.error);
  assert.equal(harness.today.tasks.length, 1);
  const response = deferred();
  const started = deferred();
  harness.intercept((url, options) => {
    if (url.pathname === `/api/daily-records/${DATE}` && options.method === "PUT") {
      started.resolve();
      return response.promise;
    }
  });
  harness.today.setNoteDraft("task-1", "原日期的待提交备注 📝");
  const saving = harness.today.submitTaskNote("task-1");
  assert.equal(await Promise.race([started.promise.then(() => true), saving.then(() => false)]), true,
    "fixture must reach the pending note request");
  return { ...harness, response, saving };
}

test("F05 备注保存失败且已切换日期时，草稿仍应回到原日期", async (t) => {
  const h = await preparePendingNote(t);
  await h.today.selectDate(OTHER_DATE);
  h.response.resolve(Response.json({ error: "fixture unavailable" }, { status: 503 }));
  await h.saving;
  const scope = h.stateContinuity.open({ id: h.user.id });
  assert.deepEqual({
    original: scope.view(views.today({ date: DATE })).data.drafts,
    other: scope.view(views.today({ date: OTHER_DATE })).data.drafts,
  }, { original: { "task-1": "原日期的待提交备注 📝" }, other: {} });
});

test("F05 旧备注失败不应覆盖用户在请求期间输入的新草稿", async (t) => {
  const h = await preparePendingNote(t);
  h.today.setNoteDraft("task-1", "请求期间写下的新草稿");
  h.response.resolve(Response.json({ error: "fixture unavailable" }, { status: 503 }));
  await h.saving;
  assert.ok(h.today.noteDrafts["task-1"].includes("请求期间写下的新草稿"), "新输入不能被失败请求的旧草稿覆盖");
});

test("F06 提交备注后在远端确认前重开 scope，备注必须仍可恢复", async (t) => {
  const h = await preparePendingNote(t);
  // Simulate a new page runtime over the same storage, without resolving the
  // pending request. No actual process or user's browser is terminated.
  const restarted = createStateContinuity({ adapter: createAccountStateAdapter() }).open({ id: h.user.id });
  const data = restarted.view(views.today({ date: DATE })).data;
  const recoverable = data.drafts["task-1"] === "原日期的待提交备注 📝"
    || data.record?.payload?.tasks?.["task-1"]?.notes?.some((note) => note.text === "原日期的待提交备注 📝");
  h.response.resolve(Response.json({ error: "fixture interrupted" }, { status: 503 }));
  await h.saving;
  assert.equal(Boolean(recoverable), true, "尚未确认的备注不应同时从草稿和重启快照消失");
});

test("F07 当前版本导出的未归档任务可以原样导回", async (t) => {
  const h = await isolatedAccount(t);
  await seedTask(h);
  const exported = await h.account.collectFullSnapshotData();
  assert.equal(exported.taskTypes.length, 1);
  await assert.doesNotReject(h.account.importSnapshot(backupFile(exported), "merge"));
  const tasks = await h.store.listTasks(h.scope);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].name, "写作 🧪");
});

test("F07 备份往返保留任务的 tags 与 icon", async (t) => {
  const h = await isolatedAccount(t);
  const original = await seedTask(h, { archived: true, archived_at: ARCHIVED_AT });
  const exported = await h.account.collectFullSnapshotData();
  await h.store.clearUserData(h.user.id);
  await h.account.importSnapshot(backupFile(exported), "merge");
  const [restored] = await h.store.listTasks(h.scope);
  assert.deepEqual({ tags: restored.tags, icon: restored.icon }, { tags: original.tags, icon: original.icon });
});

test("F08 文件缺失或 JSON 损坏时拒绝导入且不发出写请求", async (t) => {
  const h = await isolatedAccount(t);
  await seedTask(h);
  for (const file of [null, new File(["{bad"], "broken.json")]) {
    await assert.rejects(h.account.importSnapshot(file, "replace"));
  }
  assert.deepEqual(h.requests.filter((request) => request.method !== "GET"), []);
  assert.equal((await h.store.listTasks(h.scope)).length, 1);
});

for (const [label, data] of [
  ["缺少集合", {}],
  ["旧字段形状", { version: 1, tasks: [{ id: "legacy", name: "旧任务" }] }],
  ["未知未来版本", { version: 999, taskTypes: [], dailyRecords: {}, weeklySummaries: {} }],
]) {
  test(`F08 ${label}的备份不得被当作空备份覆盖账号`, async (t) => {
    const h = await isolatedAccount(t);
    await seedTask(h);
    const error = await h.account.importSnapshot(backupFile(data), "replace").then(() => null, (reason) => reason);
    assert.deepEqual({
      rejected: Boolean(error),
      tasks: (await h.store.listTasks(h.scope)).map((task) => task.id),
      mutationCount: h.requests.filter((request) => request.method !== "GET").length,
    }, { rejected: true, tasks: ["task-1"], mutationCount: 0 });
  });
}

test("F09 完整覆盖应移除备份之外的日记录与周总结", async (t) => {
  const h = await isolatedAccount(t);
  await h.store.upsertDailyRecord(h.scope, OTHER_DATE, { tasks: {} });
  await h.store.upsertWeeklySummary(h.scope, "2026-W39", { content: "旧总结" });
  await h.account.importSnapshot(backupFile({
    version: 6, taskTypes: [], dailyRecords: {}, weeklySummaries: {}, preferences: {},
  }), "replace");
  assert.deepEqual({
    records: await h.store.listDailyRecords(h.scope),
    summaries: await h.store.listWeeklySummaries(h.scope),
  }, { records: [], summaries: [] });
});

test("F10 导入部分成功后失败，当前视图应反映已确认的部分结果", async (t) => {
  const h = await isolatedAccount(t);
  const scope = h.stateContinuity.open({ id: h.user.id });
  await scope.control.sync();
  const data = {
    version: 6,
    taskTypes: ["one", "two"].map((id) => ({ id, name: id, color: "#112233", archivedAt: ARCHIVED_AT })),
    dailyRecords: {}, weeklySummaries: {},
  };
  h.intercept((url, options) => {
    if (url.pathname === "/api/tasks" && options.method === "POST" && JSON.parse(options.body).id === "two") {
      return Response.json({ error: "fixture outage" }, { status: 503 });
    }
  });
  await assert.rejects(h.account.importSnapshot(backupFile(data), "merge"));
  assert.deepEqual((await h.store.listTasks(h.scope)).map((task) => task.id), ["one"]);
  assert.deepEqual(scope.view(views.today()).data.tasks.map((task) => task.id), ["one"],
    "导入报错后已确认事实不能一直隐藏在当前 scope 之外");
});

test("F10 同一备份连续导入两次应完成且保持唯一任务", async (t) => {
  const h = await isolatedAccount(t);
  const data = {
    version: 6,
    taskTypes: [{ id: "one", name: "one", color: "#112233", archivedAt: ARCHIVED_AT }],
    dailyRecords: {}, weeklySummaries: {},
  };
  await h.account.importSnapshot(backupFile(data), "merge");
  await assert.doesNotReject(h.account.importSnapshot(backupFile(data), "merge"));
  assert.deepEqual((await h.store.listTasks(h.scope)).map((task) => task.id), ["one"]);
});

test("F05 保存成功只清除提交日期的原草稿，不影响后来输入", async (t) => {
  const h = await preparePendingNote(t);
  h.today.setNoteDraft("task-1", "后来输入");
  const request = h.requests.find((entry) => entry.method === "PUT");
  const record = await h.store.upsertDailyRecord(h.scope, DATE, JSON.parse(request.body));
  h.response.resolve(Response.json({ record }));
  await h.saving;
  assert.equal(h.today.noteDrafts["task-1"], "后来输入");
  assert.equal(record.payload.tasks["task-1"].notes[0].text, "原日期的待提交备注 📝");
});

test("F05 快速重复提交只写一次，成功后清除原日期草稿并保留另一日期草稿", async (t) => {
  const h = await preparePendingNote(t);
  await h.today.submitTaskNote("task-1");
  await h.today.selectDate(OTHER_DATE);
  h.today.setNoteDraft("task-1", "另一日期的草稿");
  const request = h.requests.find((entry) => entry.method === "PUT");
  const record = await h.store.upsertDailyRecord(h.scope, DATE, JSON.parse(request.body));
  h.response.resolve(Response.json({ record }));
  await h.saving;
  assert.equal(h.requests.filter((entry) => entry.method === "PUT").length, 1);
  assert.equal(record.payload.tasks["task-1"].notes.length, 1);
  assert.equal(h.today.noteDrafts["task-1"], "另一日期的草稿");
  await h.today.selectDate(DATE);
  assert.deepEqual(h.today.noteDrafts, {});
  assert.equal(h.today.record.payload.tasks["task-1"].notes.length, 1);
});

test("F07 导出保留注册前和未来历史，安全备份下载格式可原样恢复", async (t) => {
  const h = await isolatedAccount(t);
  await seedTask(h, { id: "中/🧪?#" });
  await h.store.upsertDailyRecord(h.scope, "2020-02-29", { tasks: {} });
  await h.store.upsertDailyRecord(h.scope, "2030-01-01", { tasks: {} });
  await h.store.upsertWeeklySummary(h.scope, "2020-W09", { content: "历史总结" });
  const exported = await h.account.collectFullSnapshotData();
  assert.deepEqual(Object.keys(exported.dailyRecords), ["2020-02-29", "2030-01-01"]);
  const file = new File([JSON.stringify({ exportedAt: ARCHIVED_AT, backup: { data: exported } })], "safety-backup.json");
  await h.account.importSnapshot(file, "replace");
  assert.equal((await h.store.listTasks(h.scope))[0].id, "中/🧪?#");
  assert.equal((await h.store.getWeeklySummary(h.scope, "2020-W09")).content, "历史总结");
});

test("F08 任一后续条目非法都在写入前拒绝，重复 ID 与嵌套字段也校验", async (t) => {
  const h = await isolatedAccount(t);
  await seedTask(h);
  const valid = { id: "new", name: "合法", color: "#112233" };
  const base = { version: 6, taskTypes: [valid], dailyRecords: {}, weeklySummaries: {} };
  const invalids = [
    { ...base, taskTypes: [valid, { ...valid, id: "bad", name: "中".repeat(41) }] },
    { ...base, taskTypes: [valid, valid] },
    { ...base, taskTypes: [{ ...valid, archivedAt: "2026-02-30T00:00:00Z" }] },
    { ...base, dailyRecords: { "2026-02-30": { tasks: {} } } },
    { ...base, dailyRecords: { [DATE]: { tasks: { new: { notes: [{ id: "n", text: "x".repeat(501), createdAt: ARCHIVED_AT }] } } } } },
    { ...base, weeklySummaries: { "2026-W00": { content: "bad" } } },
    { ...base, preferences: { profile: { lifeExpectancyYears: 151 } } },
  ];
  for (const data of invalids) await assert.rejects(h.account.importSnapshot(backupFile(data), "replace"));
  assert.deepEqual(h.requests.filter((entry) => entry.method !== "GET"), []);
  assert.deepEqual((await h.store.listTasks(h.scope)).map((task) => task.id), ["task-1"]);
});

test("F09 完整覆盖仅改变备份管理的集合，保留资讯、信源与收藏", async (t) => {
  const h = await isolatedAccount(t);
  await seedTask(h);
  const source = { id: "source", channel: "news", type: "rss", enabled: true, name: "fixture", url: "https://audit.invalid/feed" };
  const item = { id: "item", channel: "news", source_id: "source", title: "fixture", canonical_url: "https://audit.invalid/item", tags: [] };
  await h.store.createContentSource(h.scope, source);
  await h.store.upsertContentItems(h.scope, [item]);
  await h.store.upsertFavoriteContent(h.scope, item);
  await h.account.importSnapshot(backupFile({ version: 6, taskTypes: [], dailyRecords: {}, weeklySummaries: {} }), "replace");
  assert.deepEqual(await h.store.listTasks(h.scope), []);
  assert.equal((await h.store.listContentSources(h.scope)).length, 1);
  assert.equal((await h.store.listContent(h.scope, { channel: "news" })).total, 1);
  assert.equal((await h.store.listFavoriteContent(h.scope, { channel: "news" })).total, 1);
});

test("F10 覆盖导入中途写入失败不提前删旧数据，并显示已确认部分", async (t) => {
  const h = await isolatedAccount(t);
  await seedTask(h);
  const scope = h.stateContinuity.open({ id: h.user.id });
  await scope.control.sync();
  h.intercept((url, options) => {
    if (url.pathname === `/api/daily-records/${DATE}` && options.method === "PUT") {
      return Response.json({ error: "fixture outage" }, { status: 503 });
    }
  });
  await assert.rejects(h.account.importSnapshot(backupFile({
    version: 6, taskTypes: [{ id: "new", name: "new", color: "#112233" }],
    dailyRecords: { [DATE]: { tasks: {} } }, weeklySummaries: {},
  }), "replace"));
  assert.deepEqual((await h.store.listTasks(h.scope)).map((task) => task.id).sort(), ["new", "task-1"]);
  assert.deepEqual(scope.view(views.today()).data.tasks.map((task) => task.id).sort(), ["new", "task-1"]);
  assert.equal(h.requests.some((entry) => entry.method === "DELETE"), false);
  assert.deepEqual(h.account.safetyBackup.data.taskTypes.map((task) => task.id), ["task-1"]);
});

test("F08 安全备份无法落盘时停止导入，不发出任何写请求", async (t) => {
  const h = await isolatedAccount(t);
  await seedTask(h);
  h.storage.setItem = () => { throw new DOMException("fixture quota", "QuotaExceededError"); };
  await assert.rejects(h.account.importSnapshot(backupFile({
    version: 6, taskTypes: [], dailyRecords: {}, weeklySummaries: {},
  }), "replace"), { name: "QuotaExceededError" });
  assert.deepEqual((await h.store.listTasks(h.scope)).map((task) => task.id), ["task-1"]);
  assert.deepEqual(h.requests.filter((entry) => entry.method !== "GET"), []);
});

test("F10 覆盖清理失败不会留下导入成功通知，已删除部分同步到视图", async (t) => {
  const h = await isolatedAccount(t);
  await seedTask(h);
  await h.store.upsertDailyRecord(h.scope, DATE, { tasks: {} });
  const scope = h.stateContinuity.open({ id: h.user.id });
  await scope.control.sync();
  h.intercept((url, options) => {
    if (url.pathname === `/api/daily-records/${DATE}` && options.method === "DELETE") {
      return Response.json({ error: "fixture delete unavailable" }, { status: 503 });
    }
  });
  await assert.rejects(h.account.importSnapshot(backupFile({
    version: 6, taskTypes: [], dailyRecords: {}, weeklySummaries: {},
  }), "replace"));
  assert.deepEqual(scope.view(views.today()).data.tasks, []);
  assert.ok(await h.store.getDailyRecord(h.scope, DATE));
  const user = await h.store.getUserById(h.user.id);
  assert.equal((user.preferences.sync?.notices || []).some((notice) => notice.message.includes("导入备份已")), false);
});

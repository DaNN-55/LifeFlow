import assert from "node:assert/strict";
import test from "node:test";

import {
  ALPHA_EVENT_NAMES,
  alphaAnalyticsMode,
  createAlphaAnalytics,
} from "../src/services/alpha-analytics.js";

function createMemoryStorage() {
  const entries = new Map();
  return {
    getItem(key) {
      return entries.get(key) || null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
    entries,
  };
}

test("默认关闭时丢弃事件，不触发网络也不写入本地标记", () => {
  const storage = createMemoryStorage();
  const analytics = createAlphaAnalytics({ storage });
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls += 1; };

  try {
    assert.equal(analytics.record("landing_viewed", { mode: "public" }), false);
    assert.equal(networkCalls, 0);
    assert.equal(storage.entries.size, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("测试 receiver 按顺序接收完整 Alpha 漏斗，且每个匿名 mode 只记录一次", () => {
  const events = [];
  const storage = createMemoryStorage();
  const analytics = createAlphaAnalytics({ storage, receiver: (event) => events.push(event) });
  const funnel = [
    ["landing_viewed", "public"],
    ["demo_started", "demo"],
    ["first_task_completed", "demo"],
    ["first_execution_note_added", "demo"],
    ["first_period_review_opened", "demo"],
    ["first_synthetic_news_favorited", "demo"],
    ["feedback_clicked", "demo"],
  ];

  for (const [name, mode] of funnel) {
    assert.equal(analytics.record(name, { mode }), true);
  }
  assert.equal(analytics.record("first_task_completed", { mode: "demo" }), false);

  assert.deepEqual(events.map((event) => event.name), ALPHA_EVENT_NAMES);
  assert.deepEqual(events.map((event) => event.payload), funnel.map(([, mode]) => ({ mode })));
  assert.ok([...storage.entries.keys()].every((key) => !key.includes("session") && !key.includes("user")));
});

test("严格 allowlist 拒绝未知事件与任何敏感载荷字段", () => {
  const events = [];
  const analytics = createAlphaAnalytics({ receiver: (event) => events.push(event) });
  const sensitivePayloads = [
    { mode: "demo", taskName: "私人任务" },
    { mode: "demo", note: "执行备注" },
    { mode: "account", username: "dan" },
    { mode: "demo", title: "资讯标题", sourceUrl: "https://example.com" },
    { mode: "account", recoveryCode: "recovery" },
    { mode: "account", sessionId: "session-secret" },
    { mode: "demo", importedData: { tasks: [] } },
  ];

  assert.equal(analytics.record("not_allowed", { mode: "demo" }), false);
  for (const payload of sensitivePayloads) {
    assert.equal(analytics.record("first_task_completed", payload), false);
  }
  assert.deepEqual(events, []);
});

test("receiver 同步或异步异常被吞掉，mode 仅表达非身份化使用形态", async () => {
  const analytics = createAlphaAnalytics({ receiver: () => { throw new Error("receiver unavailable"); } });
  assert.doesNotThrow(() => analytics.record("feedback_clicked", { mode: "account" }));
  assert.equal(analytics.record("feedback_clicked", { mode: "account" }), false);
  const asyncAnalytics = createAlphaAnalytics({ receiver: async () => { throw new Error("async receiver unavailable"); } });
  assert.equal(asyncAnalytics.record("feedback_clicked", { mode: "account" }), true);
  await Promise.resolve();
  assert.equal(alphaAnalyticsMode({ previewMode: true, user: { id: "private-id" } }), "demo");
  assert.equal(alphaAnalyticsMode({ user: { id: "private-id" } }), "account");
  assert.equal(alphaAnalyticsMode({}), "public");
});

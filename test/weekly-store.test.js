import assert from "node:assert/strict";
import test from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { createServer } from "vite";

test("周总结草稿按 identity 隔离，并在同一用户重登后恢复", async () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const vite = await createServer({ server: { middlewareMode: true, hmr: { port: 24680 } }, appType: "custom" });
  try {
    const { useSessionStore } = await vite.ssrLoadModule("/src/stores/session.js");
    const { useWeeklyStore } = await vite.ssrLoadModule("/src/stores/weekly.js");
    setActivePinia(createPinia());
    const session = useSessionStore();
    const weekly = useWeeklyStore();
    session.user = { id: "alice", preferences: {} };
    weekly.updateSummaryDraft("Alice 未保存草稿");

    session.user = { id: "bob", preferences: {} };
    assert.equal(weekly.currentSummaryDraft, "");
    weekly.updateSummaryDraft("Bob 未保存草稿");

    session.user = { id: "alice", preferences: {} };
    assert.equal(weekly.currentSummaryDraft, "Alice 未保存草稿");
  } finally {
    await vite.close();
    globalThis.localStorage = previousStorage;
  }
});

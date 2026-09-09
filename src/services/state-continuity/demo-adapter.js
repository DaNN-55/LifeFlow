import { demoState } from "../demo-state.js";

function clone(value) {
  return structuredClone(value);
}

export function createDemoStateAdapter() {
  const drafts = new Map();

  return {
    freshness: "demo",
    load() {
      return demoState.ensure();
    },
    hasData() {
      return true;
    },
    async sync() {
      return demoState.ensure();
    },
    saveConfirmed() {},
    loadDrafts(_identity, date) {
      return clone(drafts.get(date) || {});
    },
    saveDrafts(_identity, date, nextDrafts) {
      drafts.set(date, clone(nextDrafts));
    },
    saveSupplemental() {},
    purge() {
      drafts.clear();
      demoState.clear();
    },
    async clearAccountData() {},
    async deleteAccount() {},
    async write(_identity, command) {
      if (command.type === "today.createTask") {
        return { snapshot: demoState.createTask(command.payload) };
      }
      if (command.type === "today.updateTask") {
        return { snapshot: demoState.updateTask(command.taskId, command.payload) };
      }
      if (command.type === "today.deleteTask") {
        return { snapshot: demoState.deleteTask(command.taskId) };
      }
      if (command.type === "today.saveRecord") {
        return { snapshot: demoState.updateDailyRecord(command.date, command.payload) };
      }
      if (
        command.type === "today.updateTaskPreferences"
        || command.type === "preferences.replace"
        || command.type === "preferences.merge"
        || command.type === "information.setSourceHidden"
      ) {
        return { preferences: command.preferences };
      }
      if (command.type === "periodReview.saveWeeklySummary") {
        return { snapshot: demoState.saveWeeklySummary(command.week, command.content) };
      }
      if (command.type === "information.toggleFavorite") {
        return { snapshot: demoState.toggleFavorite(command.itemId) };
      }
      if (command.type === "information.toggleRead") {
        return { snapshot: demoState.toggleRead(command.internalItemId) };
      }
      if (command.type === "information.markRead") {
        return { snapshot: demoState.markRead([command.internalItemId]) };
      }
      if (command.type.startsWith("information.source")) {
        throw new Error("安全 Demo 不支持真实信源管理");
      }
      if (command.type === "information.refresh") {
        return {
          snapshot: demoState.load(),
          report: { channel: "news", successCount: 0, failureCount: 0, failures: [], demo: true },
        };
      }
      throw new Error("Unknown Demo state continuity operation");
    },
  };
}

import {
  clearAccountData as clearRemoteAccountData,
  deleteAccount as deleteRemoteAccount,
} from "../account-api.js";
import {
  clearDashboardUserCache,
  loadCachedTodayNoteDrafts,
  loadDashboardUserCache,
  saveCachedTodayNoteDrafts,
  updateDashboardUserCache,
} from "./account-cache.js";
import {
  addContentFavorite,
  createContentSource,
  deleteContentSource,
  refreshContent,
  removeContentFavorite,
  updateContentSource,
} from "../content-api.js";
import {
  commitDashboardSyncResult,
  fetchDashboardSyncResult,
  hasDashboardSnapshotData,
} from "./account-sync.js";
import {
  createTask,
  deleteTask,
  saveAccountPreferences,
  saveDailyRecord,
  updateTask,
} from "../today-api.js";
import { saveWeeklySummary } from "../weekly-api.js";

export function createAccountStateAdapter() {
  return {
    load(identity) {
      return loadDashboardUserCache(identity.id);
    },
    hasData(snapshot) {
      return hasDashboardSnapshotData(snapshot);
    },
    async sync(identity, { force } = {}) {
      return fetchDashboardSyncResult(identity.id, { force });
    },
    commitSync(identity, result) {
      return commitDashboardSyncResult(identity.id, result);
    },
    saveConfirmed(identity, snapshot) {
      updateDashboardUserCache(identity.id, (cache) => ({
        ...cache,
        tasks: snapshot.tasks,
        dailyRecords: snapshot.dailyRecords,
        weeklySummaries: snapshot.weeklySummaries,
        preferences: snapshot.preferences,
        content: snapshot.content,
      }));
    },
    loadDrafts(identity, date) {
      return loadCachedTodayNoteDrafts(identity.id, date);
    },
    saveDrafts(identity, date, drafts) {
      saveCachedTodayNoteDrafts(identity.id, date, drafts);
    },
    saveSupplemental(identity, patch) {
      updateDashboardUserCache(identity.id, (cache) => ({
        ...cache,
        home: { ...(cache.home || {}), ...(patch || {}) },
      }));
    },
    purge(identity) {
      clearDashboardUserCache(identity.id);
    },
    async clearAccountData() {
      return clearRemoteAccountData();
    },
    async deleteAccount(_identity, password) {
      return deleteRemoteAccount(password);
    },
    async write(_identity, command) {
      if (command.type === "today.createTask") {
        return createTask(command.payload);
      }
      if (command.type === "today.updateTask") {
        return updateTask(command.taskId, command.payload);
      }
      if (command.type === "today.deleteTask") {
        return deleteTask(command.taskId);
      }
      if (command.type === "today.saveRecord") {
        return saveDailyRecord(command.date, command.payload);
      }
      if (
        command.type === "today.updateTaskPreferences"
        || command.type === "preferences.replace"
        || command.type === "preferences.merge"
      ) {
        return saveAccountPreferences(command.preferences);
      }
      if (command.type === "periodReview.saveWeeklySummary") {
        return saveWeeklySummary(command.week, command.content);
      }
      if (command.type === "information.toggleFavorite") {
        if (command.favorited) {
          await removeContentFavorite("news", command.canonicalUrl);
          return { removedFavorite: true };
        }
        const response = await addContentFavorite(command.item);
        return { favorite: response?.item || command.item };
      }
      if (
        command.type === "information.toggleRead"
        || command.type === "information.markRead"
        || command.type === "information.setSourceHidden"
      ) {
        const response = await saveAccountPreferences(command.preferences);
        return { preferences: response?.preferences || command.preferences };
      }
      if (command.type === "information.sourceCreate") {
        const response = await createContentSource(command.source);
        return { source: response?.source || null };
      }
      if (command.type === "information.sourceUpdate") {
        const response = await updateContentSource(command.sourceId, command.source);
        return { source: response?.source || null };
      }
      if (command.type === "information.sourceDelete") {
        await deleteContentSource(command.sourceId);
        return { deletedSourceId: command.sourceId };
      }
      if (command.type === "information.refresh") {
        const response = await refreshContent("news");
        return {
          items: Array.isArray(response?.items) ? response.items : null,
          report: response?.refresh || response?.cache?.lastRefreshStats || {},
        };
      }
      throw new Error("Unknown account state continuity operation");
    },
  };
}

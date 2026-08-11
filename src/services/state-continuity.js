import { reactive, readonly, toRaw } from "vue";

import {
  clearDashboardUserCache,
  loadCachedTodayNoteDrafts,
  loadDashboardUserCache,
  saveCachedTodayNoteDrafts,
  updateDashboardUserCache,
} from "./dashboard-cache.js";
import { demoState } from "./demo-state.js";
import {
  addContentFavorite,
  createContentSource,
  deleteContentSource,
  refreshContent,
  removeContentFavorite,
  updateContentSource,
} from "./content-api.js";
import { hasDashboardSnapshotData, resetDashboardSyncState, syncDashboardSnapshot } from "./sync-service.js";
import {
  createTask,
  deleteTask,
  saveAccountPreferences,
  saveDailyRecord,
  updateTask,
} from "./today-api.js";
import { saveWeeklySummary } from "./weekly-api.js";

function clone(value) {
  return structuredClone(toRaw(value));
}

function createEmptySnapshot() {
  return {
    tasks: [],
    dailyRecords: {},
    weeklySummaries: {},
    drafts: {},
  };
}

function normalizeIdentity(identity = {}) {
  const demo = identity?.mode === "demo" || identity?.demo === true;
  const id = String(identity?.id || "").trim();
  return {
    id: demo ? "demo" : id,
    demo,
    preferences: clone(identity?.preferences || {}),
  };
}

function createBrowserAdapter() {
  const demoDrafts = new Map();

  return {
    begin(identity) {
      if (!identity.demo) {
        resetDashboardSyncState(identity.id);
      }
    },
    load(identity) {
      return identity.demo ? demoState.ensure() : loadDashboardUserCache(identity.id);
    },
    hasData(snapshot) {
      return hasDashboardSnapshotData(snapshot);
    },
    async sync(identity, { force } = {}) {
      if (identity.demo) {
        return demoState.ensure();
      }
      return syncDashboardSnapshot(identity.id, { force });
    },
    saveConfirmed(identity, snapshot) {
      if (identity.demo) {
        return;
      }
      updateDashboardUserCache(identity.id, (cache) => ({
        ...cache,
        tasks: snapshot.tasks,
        dailyRecords: snapshot.dailyRecords,
        weeklySummaries: snapshot.weeklySummaries,
        content: snapshot.content,
      }));
    },
    loadDrafts(identity, date) {
      if (identity.demo) {
        return clone(demoDrafts.get(date) || {});
      }
      return loadCachedTodayNoteDrafts(identity.id, date);
    },
    saveDrafts(identity, date, drafts) {
      if (identity.demo) {
        demoDrafts.set(date, clone(drafts));
        return;
      }
      saveCachedTodayNoteDrafts(identity.id, date, drafts);
    },
    purge(identity) {
      if (identity.demo) {
        demoDrafts.clear();
        demoState.clear();
        return;
      }
      clearDashboardUserCache(identity.id);
    },
    async write(identity, command) {
      if (identity.demo) {
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
        if (command.type === "today.savePreferences") {
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
      }

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
      if (command.type === "today.savePreferences") {
        return saveAccountPreferences(command.preferences);
      }
      if (command.type === "periodReview.saveWeeklySummary") {
        return saveWeeklySummary(command.week, command.content);
      }
      if (command.type === "information.toggleFavorite") {
        if (command.favorited) {
          await removeContentFavorite("news", command.canonicalUrl);
        } else {
          await addContentFavorite(command.item);
        }
        return { snapshot: await syncDashboardSnapshot(identity.id, { force: true }) };
      }
      if (command.type === "information.toggleRead" || command.type === "information.markRead" || command.type === "information.setSourceHidden") {
        const response = await saveAccountPreferences(command.preferences);
        return { preferences: response?.preferences || command.preferences };
      }
      if (command.type === "information.sourceCreate") {
        await createContentSource(command.source);
        return { snapshot: await syncDashboardSnapshot(identity.id, { force: true }) };
      }
      if (command.type === "information.sourceUpdate") {
        await updateContentSource(command.sourceId, command.source);
        return { snapshot: await syncDashboardSnapshot(identity.id, { force: true }) };
      }
      if (command.type === "information.sourceDelete") {
        await deleteContentSource(command.sourceId);
        return { snapshot: await syncDashboardSnapshot(identity.id, { force: true }) };
      }
      if (command.type === "information.refresh") {
        const response = await refreshContent("news");
        return {
          snapshot: await syncDashboardSnapshot(identity.id, { force: true }),
          report: response?.refresh || response?.cache?.lastRefreshStats || {},
        };
      }
      throw new Error("Unknown state continuity operation");
    },
  };
}

function getTodayData(snapshot, date, drafts) {
  return readonly({
    tasks: Array.isArray(snapshot?.tasks) ? snapshot.tasks : [],
    record: snapshot?.dailyRecords?.[date] || null,
    drafts,
  });
}

function getInformationData(snapshot) {
  return readonly({
    items: snapshot?.content?.items || {},
    sources: snapshot?.content?.sources || {},
    favorites: snapshot?.content?.favorites || {},
    preferences: snapshot?.preferences || {},
    readItems: snapshot?.content?.readItems || {},
  });
}

function getPeriodReviewFacts(snapshot) {
  return readonly({
    tasks: Array.isArray(snapshot?.tasks) ? snapshot.tasks : [],
    dailyRecords: snapshot?.dailyRecords || {},
    weeklySummaries: snapshot?.weeklySummaries || {},
  });
}

function replaceRecord(snapshot, date, record) {
  return {
    ...snapshot,
    dailyRecords: {
      ...(snapshot.dailyRecords || {}),
      [date]: record,
    },
  };
}

function toTaskPatch(payload = {}) {
  return {
    ...payload,
    ...(Object.hasOwn(payload, "displayOrder") ? { display_order: payload.displayOrder } : {}),
    ...(Object.hasOwn(payload, "archivedAt") ? { archived_at: payload.archivedAt } : {}),
  };
}

function applyCommand(snapshot, command, response = {}) {
  if (response?.snapshot) {
    return {
      ...clone(response.snapshot),
      preferences: clone(response.preferences || snapshot?.preferences || {}),
    };
  }
  if (command.type === "information.toggleRead" || command.type === "information.markRead" || command.type === "information.setSourceHidden") {
    return { ...snapshot, preferences: clone(response.preferences || command.preferences || snapshot.preferences || {}) };
  }
  if (command.type === "information.toggleFavorite") {
    const favorites = { ...(snapshot.content?.favorites?.news || {}) };
    if (command.favorited) delete favorites[command.itemId];
    else favorites[command.itemId] = { ...command.item, is_favorite: true };
    return {
      ...snapshot,
      content: { ...(snapshot.content || {}), favorites: { ...(snapshot.content?.favorites || {}), news: favorites } },
    };
  }
  if (command.type === "information.sourceUpdate") {
    const sources = { ...(snapshot.content?.sources?.news || {}) };
    if (sources[command.sourceId]) sources[command.sourceId] = { ...sources[command.sourceId], ...command.source };
    return {
      ...snapshot,
      content: { ...(snapshot.content || {}), sources: { ...(snapshot.content?.sources || {}), news: sources } },
    };
  }
  if (command.type === "information.sourceDelete") {
    const sources = { ...(snapshot.content?.sources?.news || {}) };
    const items = { ...(snapshot.content?.items?.news || {}) };
    delete sources[command.sourceId];
    Object.entries(items).forEach(([id, item]) => {
      if (item?.source_id === command.sourceId) delete items[id];
    });
    return {
      ...snapshot,
      content: {
        ...(snapshot.content || {}),
        sources: { ...(snapshot.content?.sources || {}), news: sources },
        items: { ...(snapshot.content?.items || {}), news: items },
      },
    };
  }
  if (command.type === "today.saveRecord") {
    return replaceRecord(snapshot, command.date, response?.record || {
      date: command.date,
      payload: command.payload,
    });
  }
  if (command.type === "today.createTask") {
    const task = response?.task;
    if (!task) {
      return snapshot;
    }
    return {
      ...snapshot,
      tasks: [...(snapshot.tasks || []), task],
    };
  }
  if (command.type === "today.updateTask") {
    const task = response?.task || { id: command.taskId, ...toTaskPatch(command.payload) };
    return {
      ...snapshot,
      tasks: (snapshot.tasks || []).map((item) => (
        String(item?.id) === String(command.taskId) ? { ...item, ...task } : item
      )),
    };
  }
  if (command.type === "today.deleteTask") {
    return {
      ...snapshot,
      tasks: (snapshot.tasks || []).filter((item) => String(item?.id) !== String(command.taskId)),
      dailyRecords: Object.fromEntries(
        Object.entries(snapshot.dailyRecords || {}).map(([date, record]) => [
          date,
          {
            ...record,
            payload: {
              ...(record?.payload || {}),
              tasks: Object.fromEntries(
                Object.entries(record?.payload?.tasks || {}).filter(([taskId]) => taskId !== String(command.taskId)),
              ),
            },
          },
        ]),
      ),
    };
  }
  if (command.type === "periodReview.saveWeeklySummary") {
    const summary = response?.summary || {
      week: command.week,
      content: command.content,
      updatedAt: command.updatedAt,
    };
    return {
      ...snapshot,
      weeklySummaries: {
        ...(snapshot.weeklySummaries || {}),
        [command.week]: {
          week: command.week,
          content: String(summary?.content ?? command.content),
          updatedAt: String(summary?.updatedAt || command.updatedAt || ""),
        },
      },
    };
  }
  return snapshot;
}

export const views = {
  today({ date } = {}) {
    return { type: "today", date: String(date || "") };
  },
  information() {
    return { type: "information" };
  },
  periodReviewFacts() {
    return { type: "periodReviewFacts" };
  },
};

export function createStateContinuity({ adapter = createBrowserAdapter() } = {}) {
  let current = null;
  let generation = 0;

  function open(identity) {
    const normalizedIdentity = normalizeIdentity(identity);
    if (!normalizedIdentity.id) {
      throw new Error("State continuity requires an identity");
    }
    if (current && current.identity.id === normalizedIdentity.id && current.identity.demo === normalizedIdentity.demo) {
      if (
        !normalizedIdentity.demo &&
        Object.keys(normalizedIdentity.preferences).length &&
        !Object.keys(current.confirmedSnapshot?.preferences || {}).length
      ) {
        current.confirmedSnapshot = {
          ...current.confirmedSnapshot,
          preferences: clone(normalizedIdentity.preferences),
        };
        current.state.snapshot = {
          ...current.state.snapshot,
          preferences: clone(normalizedIdentity.preferences),
        };
      }
      return current.scope;
    }

    adapter.begin?.(normalizedIdentity);

    generation += 1;
    const initialSnapshot = clone(adapter.load(normalizedIdentity) || createEmptySnapshot());
    initialSnapshot.preferences = clone(normalizedIdentity.preferences || {});
    const state = reactive({
      snapshot: initialSnapshot,
      freshness: "empty",
      activity: "idle",
      issue: null,
      draftRevision: 0,
    });
    const record = {
      identity: normalizedIdentity,
      generation,
      state,
      closed: false,
      synced: false,
      syncPromise: null,
      operationPromise: Promise.resolve(),
      confirmedSnapshot: null,
      pendingChanges: [],
      scope: null,
    };
    state.freshness = normalizedIdentity.demo
      ? "demo"
      : (adapter.hasData(state.snapshot) ? "cached" : "empty");
    record.confirmedSnapshot = clone(state.snapshot);

    function isCurrent() {
      return current === record && !record.closed && record.generation === generation;
    }

    function applyPendingChanges() {
      state.snapshot = record.pendingChanges.reduce(
        (snapshot, change) => applyCommand(snapshot, change.command, change.response || {}),
        clone(record.confirmedSnapshot),
      );
    }

    function updateActivity() {
      if (!isCurrent()) {
        return;
      }
      if (record.pendingChanges.length) {
        state.activity = "changing";
      } else if (record.syncPromise) {
        state.activity = "syncing";
      } else {
        state.activity = "idle";
      }
    }

    function enqueue(operation) {
      const queued = record.operationPromise.then(operation, operation);
      record.operationPromise = queued.catch(() => {});
      return queued;
    }

    async function sync(force = false) {
      if (!isCurrent()) {
        return state.snapshot;
      }
      if (!force && record.synced) {
        return state.snapshot;
      }
      if (record.syncPromise) {
        return record.syncPromise;
      }

      if (record.identity.demo) {
        record.synced = true;
        state.freshness = "demo";
        return state.snapshot;
      }

      state.issue = null;
      let queued;
      const execute = async () => {
        if (!isCurrent()) {
          return state.snapshot;
        }
        const requestGeneration = record.generation;
        try {
          const snapshot = await adapter.sync(record.identity, { force });
          if (!isCurrent() || requestGeneration !== generation) {
            return state.snapshot;
          }
          record.confirmedSnapshot = {
            ...clone(snapshot || createEmptySnapshot()),
            preferences: clone(record.confirmedSnapshot?.preferences || state.snapshot.preferences || {}),
          };
          applyPendingChanges();
          state.freshness = record.identity.demo ? "demo" : "confirmed";
          state.issue = null;
          record.synced = true;
          return state.snapshot;
        } catch (error) {
          if (isCurrent() && requestGeneration === generation) {
            state.issue = adapter.hasData(record.confirmedSnapshot) ? "offline" : "error";
          }
          throw error;
        } finally {
          if (isCurrent() && requestGeneration === generation) {
            if (record.syncPromise === queued) {
              record.syncPromise = null;
            }
            updateActivity();
          }
        }
      };
      queued = enqueue(execute);
      record.syncPromise = queued;
      updateActivity();
      return queued;
    }

    function change(callback) {
      const command = callback({
        today: {
          saveRecord: (date, payload) => ({ type: "today.saveRecord", date, payload }),
          createTask: (payload) => ({ type: "today.createTask", payload }),
          updateTask: (taskId, payload) => ({ type: "today.updateTask", taskId, payload }),
          deleteTask: (taskId) => ({ type: "today.deleteTask", taskId }),
          savePreferences: (preferences) => ({ type: "today.savePreferences", preferences }),
          saveDrafts: (date, drafts) => ({ type: "today.saveDrafts", date, drafts }),
        },
        information: {
          toggleFavorite: (item) => ({ type: "information.toggleFavorite", ...item }),
          toggleRead: (itemRef, internalItemId, preferences) => ({ type: "information.toggleRead", itemRef, internalItemId, preferences }),
          markRead: (itemRef, internalItemId, preferences) => ({ type: "information.markRead", itemRef, internalItemId, preferences }),
          setSourceHidden: (sourceId, hidden, preferences) => ({ type: "information.setSourceHidden", sourceId, hidden, preferences }),
          sourceCreate: (source) => ({ type: "information.sourceCreate", source }),
          sourceUpdate: (sourceId, source) => ({ type: "information.sourceUpdate", sourceId, source }),
          sourceDelete: (sourceId) => ({ type: "information.sourceDelete", sourceId }),
          refresh: () => ({ type: "information.refresh" }),
        },
        periodReview: {
          saveWeeklySummary: (week, content, updatedAt) => ({
            type: "periodReview.saveWeeklySummary",
            week,
            content,
            updatedAt,
          }),
        },
      });
      if (!command || typeof command.type !== "string") {
        throw new Error("State continuity changes require a domain operation");
      }
      if (command.type === "today.saveDrafts") {
        if (isCurrent()) {
          adapter.saveDrafts(record.identity, command.date, command.drafts);
          state.draftRevision += 1;
        }
        return Promise.resolve(null);
      }

      const pendingChange = { command, response: null };
      record.pendingChanges.push(pendingChange);

      applyPendingChanges();
      updateActivity();
      state.issue = null;

      const execute = async () => {
        if (!isCurrent()) {
          return null;
        }
        const requestGeneration = record.generation;
        try {
          const response = await adapter.write(record.identity, command);
          if (!isCurrent() || requestGeneration !== generation) {
            return null;
          }
          record.confirmedSnapshot = applyCommand(record.confirmedSnapshot, command, response);
          record.pendingChanges = record.pendingChanges.filter((change) => change !== pendingChange);
          applyPendingChanges();
          state.freshness = record.identity.demo ? "demo" : "confirmed";
          if (!record.identity.demo) {
            adapter.saveConfirmed(record.identity, record.confirmedSnapshot);
          }
          return response;
        } catch (error) {
          if (isCurrent() && requestGeneration === generation) {
            record.pendingChanges = record.pendingChanges.filter((change) => change !== pendingChange);
            applyPendingChanges();
            state.issue = "error";
          }
          throw error;
        } finally {
          if (isCurrent() && requestGeneration === generation) {
            updateActivity();
          }
        }
      };

      return enqueue(execute);
    }

    const scope = {
      view(view) {
        if (view?.type !== "today" && view?.type !== "information" && view?.type !== "periodReviewFacts") {
          throw new Error("Unknown state continuity view");
        }
        const projection = {};
        Object.defineProperties(projection, {
          data: {
            enumerable: true,
            get: () => {
              if (view.type === "information") {
                return getInformationData(state.snapshot);
              }
              if (view.type === "periodReviewFacts") {
                return getPeriodReviewFacts(state.snapshot);
              }
              state.draftRevision;
              return getTodayData(state.snapshot, view.date, adapter.loadDrafts(record.identity, view.date));
            },
          },
          freshness: { enumerable: true, get: () => state.freshness },
          activity: { enumerable: true, get: () => state.activity },
          issue: { enumerable: true, get: () => state.issue },
        });
        return readonly(projection);
      },
      change,
      control: {
        sync: () => sync(false),
        refresh: () => sync(true),
        close({ purge = false } = {}) {
          if (!isCurrent()) {
            return;
          }
          record.closed = true;
          generation += 1;
          if (purge) {
            adapter.purge(record.identity);
          }
          current = null;
        },
      },
    };
    record.scope = scope;
    current = record;
    return scope;
  }

  return { open };
}

export const stateContinuity = createStateContinuity();

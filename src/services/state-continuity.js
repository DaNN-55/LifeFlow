import { reactive, readonly, toRaw } from "vue";

import {
  clearDashboardUserCache,
  loadCachedTodayNoteDrafts,
  loadDashboardUserCache,
  saveCachedTodayNoteDrafts,
  updateDashboardUserCache,
} from "./dashboard-cache.js";
import { demoState } from "./demo-state.js";
import { hasDashboardSnapshotData, resetDashboardSyncState, syncDashboardSnapshot } from "./sync-service.js";
import {
  createTask,
  deleteTask,
  saveAccountPreferences,
  saveDailyRecord,
  updateTask,
} from "./today-api.js";

function clone(value) {
  return structuredClone(toRaw(value));
}

function createEmptySnapshot() {
  return {
    tasks: [],
    dailyRecords: {},
    drafts: {},
  };
}

function normalizeIdentity(identity = {}) {
  const demo = identity?.mode === "demo" || identity?.demo === true;
  const id = String(identity?.id || "").trim();
  return {
    id: demo ? "demo" : id,
    demo,
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
    return clone(response.snapshot);
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
  return snapshot;
}

export const views = {
  today({ date } = {}) {
    return { type: "today", date: String(date || "") };
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
      return current.scope;
    }

    adapter.begin?.(normalizedIdentity);

    generation += 1;
    const state = reactive({
      snapshot: clone(adapter.load(normalizedIdentity) || createEmptySnapshot()),
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
          record.confirmedSnapshot = clone(snapshot || createEmptySnapshot());
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
      if (!isCurrent()) {
        throw new Error("State continuity scope is closed");
      }
      const operations = new WeakSet();
      const createOperation = (operation) => {
        const registered = Object.freeze(operation);
        operations.add(registered);
        return registered;
      };
      const command = callback({
        today: {
          saveRecord: (date, payload) => createOperation({ type: "today.saveRecord", date, payload }),
          createTask: (payload) => createOperation({ type: "today.createTask", payload }),
          updateTask: (taskId, payload) => createOperation({ type: "today.updateTask", taskId, payload }),
          deleteTask: (taskId) => createOperation({ type: "today.deleteTask", taskId }),
          savePreferences: (preferences) => createOperation({ type: "today.savePreferences", preferences }),
          saveDrafts: (date, drafts) => createOperation({ type: "today.saveDrafts", date, drafts }),
        },
      });
      if (!operations.has(command)) {
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
          state.issue = null;
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
        if (view?.type !== "today") {
          throw new Error("Unknown state continuity view");
        }
        const projection = {};
        Object.defineProperties(projection, {
          data: {
            enumerable: true,
            get: () => {
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

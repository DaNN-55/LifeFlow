import {
  clearDashboardUserCache,
  loadDashboardUserCache,
  mergeDashboardUserCache,
  replaceDashboardUserCache,
  updateDashboardUserCache,
} from "./dashboard-cache";
import { fetchAccountProfile } from "./account-api";
import { fetchSyncBootstrap, fetchSyncChanges } from "./sync-api";
import { fetchTaskTimeline, fetchWeeklySummary } from "./weekly-api";
import { addDays, formatWeekInputValue, getStartOfWeek, parseIsoDate } from "../utils/date";

const syncStateByUser = new Map();
const RESERVED_MUTATION_KEYS = new Set([
  "home",
  "tasks",
  "task",
  "removeTaskId",
  "dailyRecord",
  "dailyRecords",
  "weeklySummary",
  "weeklySummaries",
]);

function getUserSyncState(userId) {
  const resolvedUserId = String(userId || "").trim();
  if (!resolvedUserId) {
    return {
      completed: false,
      promise: null,
    };
  }

  if (!syncStateByUser.has(resolvedUserId)) {
    syncStateByUser.set(resolvedUserId, {
      completed: false,
      promise: null,
    });
  }

  return syncStateByUser.get(resolvedUserId);
}

function isMissingSyncEndpoint(error) {
  return Number(error?.status || 0) === 404;
}

function isInvalidSyncCursor(value = "") {
  const raw = String(value || "").trim();
  if (!raw) {
    return true;
  }
  return Number.isNaN(Date.parse(raw));
}

function buildWeekValuesBetween(startDate, endDate = new Date()) {
  const start = getStartOfWeek(startDate);
  const end = getStartOfWeek(endDate);
  const values = [];

  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 7)) {
    values.push(formatWeekInputValue(cursor));
  }

  return Array.from(new Set(values));
}

async function fetchLegacyDashboardSnapshot() {
  const [profilePayload, timelinePayload] = await Promise.all([
    fetchAccountProfile().catch(() => null),
    fetchTaskTimeline(),
  ]);

  const tasks = Array.isArray(timelinePayload?.tasks) ? timelinePayload.tasks : [];
  const dailyRecords = Array.isArray(timelinePayload?.records) ? timelinePayload.records : [];
  const createdAt = parseIsoDate(profilePayload?.user?.createdAt) || new Date();
  const weekValues = buildWeekValuesBetween(createdAt, new Date());
  const weeklySummaryResponses = await Promise.all(
    weekValues.map((week) => fetchWeeklySummary(week).catch(() => ({ summary: null }))),
  );
  const weeklySummaries = weeklySummaryResponses
    .map((payload, index) => {
      const week = weekValues[index];
      const summary = payload?.summary;
      if (!summary) {
        return null;
      }
      return {
        week,
        content: String(summary?.content || ""),
        updatedAt: String(summary?.updatedAt || ""),
      };
    })
    .filter(Boolean);

  return {
    cursor: new Date().toISOString(),
    resetAt: "",
    reset: true,
    snapshot: {
      tasks,
      dailyRecords,
      weeklySummaries,
    },
  };
}

export function hasDashboardSnapshotData(snapshot = {}) {
  return (
    Array.isArray(snapshot?.tasks) && snapshot.tasks.length > 0
  ) || Object.keys(snapshot?.dailyRecords || {}).length > 0
    || Object.keys(snapshot?.weeklySummaries || {}).length > 0;
}

export function loadDashboardSnapshot(userId) {
  return loadDashboardUserCache(userId);
}

export function resetDashboardSyncState(userId) {
  const resolvedUserId = String(userId || "").trim();
  if (!resolvedUserId) {
    return;
  }
  syncStateByUser.delete(resolvedUserId);
}

export function clearDashboardSnapshot(userId) {
  clearDashboardUserCache(userId);
  resetDashboardSyncState(userId);
}

function applySyncPayload(userId, payload = {}, fallbackCursor = "") {
  const cursor = String(payload?.cursor || fallbackCursor || "");
  const resetAt = String(payload?.resetAt || "");
  const lastSyncedAt = new Date().toISOString();

  if (payload?.reset || payload?.snapshot) {
    replaceDashboardUserCache(userId, payload?.snapshot || {}, {
      cursor,
      resetAt,
      lastSyncedAt,
    });
    return loadDashboardUserCache(userId);
  }

  mergeDashboardUserCache(userId, payload?.changes || {}, {
    cursor,
    resetAt,
    lastSyncedAt,
  });
  return loadDashboardUserCache(userId);
}

async function runDashboardSync(userId) {
  const current = loadDashboardUserCache(userId);
  const cachedCursor = String(current?.sync?.cursor || "");
  const since = isInvalidSyncCursor(cachedCursor) ? "" : cachedCursor;
  let payload;

  try {
    if (since) {
      try {
        payload = await fetchSyncChanges(since);
      } catch (error) {
        if (Number(error?.status || 0) !== 400) {
          throw error;
        }
        payload = await fetchSyncBootstrap();
      }
    } else {
      payload = await fetchSyncBootstrap();
    }
  } catch (error) {
    if (!isMissingSyncEndpoint(error)) {
      throw error;
    }
    payload = await fetchLegacyDashboardSnapshot();
  }

  return applySyncPayload(userId, payload, since);
}

export async function syncDashboardSnapshot(userId, options = {}) {
  const resolvedUserId = String(userId || "").trim();
  if (!resolvedUserId) {
    return loadDashboardUserCache("");
  }

  const state = getUserSyncState(resolvedUserId);
  if (!options.force && state.completed) {
    return loadDashboardUserCache(resolvedUserId);
  }

  if (state.promise) {
    return state.promise;
  }

  state.promise = runDashboardSync(resolvedUserId)
    .then((snapshot) => {
      state.completed = true;
      return snapshot;
    })
    .finally(() => {
      state.promise = null;
    });

  return state.promise;
}

export function primeDashboardSync(userId) {
  const resolvedUserId = String(userId || "").trim();
  if (!resolvedUserId) {
    return Promise.resolve(loadDashboardUserCache(""));
  }
  return syncDashboardSnapshot(resolvedUserId).catch(() => loadDashboardUserCache(resolvedUserId));
}

export function applyDashboardMutation(userId, mutation = {}) {
  return updateDashboardUserCache(userId, (cache) => {
    const homePatch = mutation?.home && typeof mutation.home === "object"
      ? mutation.home
      : Object.fromEntries(
          Object.entries(mutation).filter(([key]) => !RESERVED_MUTATION_KEYS.has(key)),
        );

    const next = {
      ...cache,
      home: Object.keys(homePatch).length
        ? {
            ...cache.home,
            ...homePatch,
          }
        : cache.home,
    };

    if (Array.isArray(mutation?.tasks)) {
      next.tasks = mutation.tasks;
    }

    if (mutation?.task && typeof mutation.task === "object") {
      next.tasks = [
        ...cache.tasks.filter((task) => String(task?.id || "") !== String(mutation.task?.id || "")),
        mutation.task,
      ];
    }

    if (mutation?.removeTaskId) {
      next.tasks = next.tasks.filter((task) => String(task?.id || "") !== String(mutation.removeTaskId || ""));
    }

    if (mutation?.dailyRecord?.date) {
      next.dailyRecords = {
        ...next.dailyRecords,
        [mutation.dailyRecord.date]: mutation.dailyRecord,
      };
    }

    if (Array.isArray(mutation?.dailyRecords)) {
      next.dailyRecords = {
        ...next.dailyRecords,
        ...Object.fromEntries(
          mutation.dailyRecords
            .filter((record) => record?.date)
            .map((record) => [String(record.date), record]),
        ),
      };
    }

    if (mutation?.weeklySummary?.week) {
      next.weeklySummaries = {
        ...next.weeklySummaries,
        [mutation.weeklySummary.week]: mutation.weeklySummary,
      };
    }

    if (Array.isArray(mutation?.weeklySummaries)) {
      next.weeklySummaries = {
        ...next.weeklySummaries,
        ...Object.fromEntries(
          mutation.weeklySummaries
            .filter((summary) => summary?.week)
            .map((summary) => [String(summary.week), summary]),
        ),
      };
    }

    return next;
  });
}

import {
  loadDashboardUserCache,
  mergeDashboardUserCache,
  replaceDashboardUserCache,
} from "./dashboard-cache.js";
import { fetchSyncBootstrap, fetchSyncChanges } from "./sync-api.js";

function isInvalidSyncCursor(value = "") {
  const raw = String(value || "").trim();
  if (!raw) {
    return true;
  }
  return Number.isNaN(Date.parse(raw));
}

export function hasDashboardSnapshotData(snapshot = {}) {
  return (
    Array.isArray(snapshot?.tasks) && snapshot.tasks.length > 0
  ) || Object.keys(snapshot?.dailyRecords || {}).length > 0
    || Object.keys(snapshot?.weeklySummaries || {}).length > 0
    || Object.keys(snapshot?.content?.items || {}).length > 0
    || Object.keys(snapshot?.content?.sources || {}).length > 0
    || Object.keys(snapshot?.content?.favorites || {}).length > 0;
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

export async function fetchDashboardSyncResult(userId) {
  const current = loadDashboardUserCache(userId);
  const cachedCursor = String(current?.sync?.cursor || "");
  const since = isInvalidSyncCursor(cachedCursor) ? "" : cachedCursor;
  let payload;

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

  return { payload, fallbackCursor: since };
}

export function commitDashboardSyncResult(userId, result = {}) {
  return applySyncPayload(userId, result.payload || {}, result.fallbackCursor || "");
}

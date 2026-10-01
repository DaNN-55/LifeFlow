import {
  loadDashboardUserCache,
  mergeDashboardUserCache,
  replaceDashboardUserCache,
} from "./account-cache.js";
import { fetchSyncBootstrap, fetchSyncChanges } from "../sync-api.js";

function isInvalidSyncCursor(value = "") {
  const raw = String(value || "").trim();
  return !/^v1\.[0-9a-z]+$/i.test(raw);
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
  validateSyncPayload(payload);
  const cursor = String(payload?.cursor || fallbackCursor || "");
  const resetAt = String(payload?.resetAt || "");
  const lastSyncedAt = new Date().toISOString();

  if (payload?.reset || payload?.snapshot) {
    return replaceDashboardUserCache(userId, payload.snapshot, {
      cursor,
      resetAt,
      lastSyncedAt,
    });
  }

  return mergeDashboardUserCache(userId, payload.changes, {
    cursor,
    resetAt,
    lastSyncedAt,
  });
}

function validateSyncPayload(payload) {
  const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const fail = () => { throw new Error("同步响应格式不完整，已保留当前数据，请重试"); };
  if (!object(payload) || typeof payload.cursor !== "string" || !payload.cursor) fail();
  if (payload.reset !== undefined && typeof payload.reset !== "boolean") fail();
  const full = payload.reset || Object.hasOwn(payload, "snapshot");
  const data = full ? payload.snapshot : payload.changes;
  if (!object(data)) fail();
  for (const [key, id] of [["tasks", "id"], ["dailyRecords", "date"], ["weeklySummaries", "week"]]) {
    if (!full && data[key] === undefined) continue;
    if (!Array.isArray(data[key]) || data[key].some((entry) => !object(entry)
      || typeof entry[id] !== "string" || !entry[id])) fail();
  }
  if (data.preferences !== undefined && !object(data.preferences)) fail();
  if (data.content !== undefined) {
    if (!object(data.content)) fail();
    for (const key of ["sources", "items", "favorites"]) {
      if (!full && data.content[key] === undefined) continue;
      if (!Array.isArray(data.content[key]) || data.content[key].some((entry) => !object(entry)
        || typeof entry.id !== "string" || !entry.id || typeof entry.channel !== "string" || !entry.channel)) fail();
    }
  }
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

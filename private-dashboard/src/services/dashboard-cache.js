const DASHBOARD_CACHE_STORAGE_KEY = "lifeflow-private-dashboard-vue-dashboard-cache";
const DASHBOARD_CACHE_VERSION = 2;

function createEmptyUserCache() {
  return {
    tasks: [],
    dailyRecords: {},
    weeklySummaries: {},
    home: {},
    sync: {
      cursor: "",
      resetAt: "",
      lastSyncedAt: "",
    },
    updatedAt: "",
  };
}

function normalizeRecordMap(records = {}, keyField) {
  if (!records || typeof records !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(records)
      .filter(([key, value]) => key && value && typeof value === "object")
      .map(([key, value]) => [String(value?.[keyField] || key), value]),
  );
}

function normalizeUserCache(cache = {}) {
  return {
    tasks: Array.isArray(cache?.tasks) ? cache.tasks : [],
    dailyRecords: normalizeRecordMap(cache?.dailyRecords, "date"),
    weeklySummaries: normalizeRecordMap(cache?.weeklySummaries, "week"),
    home: cache?.home && typeof cache.home === "object" ? { ...cache.home } : {},
    sync: {
      cursor: String(cache?.sync?.cursor || ""),
      resetAt: String(cache?.sync?.resetAt || ""),
      lastSyncedAt: String(cache?.sync?.lastSyncedAt || ""),
    },
    updatedAt: String(cache?.updatedAt || ""),
  };
}

function normalizeRootCache(parsed = null) {
  if (!parsed || typeof parsed !== "object") {
    return {
      version: DASHBOARD_CACHE_VERSION,
      users: {},
    };
  }

  const version = Number(parsed.version || 0);
  if (version !== 1 && version !== DASHBOARD_CACHE_VERSION) {
    return {
      version: DASHBOARD_CACHE_VERSION,
      users: {},
    };
  }

  return {
    version: DASHBOARD_CACHE_VERSION,
    users: parsed.users && typeof parsed.users === "object" ? parsed.users : {},
  };
}

function loadRootCache() {
  try {
    const raw = localStorage.getItem(DASHBOARD_CACHE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return normalizeRootCache(parsed);
  } catch {
    return {
      version: DASHBOARD_CACHE_VERSION,
      users: {},
    };
  }
}

function saveRootCache(root) {
  try {
    localStorage.setItem(DASHBOARD_CACHE_STORAGE_KEY, JSON.stringify(root));
  } catch {
    // Best-effort cache for local-first dashboard loading.
  }
}

export function updateDashboardUserCache(userId, updater) {
  const resolvedUserId = String(userId || "").trim();
  if (!resolvedUserId) {
    return createEmptyUserCache();
  }

  const root = loadRootCache();
  const current = normalizeUserCache(root.users[resolvedUserId]);
  const next = normalizeUserCache(
    typeof updater === "function"
      ? updater(current) || current
      : current,
  );

  root.users[resolvedUserId] = {
    ...next,
    updatedAt: new Date().toISOString(),
  };
  saveRootCache(root);
  return root.users[resolvedUserId];
}

function withUserCache(userId, updater) {
  return updateDashboardUserCache(userId, updater);
}

function toRecordMap(items = [], keyField) {
  const map = {};
  items.forEach((item) => {
    const key = String(item?.[keyField] || "").trim();
    if (key) {
      map[key] = item;
    }
  });
  return map;
}

export function loadDashboardUserCache(userId) {
  const resolvedUserId = String(userId || "").trim();
  if (!resolvedUserId) {
    return createEmptyUserCache();
  }
  const root = loadRootCache();
  return normalizeUserCache(root.users[resolvedUserId]);
}

export function clearDashboardUserCache(userId) {
  const resolvedUserId = String(userId || "").trim();
  if (!resolvedUserId) {
    return;
  }
  const root = loadRootCache();
  delete root.users[resolvedUserId];
  saveRootCache(root);
}

export function replaceDashboardUserCache(userId, snapshot = {}, sync = {}) {
  return withUserCache(userId, (cache) => ({
    ...cache,
    tasks: Array.isArray(snapshot?.tasks) ? snapshot.tasks : [],
    dailyRecords: toRecordMap(snapshot?.dailyRecords || [], "date"),
    weeklySummaries: toRecordMap(snapshot?.weeklySummaries || [], "week"),
    home: snapshot?.home && typeof snapshot.home === "object" ? { ...snapshot.home } : cache.home,
    sync: {
      ...cache.sync,
      cursor: String(sync?.cursor || ""),
      resetAt: String(sync?.resetAt || ""),
      lastSyncedAt: String(sync?.lastSyncedAt || new Date().toISOString()),
    },
  }));
}

export function mergeDashboardUserCache(userId, changes = {}, sync = {}) {
  return withUserCache(userId, (cache) => {
    const nextTasks = Array.isArray(changes?.tasks) && changes.tasks.length
      ? [
          ...cache.tasks.filter(
            (task) => !changes.tasks.some((candidate) => String(candidate?.id || "") === String(task?.id || "")),
          ),
          ...changes.tasks,
        ]
      : cache.tasks;

    return {
      ...cache,
      tasks: nextTasks,
      dailyRecords: {
        ...cache.dailyRecords,
        ...toRecordMap(changes?.dailyRecords || [], "date"),
      },
      weeklySummaries: {
        ...cache.weeklySummaries,
        ...toRecordMap(changes?.weeklySummaries || [], "week"),
      },
      sync: {
        ...cache.sync,
        cursor: String(sync?.cursor || cache.sync.cursor || ""),
        resetAt: String(sync?.resetAt || cache.sync.resetAt || ""),
        lastSyncedAt: String(sync?.lastSyncedAt || new Date().toISOString()),
      },
    };
  });
}

export function loadCachedTasks(userId) {
  return loadDashboardUserCache(userId).tasks;
}

export function saveCachedTasks(userId, tasks = []) {
  withUserCache(userId, (cache) => ({
    ...cache,
    tasks: Array.isArray(tasks) ? tasks : [],
  }));
}

export function loadCachedDailyRecord(userId, date) {
  const dateKey = String(date || "").trim();
  if (!dateKey) {
    return null;
  }
  return loadDashboardUserCache(userId).dailyRecords[dateKey] || null;
}

export function loadCachedDailyRecords(userId, dates = []) {
  const dailyRecords = loadDashboardUserCache(userId).dailyRecords;
  return dates.map((date) => dailyRecords[String(date || "").trim()] || null);
}

export function saveCachedDailyRecord(userId, record = {}) {
  const dateKey = String(record?.date || "").trim();
  if (!dateKey) {
    return;
  }
  withUserCache(userId, (cache) => ({
    ...cache,
    dailyRecords: {
      ...cache.dailyRecords,
      [dateKey]: record,
    },
  }));
}

export function saveCachedDailyRecords(userId, records = []) {
  const nextRecords = {};
  records.forEach((record) => {
    const dateKey = String(record?.date || "").trim();
    if (dateKey) {
      nextRecords[dateKey] = record;
    }
  });
  if (!Object.keys(nextRecords).length) {
    return;
  }
  withUserCache(userId, (cache) => ({
    ...cache,
    dailyRecords: {
      ...cache.dailyRecords,
      ...nextRecords,
    },
  }));
}

export function loadCachedWeeklySummary(userId, week) {
  const weekKey = String(week || "").trim();
  if (!weekKey) {
    return null;
  }
  return loadDashboardUserCache(userId).weeklySummaries[weekKey] || null;
}

export function saveCachedWeeklySummary(userId, summary = {}) {
  const weekKey = String(summary?.week || "").trim();
  if (!weekKey) {
    return;
  }
  withUserCache(userId, (cache) => ({
    ...cache,
    weeklySummaries: {
      ...cache.weeklySummaries,
      [weekKey]: summary,
    },
  }));
}

export function loadCachedHomeData(userId) {
  return loadDashboardUserCache(userId).home || {};
}

export function saveCachedHomeData(userId, partialHome = {}) {
  if (!partialHome || typeof partialHome !== "object") {
    return;
  }
  withUserCache(userId, (cache) => ({
    ...cache,
    home: {
      ...cache.home,
      ...partialHome,
    },
  }));
}

const DASHBOARD_CACHE_STORAGE_KEY = "lifeflow-private-dashboard-vue-dashboard-cache";
const DASHBOARD_CACHE_VERSION = 1;

function createEmptyUserCache() {
  return {
    tasks: [],
    dailyRecords: {},
    weeklySummaries: {},
    home: {},
    updatedAt: "",
  };
}

function normalizeUserCache(cache = {}) {
  return {
    tasks: Array.isArray(cache?.tasks) ? cache.tasks : [],
    dailyRecords: cache?.dailyRecords && typeof cache.dailyRecords === "object" ? { ...cache.dailyRecords } : {},
    weeklySummaries: cache?.weeklySummaries && typeof cache.weeklySummaries === "object" ? { ...cache.weeklySummaries } : {},
    home: cache?.home && typeof cache.home === "object" ? { ...cache.home } : {},
    updatedAt: String(cache?.updatedAt || ""),
  };
}

function loadRootCache() {
  try {
    const raw = localStorage.getItem(DASHBOARD_CACHE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || parsed.version !== DASHBOARD_CACHE_VERSION) {
      return {
        version: DASHBOARD_CACHE_VERSION,
        users: {},
      };
    }
    return {
      version: DASHBOARD_CACHE_VERSION,
      users: parsed.users && typeof parsed.users === "object" ? parsed.users : {},
    };
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

function withUserCache(userId, updater) {
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

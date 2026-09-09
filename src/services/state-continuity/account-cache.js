const DASHBOARD_CACHE_STORAGE_KEY = "lifeflow-private-dashboard-vue-dashboard-cache";
const DASHBOARD_CACHE_VERSION = 3;

function createEmptyUserCache() {
  return {
    tasks: [],
    dailyRecords: {},
    weeklySummaries: {},
    preferences: {},
    drafts: {
      todayNotesByDate: {},
    },
    content: {
      items: {},
      sources: {},
      favorites: {},
    },
    home: {},
    sync: {
      cursor: "",
      resetAt: "",
      lastSyncedAt: "",
    },
    updatedAt: "",
  };
}

function normalizeTodayDraftMap(entries = {}) {
  if (!entries || typeof entries !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(entries)
      .filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")))
      .map(([date, drafts]) => [
        date,
        Object.fromEntries(
          Object.entries(drafts || {})
            .filter(([taskId, value]) => String(taskId || "").trim())
            .map(([taskId, value]) => [String(taskId).trim(), String(value || "")]),
        ),
      ]),
  );
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
    preferences: cache?.preferences && typeof cache.preferences === "object" ? { ...cache.preferences } : {},
    drafts: {
      todayNotesByDate: normalizeTodayDraftMap(cache?.drafts?.todayNotesByDate),
    },
    content: {
      items: normalizeChannelRecordMap(cache?.content?.items, "id"),
      sources: normalizeChannelRecordMap(cache?.content?.sources, "id"),
      favorites: normalizeChannelRecordMap(cache?.content?.favorites, "id"),
    },
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
  if (version !== 1 && version !== 2 && version !== DASHBOARD_CACHE_VERSION) {
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

function normalizeChannelRecordMap(collection = {}, keyField) {
  if (!collection || typeof collection !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(collection)
      .filter(([channel]) => channel)
      .map(([channel, entries]) => [String(channel), normalizeRecordMap(entries, keyField)]),
  );
}

function toChannelRecordMap(items = [], keyField) {
  return (Array.isArray(items) ? items : []).reduce((accumulator, item) => {
    const channel = String(item?.channel || "").trim();
    const key = String(item?.[keyField] || "").trim();
    if (!channel || !key) {
      return accumulator;
    }
    if (!accumulator[channel]) {
      accumulator[channel] = {};
    }
    accumulator[channel][key] = item;
    return accumulator;
  }, {});
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
    preferences: snapshot?.preferences && typeof snapshot.preferences === "object" ? snapshot.preferences : cache.preferences,
    drafts: cache.drafts,
    content: {
      items: toChannelRecordMap(snapshot?.content?.items || [], "id"),
      sources: toChannelRecordMap(snapshot?.content?.sources || [], "id"),
      favorites: toChannelRecordMap(snapshot?.content?.favorites || [], "id"),
    },
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
      drafts: cache.drafts,
      content: {
        items: mergeChannelRecordMaps(cache.content.items, toChannelRecordMap(changes?.content?.items || [], "id")),
        sources: mergeChannelRecordMaps(cache.content.sources, toChannelRecordMap(changes?.content?.sources || [], "id")),
        favorites: mergeChannelRecordMaps(cache.content.favorites, toChannelRecordMap(changes?.content?.favorites || [], "id")),
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

function mergeChannelRecordMaps(current = {}, changes = {}) {
  const next = { ...(current || {}) };
  Object.entries(changes || {}).forEach(([channel, entries]) => {
    next[channel] = {
      ...(next[channel] || {}),
      ...(entries || {}),
    };
  });
  return next;
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

export function loadCachedTodayNoteDrafts(userId, date) {
  const resolvedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? String(date) : "";
  if (!resolvedDate) {
    return {};
  }
  return {
    ...(loadDashboardUserCache(userId).drafts?.todayNotesByDate?.[resolvedDate] || {}),
  };
}

export function saveCachedTodayNoteDrafts(userId, date, drafts = {}) {
  const resolvedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? String(date) : "";
  if (!resolvedDate) {
    return createEmptyUserCache();
  }

  return withUserCache(userId, (cache) => {
    const nextDrafts = Object.fromEntries(
      Object.entries(drafts || {})
        .filter(([taskId]) => String(taskId || "").trim())
        .map(([taskId, value]) => [String(taskId).trim(), String(value || "")])
        .filter(([, value]) => value.length > 0),
    );

    const todayNotesByDate = {
      ...(cache.drafts?.todayNotesByDate || {}),
    };

    if (Object.keys(nextDrafts).length) {
      todayNotesByDate[resolvedDate] = nextDrafts;
    } else {
      delete todayNotesByDate[resolvedDate];
    }

    return {
      ...cache,
      drafts: {
        ...(cache.drafts || {}),
        todayNotesByDate,
      },
    };
  });
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

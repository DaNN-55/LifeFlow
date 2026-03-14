import {
  AUTH_CONFIG_STORAGE_KEY,
  LOCAL_SCOPE_KEY,
  PENDING_SYNC_STORAGE_KEY,
  STORAGE_KEY,
  STORAGE_VERSION,
  WEATHER_CACHE_STORAGE_KEY,
  defaultTasks,
  defaultWidgets,
} from "./app-config.js";
import { formatDateKey, formatTime, parseIsoDate } from "./date-utils.js";
import { getFallbackColor, normalizeThemePreference } from "./dom-utils.js";

export function createEmptyTaskState(taskTypes) {
  return taskTypes.reduce((accumulator, task) => {
    accumulator[task.id] = { completed: false, notes: [] };
    return accumulator;
  }, {});
}

export function createEmptyWeatherState() {
  return {
    status: "idle",
    location: "位置待获取",
    temperature: "--",
    detail: "",
    message: "",
    forecast: [],
    source: "",
    updatedAt: "",
    latitude: null,
    longitude: null,
  };
}

export function loadWeatherCache() {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_STORAGE_KEY);
    if (!raw) {
      return createEmptyWeatherState();
    }
    const parsed = JSON.parse(raw);
    return {
      ...createEmptyWeatherState(),
      ...parsed,
      forecast: Array.isArray(parsed?.forecast) ? parsed.forecast : [],
    };
  } catch (error) {
    return createEmptyWeatherState();
  }
}

export function saveWeatherCache(weather) {
  const next = {
    ...createEmptyWeatherState(),
    ...weather,
    forecast: Array.isArray(weather?.forecast) ? weather.forecast : [],
  };
  localStorage.setItem(WEATHER_CACHE_STORAGE_KEY, JSON.stringify(next));
}

export function createEmptyDailyRecord(date, taskTypes) {
  return {
    date,
    tasks: createEmptyTaskState(taskTypes),
    updatedAt: "",
  };
}

export function createInitialData() {
  return {
    version: STORAGE_VERSION,
    taskTypes: [],
    dailyRecords: {},
    weeklySummaries: {},
    preferences: {
      theme: "light",
      sidebar: {
        calendar: true,
        github: true,
        financeFeed: true,
        scienceFeed: true,
        favorites: true,
        weather: true,
        stock: true,
      },
      content: {
        readItems: {},
        hiddenSources: {},
      },
      sync: {
        lastSyncAttemptAt: "",
        lastSuccessfulSyncAt: "",
        notices: [],
      },
      widgets: structuredClone(defaultWidgets),
    },
  };
}

function mergePreferences(
  preferences = {},
  basePreferences = createInitialData().preferences,
) {
  const base = {
    ...createInitialData().preferences,
    ...(basePreferences || {}),
    sidebar: {
      ...createInitialData().preferences.sidebar,
      ...(basePreferences?.sidebar || {}),
    },
    content: {
      ...createInitialData().preferences.content,
      ...(basePreferences?.content || {}),
      readItems: {
        ...createInitialData().preferences.content.readItems,
        ...(basePreferences?.content?.readItems || {}),
      },
      hiddenSources: {
        ...createInitialData().preferences.content.hiddenSources,
        ...(basePreferences?.content?.hiddenSources || {}),
      },
    },
    sync: {
      ...createInitialData().preferences.sync,
      ...(basePreferences?.sync || {}),
      notices: Array.isArray(basePreferences?.sync?.notices)
        ? basePreferences.sync.notices.slice(0, 12)
        : [],
    },
    widgets: {
      github: {
        ...createInitialData().preferences.widgets.github,
        ...(basePreferences?.widgets?.github || {}),
      },
      favorites: {
        ...createInitialData().preferences.widgets.favorites,
        ...(basePreferences?.widgets?.favorites || {}),
      },
      weather: {
        ...createInitialData().preferences.widgets.weather,
        ...(basePreferences?.widgets?.weather || {}),
      },
      stock: {
        ...createInitialData().preferences.widgets.stock,
        ...(basePreferences?.widgets?.stock || {}),
      },
    },
  };
  return {
    theme: normalizeThemePreference(preferences?.theme || base.theme),
    sidebar: {
      ...base.sidebar,
      ...(preferences?.sidebar || {}),
    },
    content: {
      ...base.content,
      ...(preferences?.content || {}),
      readItems: {
        ...base.content.readItems,
        ...(preferences?.content?.readItems || {}),
      },
      hiddenSources: {
        ...base.content.hiddenSources,
        ...(preferences?.content?.hiddenSources || {}),
      },
    },
    sync: {
      ...base.sync,
      ...(preferences?.sync || {}),
      notices: Array.isArray(preferences?.sync?.notices)
        ? preferences.sync.notices.slice(0, 12)
        : base.sync.notices,
    },
    widgets: {
      github: {
        ...base.widgets.github,
        ...(preferences?.widgets?.github || {}),
      },
      favorites: {
        ...base.widgets.favorites,
        ...(preferences?.widgets?.favorites || {}),
      },
      weather: {
        ...base.widgets.weather,
        ...(preferences?.widgets?.weather || {}),
      },
      stock: {
        ...base.widgets.stock,
        ...(preferences?.widgets?.stock || {}),
      },
    },
  };
}

function getScopedStorageKey(scopeKey = LOCAL_SCOPE_KEY) {
  return `${STORAGE_KEY}:${scopeKey || LOCAL_SCOPE_KEY}`;
}

export function clearScopedStorage(scopeKey = LOCAL_SCOPE_KEY) {
  localStorage.removeItem(getScopedStorageKey(scopeKey));
}

export function persistScopedData(scopeKey, data) {
  localStorage.setItem(getScopedStorageKey(scopeKey), JSON.stringify(data));
}

function migrateWeeklySummaries(weeklySummaries) {
  if (!weeklySummaries || typeof weeklySummaries !== "object") {
    return {};
  }

  return Object.entries(weeklySummaries).reduce(
    (accumulator, [week, summary]) => {
      if (!summary || typeof summary !== "object") {
        return accumulator;
      }
      accumulator[week] = {
        content: typeof summary.content === "string" ? summary.content : "",
        updatedAt:
          typeof summary.updatedAt === "string" ? summary.updatedAt : "",
      };
      return accumulator;
    },
    {},
  );
}

export function loadAuthConfig() {
  try {
    const raw = localStorage.getItem(AUTH_CONFIG_STORAGE_KEY);
    if (!raw) {
      return { username: "" };
    }

    const parsed = JSON.parse(raw);
    return {
      username:
        typeof parsed.username === "string" ? parsed.username.trim() : "",
    };
  } catch (error) {
    return { username: "" };
  }
}

export function normalizeTaskIdentity(taskId, taskName = "", index = 0) {
  const legacyMap = {
    job: defaultTasks[0],
    fitness: defaultTasks[1],
    guitar: defaultTasks[2],
    arbitration: defaultTasks[3],
  };

  if (legacyMap[taskId]) {
    return {
      id: legacyMap[taskId].id,
      name: legacyMap[taskId].name,
      order: legacyMap[taskId].order,
    };
  }

  const matchedDefault = defaultTasks.find((task) => task.id === taskId);
  if (matchedDefault) {
    return {
      id: matchedDefault.id,
      name: matchedDefault.name,
      order: matchedDefault.order,
    };
  }

  return {
    id: taskId,
    name:
      typeof taskName === "string" && taskName.trim()
        ? taskName.trim()
        : `任务${index + 1}`,
    order: index + 1,
  };
}

export function sanitizeTaskTypes(taskTypes) {
  if (!Array.isArray(taskTypes) || taskTypes.length === 0) {
    return [];
  }

  return taskTypes
    .filter(
      (task) =>
        task && typeof task.id === "string" && typeof task.name === "string",
    )
    .map((task, index) => {
      const normalizedIdentity = normalizeTaskIdentity(
        task.id,
        task.name,
        index,
      );
      return {
        id: normalizedIdentity.id,
        name: normalizedIdentity.name,
        order: Number(task.order) || normalizedIdentity.order,
        color: task.color || getFallbackColor(normalizedIdentity.order - 1),
        archived: Boolean(task.archived),
        archivedAt:
          typeof task.archivedAt === "string" && task.archivedAt
            ? task.archivedAt
            : "",
      };
    })
    .sort((a, b) => a.order - b.order);
}

export function isTaskArchived(task) {
  return Boolean(task?.archived);
}

function getArchiveDateKey(task) {
  if (!task?.archivedAt) {
    return "";
  }
  const archiveDate = parseIsoDate(task.archivedAt);
  return archiveDate ? formatDateKey(archiveDate) : "";
}

function shouldTaskExistOnDate(task, date) {
  if (!isTaskArchived(task)) {
    return true;
  }
  const archiveDateKey = getArchiveDateKey(task);
  if (!archiveDateKey) {
    return false;
  }
  return date <= archiveDateKey;
}

export function normalizeLegacyTaskMap(taskMap) {
  const remapped = {};
  Object.entries(taskMap).forEach(([taskId, value]) => {
    const normalizedIdentity = normalizeTaskIdentity(taskId);
    remapped[normalizedIdentity.id] = value;
  });
  return remapped;
}

function normalizeTaskNotes(notes, updatedAt, date) {
  return notes
    .map((note, index) => normalizeSingleTaskNote(note, updatedAt, date, index))
    .filter(Boolean);
}

function normalizeSingleTaskNote(note, updatedAt, date, index) {
  if (typeof note === "string") {
    const text = note.trim();
    if (!text) {
      return null;
    }
    return {
      id: `legacy-note-${date}-${index}`,
      text,
      createdAt: updatedAt || new Date(`${date}T00:00:00`).toISOString(),
    };
  }

  if (!note || typeof note !== "object") {
    return null;
  }

  const text = typeof note.text === "string" ? note.text.trim() : "";
  if (!text) {
    return null;
  }

  return {
    id:
      typeof note.id === "string" && note.id
        ? note.id
        : `note-${date}-${index}`,
    text,
    createdAt:
      typeof note.createdAt === "string" && note.createdAt
        ? note.createdAt
        : updatedAt || new Date(`${date}T00:00:00`).toISOString(),
  };
}

export function migrateTaskRecord(existing, updatedAt, date) {
  if (!existing) {
    return { completed: false, notes: [] };
  }

  if (Array.isArray(existing.notes)) {
    return {
      completed: Boolean(existing.completed),
      notes: normalizeTaskNotes(existing.notes, updatedAt, date),
    };
  }

  return {
    completed: Boolean(existing.completed),
    notes: [],
  };
}

function migrateDailyRecords(dailyRecords, taskTypes) {
  if (!dailyRecords || typeof dailyRecords !== "object") {
    return {};
  }

  const migrated = {};

  Object.entries(dailyRecords).forEach(([date, record]) => {
    const nextRecord = createEmptyDailyRecord(date, taskTypes);
    const normalizedTasks = normalizeLegacyTaskMap(record?.tasks || {});
    if (record?.tasks && typeof record.tasks === "object") {
      taskTypes.forEach((task) => {
        const existing = normalizedTasks[task.id];
        nextRecord.tasks[task.id] = migrateTaskRecord(
          existing,
          record?.updatedAt,
          date,
        );
      });
    }
    nextRecord.updatedAt = record?.updatedAt || "";
    migrated[date] = nextRecord;
  });

  return migrated;
}

export function normalizeDataPayload(
  rawData = {},
  basePreferences = createInitialData().preferences,
) {
  const parsed = rawData && typeof rawData === "object" ? rawData : {};
  const taskTypes = sanitizeTaskTypes(parsed.taskTypes);
  return {
    version: STORAGE_VERSION,
    taskTypes,
    dailyRecords: migrateDailyRecords(parsed.dailyRecords, taskTypes),
    weeklySummaries: migrateWeeklySummaries(parsed.weeklySummaries),
    preferences: mergePreferences(parsed.preferences, basePreferences),
  };
}

export function mergeDashboardData(currentData, importedData) {
  const taskMap = new Map();
  sanitizeTaskTypes(currentData?.taskTypes || []).forEach((task) => {
    taskMap.set(task.id, structuredClone(task));
  });
  sanitizeTaskTypes(importedData?.taskTypes || []).forEach((task) => {
    taskMap.set(task.id, structuredClone(task));
  });

  const mergedTasks = sanitizeTaskTypes(
    [...taskMap.values()]
      .sort((left, right) => left.order - right.order)
      .map((task, index) => ({
        ...task,
        order: index + 1,
      })),
  );

  return normalizeDataPayload(
    {
      taskTypes: mergedTasks,
      dailyRecords: {
        ...(currentData?.dailyRecords || {}),
        ...(importedData?.dailyRecords || {}),
      },
      weeklySummaries: {
        ...(currentData?.weeklySummaries || {}),
        ...(importedData?.weeklySummaries || {}),
      },
      preferences: mergePreferences(
        importedData?.preferences || {},
        currentData?.preferences || createInitialData().preferences,
      ),
    },
    currentData?.preferences || createInitialData().preferences,
  );
}

export function loadData(scopeKey = LOCAL_SCOPE_KEY) {
  try {
    const raw = localStorage.getItem(getScopedStorageKey(scopeKey));
    if (!raw) {
      return createInitialData();
    }

    return normalizeDataPayload(JSON.parse(raw), createInitialData().preferences);
  } catch (error) {
    console.warn("Failed to load dashboard data, resetting state.", error);
    return createInitialData();
  }
}

export function isMeaningfulTaskState(taskState) {
  if (!taskState || typeof taskState !== "object") {
    return false;
  }

  return (
    Boolean(taskState.completed) ||
    (Array.isArray(taskState.notes) && taskState.notes.length > 0)
  );
}

export function loadPendingSyncStore() {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

export function createStorageModule(deps) {
  const { state, setSaveStatus, applyTheme } = deps;

  function getActiveTaskTypes() {
    return state.data.taskTypes.filter((task) => !isTaskArchived(task));
  }

  function getTaskTypesForDate(date) {
    return state.data.taskTypes.filter((task) => shouldTaskExistOnDate(task, date));
  }

  function hasWeeklyTaskHistory(aggregation, taskId) {
    return (
      Number(aggregation?.presenceCounts?.[taskId] || 0) > 0 ||
      Number(aggregation?.completionCounts?.[taskId] || 0) > 0 ||
      (Array.isArray(aggregation?.notesByTask?.[taskId]) &&
        aggregation.notesByTask[taskId].length > 0)
    );
  }

  function getWeeklyVisibleTasks(aggregation) {
    return state.data.taskTypes.filter((task) => {
      if (state.recentlyRestoredTaskIds[task.id]) {
        return false;
      }
      return hasWeeklyTaskHistory(aggregation, task.id);
    });
  }

  function ensureRecord(date) {
    if (!state.data.dailyRecords[date]) {
      state.data.dailyRecords[date] = createEmptyDailyRecord(
        date,
        getTaskTypesForDate(date),
      );
    }

    const record = state.data.dailyRecords[date];
    getTaskTypesForDate(date).forEach((task) => {
      if (!record.tasks[task.id]) {
        record.tasks[task.id] = { completed: false, notes: [] };
      }
      if (!Array.isArray(record.tasks[task.id].notes)) {
        record.tasks[task.id] = migrateTaskRecord(
          record.tasks[task.id],
          record.updatedAt,
          date,
        );
      }
    });

    Object.keys(record.tasks).forEach((taskId) => {
      const task = state.data.taskTypes.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      if (shouldTaskExistOnDate(task, date)) {
        return;
      }
      if (!isMeaningfulTaskState(record.tasks[taskId])) {
        delete record.tasks[taskId];
      }
    });

    return record;
  }

  function permanentlyRemoveTaskFromLocalState(taskId) {
    state.data.taskTypes = state.data.taskTypes.filter((item) => item.id !== taskId);
    Object.values(state.data.dailyRecords).forEach((record) => {
      delete record.tasks[taskId];
    });
    delete state.noteDrafts[taskId];
    if (state.deleteDialogTaskId === taskId) {
      state.deleteDialogTaskId = null;
    }
    if (state.archiveDialogTaskId === taskId) {
      state.archiveDialogTaskId = null;
    }
    if (state.renameDialogTaskId === taskId) {
      state.renameDialogTaskId = null;
    }
  }

  function getCurrentScopeKey() {
    return state.auth.user?.id || LOCAL_SCOPE_KEY;
  }

  function persistStateSilently() {
    persistScopedData(getCurrentScopeKey(), state.data);
  }

  function saveData(message) {
    persistStateSilently();
    setSaveStatus(message || `已自动保存 ${formatTime(new Date())}`);
  }

  function applyAccountPreferences(preferences, options = {}) {
    if (!preferences || typeof preferences !== "object") {
      return;
    }
    state.data.preferences = mergePreferences(preferences, state.data.preferences);
    persistStateSilently();
    if (options.applyTheme !== false) {
      applyTheme(state.data.preferences.theme);
    }
  }

  function saveAuthConfig(config) {
    state.auth.config = {
      username: (config.username || "").trim(),
    };
    localStorage.setItem(
      AUTH_CONFIG_STORAGE_KEY,
      JSON.stringify({ username: state.auth.config.username }),
    );
  }

  function resetScopedUiState() {
    state.noteDrafts = {};
    state.taskNameDrafts = {};
    state.recentlyRestoredTaskIds = {};
    state.weeklySummaryDrafts = {};
    state.weeklySummaryMode = {};
    state.deleteDialogTaskId = null;
    state.archiveDialogTaskId = null;
    state.renameDialogTaskId = null;
    state.weeklySummarySaveDialogOpen = false;
    state.taskTimelineTaskId = null;
    state.accountMenuOpen = false;
    state.accountProfile = null;
    state.accountProfileLoading = false;
    state.accountRecoveryCodeBusy = false;
    state.accountRecoveryFeedback = "";
    state.accountProfileModalOpen = false;
    state.changePasswordModalOpen = false;
    state.clearAccountDataModalOpen = false;
    state.deleteAccountModalOpen = false;
    state.changePasswordSubmitting = false;
    state.clearAccountDataSubmitting = false;
    state.deleteAccountSubmitting = false;
    state.remote.weeklyReview = null;
  }

  function switchDataScope(scopeKey) {
    state.data = loadData(scopeKey);
    resetScopedUiState();
  }

  return {
    getActiveTaskTypes,
    getTaskTypesForDate,
    getWeeklyVisibleTasks,
    ensureRecord,
    permanentlyRemoveTaskFromLocalState,
    saveData,
    persistStateSilently,
    applyAccountPreferences,
    saveAuthConfig,
    getCurrentScopeKey,
    resetScopedUiState,
    switchDataScope,
  };
}

const STORAGE_KEY = "lifeflow-private-dashboard-v1";
const STORAGE_VERSION = 6;
const API_BASE_STORAGE_KEY = "lifeflow-private-dashboard-api-base";
const API_SEED_PREFIX = "lifeflow-private-dashboard-seeded:";
const DEFAULT_REMOTE_API_BASE = "https://lifeflow-backend-mrs1.onrender.com";
const AUTH_CONFIG_STORAGE_KEY = "lifeflow-private-dashboard-auth-config";
const SESSION_STORAGE_KEY = "lifeflow-private-dashboard-session";
const PENDING_SYNC_STORAGE_KEY = "lifeflow-private-dashboard-pending-sync";
const WEATHER_CACHE_STORAGE_KEY = "lifeflow-private-dashboard-weather-cache";
const API_PROBE_TIMEOUT_MS = 1500;
const LOCAL_SCOPE_KEY = "__local__";
const CONTENT_PAGE_SIZE = 30;

const defaultTasks = [
  { id: "task1", name: "任务1", order: 1, color: "#4f46e5" },
  { id: "task2", name: "任务2", order: 2, color: "#0f766e" },
  { id: "task3", name: "任务3", order: 3, color: "#ca8a04" },
  { id: "task4", name: "任务4", order: 4, color: "#dc2626" },
];

const TASK_COLOR_PALETTES = [
  { id: "indigo", label: "靛蓝", value: "#4f46e5" },
  { id: "teal", label: "青绿", value: "#0f766e" },
  { id: "amber", label: "琥珀", value: "#ca8a04" },
  { id: "red", label: "赤红", value: "#dc2626" },
  { id: "violet", label: "紫红", value: "#7c3aed" },
  { id: "sky", label: "天青", value: "#0284c7" },
  { id: "emerald", label: "翠绿", value: "#059669" },
  { id: "rose", label: "玫红", value: "#e11d48" },
];

const placeholderFeeds = {
  finance: [
    { title: "Market breadth and earnings drift", meta: "8h // curated" },
    { title: "Rates hold expectations for next cycle", meta: "1d // overview" },
    { title: "Semiconductor watchlist checkpoint", meta: "2d // notes" },
  ],
  science: [
    { title: "Neural mapping paper placeholder", meta: "queue // review" },
    { title: "Energy materials reading placeholder", meta: "queue // review" },
    { title: "Physics preprint placeholder", meta: "queue // review" },
  ],
};

const mockContentCatalog = {
  finance: [
    ["央行流动性窗口观察", "关注公开市场操作与短端利率变化。", "Macro Desk", "分析"],
    ["美债收益率短线回落", "风险资产对降息预期重新定价。", "Bond Wire", "快讯"],
    ["港股互联网板块回暖", "资金回流高流动性龙头资产。", "HK Markets", "日报"],
    ["原油价格进入震荡区间", "供给预期与美元走势互相对冲。", "Commodities Now", "观察"],
    ["半导体设备订单改善", "产业链资本开支信号边际修复。", "Chip Pulse", "产业"],
    ["黄金避险情绪抬头", "地缘风险推动贵金属配置需求。", "Precious Metals", "快讯"],
    ["消费复苏节奏分化", "高端白酒与可选消费表现不同步。", "CN Consumer", "专题"],
    ["地产融资边际松动", "信用修复仍取决于销售回款。", "Property Lens", "分析"],
    ["美元指数冲高回落", "新兴市场汇率压力暂时缓和。", "FX Daily", "外汇"],
    ["AI 概念再获资金关注", "算力链条估值扩张但波动提升。", "Growth Radar", "专题"],
  ],
  science: [
    ["神经接口材料进展", "柔性导电材料在长期植入中更稳定。", "Nature Briefing", "期刊"],
    ["常温催化路径新结果", "降低工业反应能耗的思路更加清晰。", "ScienceDaily", "新闻"],
    ["聚变约束实验刷新数据", "装置参数优化带来更长稳定窗口。", "Physics Wire", "实验"],
    ["蛋白设计模型再升级", "生成式方法提升候选结构筛选效率。", "BioML Lab", "综述"],
    ["二维材料传感精度提升", "低功耗检测方案更接近量产。", "Materials Update", "论文"],
    ["海洋碳汇观测新方法", "多模态遥感提高区域估算准确率。", "Earth Systems", "研究"],
    ["星系演化样本扩容", "深空数据帮助修正早期形成假设。", "Astro Review", "观测"],
    ["电池界面副反应机制", "原位表征揭示容量衰减关键阶段。", "Energy Letters", "论文"],
    ["类器官模型应用拓展", "疾病筛选与药效验证更加可控。", "Cell Notes", "快讯"],
    ["量子误差校正新策略", "更低冗余开销提升实际部署可行性。", "Quantum Weekly", "分析"],
  ],
};

const defaultWidgets = {
  github: {
    owner: "DanN-55",
    profileUrl: "",
  },
  weather: {
    title: "Weather",
    locationQuery: "",
  },
  stock: {
    title: "A股概览",
    symbols: "贵州茅台,宁德时代,000001",
  },
};

function createInitialContentChannelState(channel) {
  return {
    channel,
    items: [],
    featured: [],
    tags: [],
    sources: [],
    page: 1,
    total: 0,
    pageSize: CONTENT_PAGE_SIZE,
    search: "",
    tag: "all",
    sourceId: "all",
    favoriteFilter: "all",
    sort: "latest",
    loading: false,
    loaded: false,
    refreshing: false,
    usingMock: false,
    error: "",
    meta: "",
  };
}

const elements = {
  body: document.body,
  topTabs: document.querySelectorAll(".top-tab"),
  centerTabs: document.querySelectorAll(".center-tab"),
  themeOptions: document.querySelectorAll(".theme-option"),
  cloudStatusChip: document.querySelector("#cloud-status-chip"),
  authStatusChip: document.querySelector("#auth-status-chip"),
  accountMenu: document.querySelector("#account-menu"),
  authAction: document.querySelector("#auth-action"),
  todayCompletedCount: document.querySelector("#today-completed-count"),
  weeklyRangePicker: document.querySelector("#weekly-range-picker"),
  monthlyRangePicker: document.querySelector("#monthly-range-picker"),
  weeklyModeWeek: document.querySelector("#weekly-mode-week"),
  weeklyModeMonth: document.querySelector("#weekly-mode-month"),
  reviewRangeLabel: document.querySelector("#review-range-label"),
  weeklySummaryCard: document.querySelector("#weekly-summary-card"),
  weeklySummaryInput: document.querySelector("#weekly-summary-input"),
  weeklySummaryDisplay: document.querySelector("#weekly-summary-display"),
  weeklySummaryEdit: document.querySelector("#weekly-summary-edit"),
  weeklySummarySave: document.querySelector("#weekly-summary-save"),
  weeklySummaryMeta: document.querySelector("#weekly-summary-meta"),
  weeklyTaskFilter: document.querySelector("#weekly-task-filter"),
  weeklyCompletionFilter: document.querySelector("#weekly-completion-filter"),
  weeklyNotesFilter: document.querySelector("#weekly-notes-filter"),
  weeklyArchiveFilter: document.querySelector("#weekly-archive-filter"),
  exportDataButton: document.querySelector("#export-data-button"),
  saveStatus: document.querySelector("#save-status"),
  saveStatusUndo: document.querySelector("#save-status-undo"),
  saveStatusRetry: document.querySelector("#save-status-retry"),
  calendarMonthLabel: document.querySelector("#calendar-month-label"),
  calendarGrid: document.querySelector("#calendar-grid"),
  financeFeed: document.querySelector("#finance-feed"),
  scienceFeed: document.querySelector("#science-feed"),
  taskList: document.querySelector("#task-list"),
  weeklyReviewList: document.querySelector("#weekly-review-list"),
  homeView: document.querySelector("#home-view"),
  financeView: document.querySelector("#finance-view"),
  scienceView: document.querySelector("#science-view"),
  financeSearch: document.querySelector("#finance-search"),
  financeTagFilter: document.querySelector("#finance-tag-filter"),
  financeSourceFilter: document.querySelector("#finance-source-filter"),
  financeFavoriteFilter: document.querySelector("#finance-favorite-filter"),
  financeSortFilter: document.querySelector("#finance-sort-filter"),
  financeContentMeta: document.querySelector("#finance-content-meta"),
  financeContentGrid: document.querySelector("#finance-content-grid"),
  financeContentPagination: document.querySelector("#finance-content-pagination"),
  calendarCard: document.querySelector("#calendar-card"),
  githubCard: document.querySelector("#github-card"),
  githubCardLink: document.querySelector("#github-card-link"),
  financeFeedCard: document.querySelector("#finance-feed-card"),
  scienceFeedCard: document.querySelector("#science-feed-card"),
  githubWidgetDisplay: document.querySelector("#github-widget-display"),
  scienceSearch: document.querySelector("#science-search"),
  scienceTagFilter: document.querySelector("#science-tag-filter"),
  scienceSourceFilter: document.querySelector("#science-source-filter"),
  scienceFavoriteFilter: document.querySelector("#science-favorite-filter"),
  scienceSortFilter: document.querySelector("#science-sort-filter"),
  scienceContentMeta: document.querySelector("#science-content-meta"),
  scienceContentGrid: document.querySelector("#science-content-grid"),
  scienceContentPagination: document.querySelector("#science-content-pagination"),
  weatherCard: document.querySelector("#weather-card"),
  weatherWidgetDisplay: document.querySelector("#weather-widget-display"),
  stockCard: document.querySelector("#stock-card"),
  stockWidgetDisplay: document.querySelector("#stock-widget-display"),
  settingsModal: document.querySelector("#settings-modal"),
  settingsForm: document.querySelector("#settings-form"),
  settingsTitle: document.querySelector("#settings-title"),
  deleteTaskModal: document.querySelector("#delete-task-modal"),
  deleteTaskConfirm: document.querySelector("#delete-task-confirm"),
  archiveTaskModal: document.querySelector("#archive-task-modal"),
  archiveTaskConfirm: document.querySelector("#archive-task-confirm"),
  renameTaskModal: document.querySelector("#rename-task-modal"),
  renameTaskInput: document.querySelector("#rename-task-input"),
  renameTaskConfirm: document.querySelector("#rename-task-confirm"),
  weeklySummarySaveModal: document.querySelector("#weekly-summary-save-modal"),
  weeklySummarySaveConfirm: document.querySelector("#weekly-summary-save-confirm"),
  taskTimelineModal: document.querySelector("#task-timeline-modal"),
  taskTimelineTitle: document.querySelector("#task-timeline-title"),
  taskTimelineBody: document.querySelector("#task-timeline-body"),
  accountProfileModal: document.querySelector("#account-profile-modal"),
  accountProfileBody: document.querySelector("#account-profile-body"),
  changePasswordModal: document.querySelector("#change-password-modal"),
  changePasswordForm: document.querySelector("#change-password-form"),
  changePasswordFeedback: document.querySelector("#change-password-feedback"),
  clearAccountDataModal: document.querySelector("#clear-account-data-modal"),
  clearAccountDataConfirm: document.querySelector("#clear-account-data-confirm"),
  deleteAccountModal: document.querySelector("#delete-account-modal"),
  deleteAccountForm: document.querySelector("#delete-account-form"),
  deleteAccountFeedback: document.querySelector("#delete-account-feedback"),
  contentDetailModal: document.querySelector("#content-detail-modal"),
  contentDetailKicker: document.querySelector("#content-detail-kicker"),
  contentDetailTitle: document.querySelector("#content-detail-title"),
  contentDetailBody: document.querySelector("#content-detail-body"),
  contentSourceModal: document.querySelector("#content-source-modal"),
  contentSourceTitle: document.querySelector("#content-source-title"),
  contentSourceForm: document.querySelector("#content-source-form"),
  contentSourceList: document.querySelector("#content-source-list"),
  contentSourceId: document.querySelector("#content-source-id"),
};

const state = {
  data: loadData(),
  selectedDate: getTodayDateString(),
  selectedWeek: formatWeekInputValue(new Date()),
  selectedMonth: formatMonthValue(new Date()),
  activeAppTab: "home",
  activeCenterTab: "daily",
  reviewMode: "week",
  noteDrafts: {},
  taskNameDrafts: {},
  recentlyRestoredTaskIds: {},
  weeklyFilters: {
    taskId: "all",
    completion: "all",
    notes: "all",
    archive: "all",
  },
  weeklySummaryDrafts: {},
  weeklySummaryMode: {},
  newTaskColor: "",
  activePaletteTaskId: null,
  modal: { widget: null },
  deleteDialogTaskId: null,
  archiveDialogTaskId: null,
  renameDialogTaskId: null,
  weeklySummarySaveDialogOpen: false,
  taskTimelineTaskId: null,
  accountMenuOpen: false,
  accountProfile: null,
  accountProfileLoading: false,
  accountProfileModalOpen: false,
  changePasswordModalOpen: false,
  clearAccountDataModalOpen: false,
  deleteAccountModalOpen: false,
  changePasswordSubmitting: false,
  clearAccountDataSubmitting: false,
  deleteAccountSubmitting: false,
  saveStatusTone: "default",
  undoAction: null,
  remote: {
    status: "idle",
    apiBase: "",
    weeklyReview: null,
    connectedThisSession: false,
  },
  auth: {
    status: "idle",
    user: null,
    config: loadAuthConfig(),
    feedback: "",
  },
  content: {
    finance: createInitialContentChannelState("finance"),
    science: createInitialContentChannelState("science"),
    detailItem: null,
    sourceModalChannel: "",
    sourceEditingId: "",
  },
  pendingSync: loadPendingSyncStore(),
  widgetData: {
    github: {
      status: "idle",
      repos: [],
      url: "",
      message: "最近活跃仓库",
    },
    weather: loadWeatherCache(),
    stock: { status: "idle", symbols: [], message: "" },
  },
};

let remoteBootstrapPromise = null;
let taskListSortable = null;
let undoActionTimer = null;
let contentSearchDebounceTimer = null;

function setAppVisibility(isVisible) {
  elements.body.style.visibility = isVisible ? "" : "hidden";
}

function createEmptyTaskState(taskTypes) {
  return taskTypes.reduce((accumulator, task) => {
    accumulator[task.id] = { completed: false, notes: [] };
    return accumulator;
  }, {});
}

function createEmptyWeatherState() {
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

function loadWeatherCache() {
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

function saveWeatherCache(weather) {
  const next = {
    ...createEmptyWeatherState(),
    ...weather,
    forecast: Array.isArray(weather?.forecast) ? weather.forecast : [],
  };
  localStorage.setItem(WEATHER_CACHE_STORAGE_KEY, JSON.stringify(next));
}

function createEmptyDailyRecord(date, taskTypes) {
  const scopedTaskTypes =
    Array.isArray(taskTypes) && taskTypes.length
      ? taskTypes
      : getTaskTypesForDate(date);
  return {
    date,
    tasks: createEmptyTaskState(scopedTaskTypes),
    mood: "",
    dailySummary: "",
    updatedAt: "",
  };
}

function createInitialData() {
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
        weather: true,
        stock: true,
      },
      widgets: structuredClone(defaultWidgets),
    },
  };
}

function mergePreferences(preferences = {}) {
  const base = createInitialData().preferences;
  return {
    theme: normalizeThemePreference(preferences?.theme || base.theme),
    sidebar: {
      ...base.sidebar,
      ...(preferences?.sidebar || {}),
    },
    widgets: {
      github: {
        ...base.widgets.github,
        ...(preferences?.widgets?.github || {}),
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

function clearScopedStorage(scopeKey = LOCAL_SCOPE_KEY) {
  localStorage.removeItem(getScopedStorageKey(scopeKey));
}

function loadData(scopeKey = LOCAL_SCOPE_KEY) {
  try {
    const scopedRaw = localStorage.getItem(getScopedStorageKey(scopeKey));
    const raw = scopedRaw;
    if (!raw) {
      return createInitialData();
    }

    const parsed = JSON.parse(raw);
    const taskTypes = sanitizeTaskTypes(parsed.taskTypes);
    const base = createInitialData();

    return {
      version: STORAGE_VERSION,
      taskTypes,
      dailyRecords: migrateDailyRecords(parsed.dailyRecords, taskTypes),
      weeklySummaries: migrateWeeklySummaries(parsed.weeklySummaries),
      preferences: mergePreferences(parsed.preferences),
    };
  } catch (error) {
    console.warn("Failed to load dashboard data, resetting state.", error);
    return createInitialData();
  }
}

function persistScopedData(scopeKey, data) {
  localStorage.setItem(getScopedStorageKey(scopeKey), JSON.stringify(data));
}

function migrateWeeklySummaries(weeklySummaries) {
  if (!weeklySummaries || typeof weeklySummaries !== "object") {
    return {};
  }

  return Object.entries(weeklySummaries).reduce((accumulator, [week, summary]) => {
    if (!summary || typeof summary !== "object") {
      return accumulator;
    }
    accumulator[week] = {
      content: typeof summary.content === "string" ? summary.content : "",
      updatedAt: typeof summary.updatedAt === "string" ? summary.updatedAt : "",
    };
    return accumulator;
  }, {});
}

function loadAuthConfig() {
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

function loadSessionId() {
  return String(localStorage.getItem(SESSION_STORAGE_KEY) || "").trim();
}

function saveSessionId(sessionId) {
  if (!sessionId) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(SESSION_STORAGE_KEY, String(sessionId).trim());
}

function sanitizeTaskTypes(taskTypes) {
  if (!Array.isArray(taskTypes)) {
    return [];
  }

  if (taskTypes.length === 0) {
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

function isTaskArchived(task) {
  return Boolean(task?.archived);
}

function getActiveTaskTypes() {
  return state.data.taskTypes.filter((task) => !isTaskArchived(task));
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
    if (isTaskArchived(task)) {
      return hasWeeklyTaskHistory(aggregation, task.id);
    }
    return hasWeeklyTaskHistory(aggregation, task.id);
  });
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
    nextRecord.mood = typeof record?.mood === "string" ? record.mood : "";
    nextRecord.dailySummary =
      typeof record?.dailySummary === "string" ? record.dailySummary : "";
    migrated[date] = nextRecord;
  });

  return migrated;
}

function normalizeTaskIdentity(taskId, taskName = "", index = 0) {
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

function normalizeLegacyTaskMap(taskMap) {
  const remapped = {};
  Object.entries(taskMap).forEach(([taskId, value]) => {
    const normalizedIdentity = normalizeTaskIdentity(taskId);
    remapped[normalizedIdentity.id] = value;
  });
  return remapped;
}

function migrateTaskRecord(existing, updatedAt, date) {
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

function isMeaningfulTaskState(taskState) {
  if (!taskState || typeof taskState !== "object") {
    return false;
  }

  return (
    Boolean(taskState.completed) ||
    (Array.isArray(taskState.notes) && taskState.notes.length > 0)
  );
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

function saveData(message) {
  persistScopedData(getCurrentScopeKey(), state.data);
  setSaveStatus(message || `已自动保存 ${formatTime(new Date())}`);
}

function persistStateSilently() {
  persistScopedData(getCurrentScopeKey(), state.data);
}

function applyAccountPreferences(preferences, options = {}) {
  if (!preferences || typeof preferences !== "object") {
    return;
  }
  state.data.preferences = mergePreferences(preferences);
  persistStateSilently();
  if (options.applyTheme !== false) {
    applyTheme(state.data.preferences.theme);
  }
}

async function saveAccountPreferencesRemote() {
  if (!state.auth.user) {
    return state.data.preferences;
  }
  const payload = structuredClone(state.data.preferences);
  const response = await fetchApiJson("/api/account/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (response?.preferences) {
    applyAccountPreferences(response.preferences, { applyTheme: true });
  }
  return state.data.preferences;
}

function saveApiBase(baseUrl) {
  if (!baseUrl) {
    localStorage.removeItem(API_BASE_STORAGE_KEY);
    return;
  }
  localStorage.setItem(API_BASE_STORAGE_KEY, baseUrl);
}

function loadPendingSyncStore() {
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

function persistPendingSyncStore() {
  localStorage.setItem(
    PENDING_SYNC_STORAGE_KEY,
    JSON.stringify(state.pendingSync),
  );
}

function getPendingScopeKey() {
  return state.auth.user?.id || "";
}

function getPendingBucket(create = false) {
  const scopeKey = getPendingScopeKey();
  if (!scopeKey) {
    return null;
  }

  if (!state.pendingSync[scopeKey] && create) {
    state.pendingSync[scopeKey] = {
      taskUpserts: {},
      taskDeletes: {},
      dirtyRecords: {},
      weeklySummaryUpserts: {},
    };
  }

  return state.pendingSync[scopeKey] || null;
}

function hasPendingSync() {
  const bucket = getPendingBucket(false);
  if (!bucket) {
    return false;
  }
  return (
    Object.keys(bucket.taskUpserts || {}).length > 0 ||
    Object.keys(bucket.taskDeletes || {}).length > 0 ||
    Object.keys(bucket.dirtyRecords || {}).length > 0 ||
    Object.keys(bucket.weeklySummaryUpserts || {}).length > 0
  );
}

function markTaskUpsertPending(task) {
  const bucket = getPendingBucket(true);
  if (!bucket) {
    return;
  }
  bucket.taskUpserts[task.id] = {
    id: task.id,
    name: task.name,
    color: task.color,
    displayOrder: task.order,
    archived: Boolean(task.archived),
    archivedAt: task.archivedAt || null,
  };
  delete bucket.taskDeletes[task.id];
  persistPendingSyncStore();
}

function markTaskDeletePending(taskId) {
  const bucket = getPendingBucket(true);
  if (!bucket) {
    return;
  }
  if (bucket.taskUpserts[taskId]) {
    delete bucket.taskUpserts[taskId];
  } else {
    bucket.taskDeletes[taskId] = true;
  }
  persistPendingSyncStore();
}

function clearTaskPending(taskId) {
  const bucket = getPendingBucket(false);
  if (!bucket) {
    return;
  }
  delete bucket.taskUpserts[taskId];
  delete bucket.taskDeletes[taskId];
  persistPendingSyncStore();
}

function markRecordPending(date) {
  const bucket = getPendingBucket(true);
  if (!bucket) {
    return;
  }
  bucket.dirtyRecords[date] = true;
  persistPendingSyncStore();
}

function clearRecordPending(date) {
  const bucket = getPendingBucket(false);
  if (!bucket) {
    return;
  }
  delete bucket.dirtyRecords[date];
  persistPendingSyncStore();
}

function markWeeklySummaryPending(week, summary) {
  const bucket = getPendingBucket(true);
  if (!bucket) {
    return;
  }
  bucket.weeklySummaryUpserts[week] = {
    week,
    content: summary.content || "",
  };
  persistPendingSyncStore();
}

function clearWeeklySummaryPending(week) {
  const bucket = getPendingBucket(false);
  if (!bucket) {
    return;
  }
  delete bucket.weeklySummaryUpserts[week];
  persistPendingSyncStore();
}

async function flushPendingSync() {
  if (!isRemoteReady() || !state.auth.user) {
    return;
  }

  const bucket = getPendingBucket(false);
  if (!bucket) {
    return;
  }

  for (const task of Object.values(bucket.taskUpserts || {})) {
    await fetchApiJson(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: task.name,
        color: task.color,
        displayOrder: task.displayOrder,
        archived: Boolean(task.archived),
        archivedAt: task.archivedAt || null,
      }),
    }).catch(async (error) => {
      if (String(error.message || "").includes("404")) {
        await fetchApiJson("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(task),
        });
        return;
      }
      throw error;
    });
    clearTaskPending(task.id);
  }

  for (const taskId of Object.keys(bucket.taskDeletes || {})) {
    await fetchApiJson(`/api/tasks/${taskId}`, { method: "DELETE" });
    clearTaskPending(taskId);
  }

  for (const date of Object.keys(bucket.dirtyRecords || {})) {
    const record = ensureRecord(date);
    const payload = buildRemoteDailyPayload(record);
    await fetchApiJson(`/api/daily-records/${date}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    clearRecordPending(date);
  }

  for (const week of Object.keys(bucket.weeklySummaryUpserts || {})) {
    const summary = bucket.weeklySummaryUpserts[week];
    await fetchApiJson(`/api/weekly-summaries/${week}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: summary.content || "" }),
    });
    clearWeeklySummaryPending(week);
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

function getCurrentScopeKey() {
  return state.auth.user?.id || LOCAL_SCOPE_KEY;
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

function redirectToLoginPage() {
  window.location.href = "./login.html";
}

function render() {
  applyTheme(state.data.preferences.theme);
  renderTopTabs();
  renderCenterTabs();
  renderControls();
  renderCalendar();
  renderFeeds();
  renderContentStreams();
  renderTaskList();
  renderWeeklyReview();
  renderWidgets();
  renderSidebarCards();
  renderModal();
  renderDeleteTaskModal();
  renderArchiveTaskModal();
  renderRenameTaskModal();
  renderWeeklySummarySaveModal();
  renderTaskTimelineModal();
  renderAccountMenu();
  renderAccountProfileModal();
  renderChangePasswordModal();
  renderClearAccountDataModal();
  renderDeleteAccountModal();
  renderContentDetailModal();
  renderContentSourceModal();
  applyButtonTooltips();
}

function applyButtonTooltips() {
  document.querySelectorAll("button").forEach((button) => {
    const explicitTooltip = button.dataset.tooltip || "";
    const ariaLabel = button.getAttribute("aria-label") || "";
    const buttonText = button.textContent
      .replace(/\b[a-z]+_[a-z_]+\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const tooltip =
      explicitTooltip ||
      ariaLabel ||
      (buttonText && buttonText !== "settings" ? buttonText : "");

    if (tooltip) {
      button.title = tooltip;
    }
  });
}

function renderTopTabs() {
  elements.topTabs.forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.appTab === state.activeAppTab,
    );
  });
  elements.homeView.hidden = state.activeAppTab !== "home";
  elements.financeView.hidden = state.activeAppTab !== "finance";
  elements.scienceView.hidden = state.activeAppTab !== "science";
}

function getContentChannelState(channel) {
  return channel === "science" ? state.content.science : state.content.finance;
}

async function ensureContentChannelLoaded(channel, options = {}) {
  if (!state.auth.user || !["finance", "science"].includes(channel)) {
    return;
  }
  const contentState = getContentChannelState(channel);
  const jobs = [];
  if (options.refreshFeatured || (!contentState.featured.length && !contentState.loading)) {
    jobs.push(loadFeaturedContent(channel));
  }
  if (options.force || !contentState.loaded) {
    jobs.push(loadChannelContent(channel));
  }
  if (!jobs.length) {
    return;
  }
  await Promise.all(jobs);
}

function renderCenterTabs() {
  const centerTabs = document.querySelector(".center-tabs");
  if (centerTabs) {
    centerTabs.dataset.activeTab = state.activeCenterTab;
  }
  elements.centerTabs.forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.centerTab === state.activeCenterTab,
    );
  });
  document
    .querySelector("#daily-panel")
    .classList.toggle("is-active", state.activeCenterTab === "daily");
  document
    .querySelector("#weekly-panel")
    .classList.toggle("is-active", state.activeCenterTab === "weekly");
}

function renderControls() {
  const record = ensureRecord(state.selectedDate);
  elements.todayCompletedCount.textContent = `${getCompletedCount(record)} / ${getActiveTaskTypes().length}`;
  document
    .querySelector(".theme-switcher")
    ?.setAttribute("data-active-theme", state.data.preferences.theme);
  renderWeeklyRangeOptions();
  renderMonthlyRangeOptions();
  elements.weeklyRangePicker.hidden = state.reviewMode !== "week";
  elements.monthlyRangePicker.hidden = state.reviewMode !== "month";
  elements.reviewRangeLabel.textContent =
    state.reviewMode === "month" ? "月范围" : "周范围";
  elements.weeklyRangePicker.value = state.selectedWeek;
  elements.monthlyRangePicker.value = state.selectedMonth;
  elements.weeklyModeWeek.classList.toggle("is-active", state.reviewMode === "week");
  elements.weeklyModeMonth.classList.toggle("is-active", state.reviewMode === "month");
  document
    .querySelector(".weekly-mode-toggle")
    ?.setAttribute("data-active-mode", state.reviewMode);
  renderWeeklyFilterOptions();
  elements.weeklyTaskFilter.value = state.weeklyFilters.taskId;
  elements.weeklyCompletionFilter.value = state.weeklyFilters.completion;
  elements.weeklyNotesFilter.value = state.weeklyFilters.notes;
  elements.weeklyArchiveFilter.value = state.weeklyFilters.archive;
  elements.weeklySummaryInput.value = getWeeklySummaryDraft(state.selectedWeek);
  renderWeeklySummaryContent();
  renderWeeklySummaryMeta();
  renderSaveStatusState();

  elements.themeOptions.forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.theme === state.data.preferences.theme,
    );
  });
  renderCloudStatusChip();
  renderAuthStatusChip();
  renderAccountMenu();
}

function renderWeeklyFilterOptions() {
  elements.weeklyTaskFilter.innerHTML = [
    '<option value="all">全部任务</option>',
    ...state.data.taskTypes.map(
      (task) =>
        `<option value="${escapeAttribute(task.id)}">${escapeHtml(task.name)}</option>`,
    ),
  ].join("");
}

function getWeeklySummaryDraft(week) {
  if (typeof state.weeklySummaryDrafts[week] === "string") {
    return state.weeklySummaryDrafts[week];
  }
  return state.data.weeklySummaries[week]?.content || "";
}

function getWeeklySummaryMode(week) {
  if (typeof state.weeklySummaryMode[week] === "string") {
    return state.weeklySummaryMode[week];
  }
  return state.data.weeklySummaries[week]?.content ? "view" : "edit";
}

function setWeeklySummaryMode(week, mode) {
  if (!week) {
    return;
  }
  state.weeklySummaryMode[week] = mode;
}

function renderWeeklySummaryContent() {
  const savedContent = state.data.weeklySummaries[state.selectedWeek]?.content || "";
  const hasSavedContent = Boolean(savedContent);
  const isViewMode =
    hasSavedContent && getWeeklySummaryMode(state.selectedWeek) === "view";

  elements.weeklySummaryInput.hidden = isViewMode;
  elements.weeklySummaryDisplay.hidden = !isViewMode;
  elements.weeklySummaryDisplay.textContent = savedContent;
  elements.weeklySummaryEdit.hidden = !hasSavedContent || !isViewMode;
  elements.weeklySummarySave.hidden = isViewMode;
  elements.weeklySummarySave.textContent = "保存总结";

  elements.weeklySummaryCard.classList.toggle("is-empty", !hasSavedContent);
  elements.weeklySummaryCard.classList.toggle(
    "is-editing",
    hasSavedContent && !isViewMode,
  );
  elements.weeklySummaryCard.classList.toggle("is-saved", isViewMode);
}

function renderWeeklySummaryMeta() {
  if (!elements.weeklySummaryMeta) {
    return;
  }

  const savedSummary = state.data.weeklySummaries[state.selectedWeek];
  const savedContent = savedSummary?.content || "";
  const draftContent = getWeeklySummaryDraft(state.selectedWeek);
  const hasUnsavedChanges = draftContent !== savedContent;

  let metaText = `当前周：${formatWeekRangeText(state.selectedWeek)}`;
  if (savedSummary?.updatedAt) {
    metaText += ` · 已保存 ${formatDateTime(savedSummary.updatedAt)}`;
  } else {
    metaText += " · 尚未保存";
  }
  if (hasUnsavedChanges) {
    metaText += " · 有未保存修改";
  }

  elements.weeklySummaryMeta.textContent = metaText;
  elements.weeklySummaryMeta.classList.toggle("is-dirty", hasUnsavedChanges);
}

function renderWeeklyRangeOptions() {
  const options = getWeeklyRangeOptions();
  const fallbackWeek = options[options.length - 1]?.value || state.selectedWeek;
  if (!options.some((option) => option.value === state.selectedWeek)) {
    state.selectedWeek = fallbackWeek;
  }

  elements.weeklyRangePicker.innerHTML = options
    .map(
      (option) => `
        <option value="${option.value}">${escapeHtml(option.label)}</option>
      `,
    )
    .join("");
}

function renderMonthlyRangeOptions() {
  const options = getMonthlyRangeOptions();
  const fallbackMonth = options[options.length - 1]?.value || state.selectedMonth;
  if (!options.some((option) => option.value === state.selectedMonth)) {
    state.selectedMonth = fallbackMonth;
  }

  elements.monthlyRangePicker.innerHTML = options
    .map(
      (option) => `
        <option value="${option.value}">${escapeHtml(option.label)}</option>
      `,
    )
    .join("");
}

function renderCloudStatusChip() {
  const chip = elements.cloudStatusChip;
  if (!chip) {
    return;
  }
  chip.className = "status-chip";

  if (
    state.auth.user &&
    state.remote.connectedThisSession &&
    state.remote.status !== "offline"
  ) {
    chip.classList.add("is-cloud");
    chip.textContent = "云端已连接";
    return;
  }

  if (state.remote.status === "ready") {
    chip.classList.add("is-cloud");
    chip.textContent = "云端已连接";
    return;
  }

  if (state.remote.status === "connecting") {
    chip.classList.add("is-syncing");
    chip.textContent = "正在连接";
    return;
  }

  if (state.remote.status === "sync-error") {
    chip.classList.add("is-error");
    chip.textContent = "云端异常";
    return;
  }

  chip.classList.add("is-local");
  chip.textContent = "本地模式";
}

function renderAuthStatusChip() {
  const chip = elements.authStatusChip;
  chip.className = "status-chip";
  chip.disabled = !state.auth.user;
  chip.setAttribute("aria-expanded", state.accountMenuOpen ? "true" : "false");

  if (state.auth.status === "ready" && state.auth.user?.username) {
    chip.classList.add("account-chip");
    if (state.remote.status === "connecting") {
      chip.classList.add("is-syncing");
    } else if (state.remote.status === "ready") {
      chip.classList.add("is-cloud");
    } else if (state.remote.status === "sync-error" || state.remote.status === "offline") {
      chip.classList.add("is-error");
    }
    chip.textContent = state.auth.user.username;
    elements.authAction.textContent = "退出登录";
    return;
  }

  if (state.auth.status === "authenticating") {
    chip.classList.add("is-syncing");
    chip.textContent = "登录中";
    elements.authAction.textContent = "云端登录";
    return;
  }

  if (state.auth.status === "creating-account") {
    chip.classList.add("is-syncing");
    chip.textContent = "创建中";
    elements.authAction.textContent = "云端登录";
    return;
  }

  chip.classList.add("account-chip");
  chip.textContent = "未登录";
  elements.authAction.textContent = "云端登录";
}

function renderAccountMenu() {
  if (!elements.accountMenu) {
    return;
  }
  const shouldShow = Boolean(state.auth.user && state.accountMenuOpen);
  elements.accountMenu.hidden = !shouldShow;
}

function getSidebarPreferences() {
  return state.data.preferences?.sidebar || createInitialData().preferences.sidebar;
}

function renderSidebarCards() {
  const sidebar = getSidebarPreferences();
  if (elements.calendarCard) {
    elements.calendarCard.hidden = !sidebar.calendar;
  }
  if (elements.githubCard) {
    elements.githubCard.hidden = !sidebar.github;
  }
  if (elements.financeFeedCard) {
    elements.financeFeedCard.hidden = !sidebar.financeFeed;
  }
  if (elements.scienceFeedCard) {
    elements.scienceFeedCard.hidden = !sidebar.scienceFeed;
  }
  if (elements.weatherCard) {
    elements.weatherCard.hidden = !sidebar.weather;
  }
  if (elements.stockCard) {
    elements.stockCard.hidden = !sidebar.stock;
  }
}

function renderAccountProfileModal() {
  const modal = elements.accountProfileModal;
  if (!modal) {
    return;
  }
  if (!state.accountProfileModalOpen) {
    modal.hidden = true;
    return;
  }
  modal.hidden = false;
  if (state.accountProfileLoading) {
    elements.accountProfileBody.innerHTML =
      '<div class="delete-task-dialog-copy">正在加载账号资料...</div>';
    return;
  }
  const profile = state.accountProfile;
  if (!profile?.user) {
    elements.accountProfileBody.innerHTML =
      '<div class="delete-task-dialog-copy">暂时无法读取当前账号资料。</div>';
    return;
  }
  const createdAt = profile.user.createdAt
    ? formatDateTime(profile.user.createdAt)
    : "--";
  const sidebar = getSidebarPreferences();
  const githubProfileUrl = String(state.data.preferences.widgets.github?.profileUrl || "").trim();
  elements.accountProfileBody.innerHTML = `
    <div class="account-profile-grid">
      <div class="account-profile-item">
        <span class="account-profile-label">用户名</span>
        <strong>${escapeHtml(profile.user.username || "--")}</strong>
      </div>
      <div class="account-profile-item">
        <span class="account-profile-label">创建时间</span>
        <strong>${escapeHtml(createdAt)}</strong>
      </div>
    </div>
    <div class="account-profile-stats">
      <div class="account-profile-stat">
        <span>任务数</span>
        <strong>${Number(profile.counts?.tasks || 0)}</strong>
      </div>
      <div class="account-profile-stat">
        <span>每日记录</span>
        <strong>${Number(profile.counts?.dailyRecords || 0)}</strong>
      </div>
      <div class="account-profile-stat">
        <span>周总结</span>
        <strong>${Number(profile.counts?.weeklySummaries || 0)}</strong>
      </div>
    </div>
    <form id="account-preferences-form" class="account-form account-preferences-form">
      <div class="account-profile-item">
        <span class="account-profile-label">面板开关</span>
        <div class="account-card-toggle-list">
          <label class="account-card-toggle"><input type="checkbox" name="calendar" ${sidebar.calendar ? "checked" : ""} /> <span>日历</span></label>
          <label class="account-card-toggle"><input type="checkbox" name="github" ${sidebar.github ? "checked" : ""} /> <span>GitHub</span></label>
          <label class="account-card-toggle"><input type="checkbox" name="financeFeed" ${sidebar.financeFeed ? "checked" : ""} /> <span>Finance</span></label>
          <label class="account-card-toggle"><input type="checkbox" name="scienceFeed" ${sidebar.scienceFeed ? "checked" : ""} /> <span>Science</span></label>
          <label class="account-card-toggle"><input type="checkbox" name="weather" ${sidebar.weather ? "checked" : ""} /> <span>天气</span></label>
          <label class="account-card-toggle"><input type="checkbox" name="stock" ${sidebar.stock ? "checked" : ""} /> <span>股票</span></label>
        </div>
      </div>
      <div class="delete-task-dialog-actions">
        <button type="submit" class="settings-save">保存面板设置</button>
      </div>
    </form>
  `;
}

function renderChangePasswordModal() {
  const modal = elements.changePasswordModal;
  if (!modal) {
    return;
  }
  modal.hidden = !state.changePasswordModalOpen;
  if (!modal.hidden) {
    elements.changePasswordFeedback.textContent = state.auth.feedback || "修改后请使用新密码登录。";
    const submit = document.querySelector("#change-password-submit");
    if (submit) {
      submit.disabled = state.changePasswordSubmitting;
      submit.textContent = state.changePasswordSubmitting ? "保存中..." : "保存密码";
    }
  }
}

function renderClearAccountDataModal() {
  const modal = elements.clearAccountDataModal;
  if (!modal) {
    return;
  }
  modal.hidden = !state.clearAccountDataModalOpen;
  elements.clearAccountDataConfirm.disabled = state.clearAccountDataSubmitting;
  elements.clearAccountDataConfirm.textContent = state.clearAccountDataSubmitting
    ? "清空中..."
    : "确认清空";
}

function renderDeleteAccountModal() {
  const modal = elements.deleteAccountModal;
  if (!modal) {
    return;
  }
  modal.hidden = !state.deleteAccountModalOpen;
  if (!modal.hidden) {
    elements.deleteAccountFeedback.textContent =
      state.auth.feedback || "删除账号前，请先输入当前密码确认。";
    const submit = document.querySelector("#delete-account-submit");
    if (submit) {
      submit.disabled = state.deleteAccountSubmitting;
      submit.textContent = state.deleteAccountSubmitting ? "删除中..." : "删除账号";
    }
  }
}
function renderCalendar() {
  const date = parseLocalDate(state.selectedDate);
  const month = date.getMonth();
  const firstCell = getStartOfWeek(new Date(date.getFullYear(), month, 1));
  const cells = [];

  elements.calendarMonthLabel.textContent = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
  }).format(date);

  for (
    let current = new Date(firstCell);
    cells.length < 42;
    current = addDays(current, 1)
  ) {
    const currentKey = formatDateKey(current);
    cells.push(`
      <button
        type="button"
        class="calendar-day ${current.getMonth() === month ? "" : "is-muted"} ${
          currentKey === state.selectedDate ? "is-selected" : ""
        }"
        data-calendar-date="${currentKey}"
      >
        ${current.getDate()}
      </button>
    `);
  }

  elements.calendarGrid.innerHTML = cells.join("");
}

function renderFeeds() {
  renderFeedInto(elements.financeFeed, state.content.finance.featured, "finance");
  renderFeedInto(elements.scienceFeed, state.content.science.featured, "science");
}

function renderFeedInto(container, items, channel) {
  if (!Array.isArray(items) || items.length === 0) {
    container.innerHTML = placeholderFeeds[channel]
      .map(
        (item) => `
          <article class="feed-item">
            <p class="feed-meta">${item.meta}</p>
            <h3>${item.title}</h3>
          </article>
        `,
      )
      .join("");
    return;
  }
  container.innerHTML = items
    .map(
      (item) => `
        <article class="feed-item">
          <h3>
            <a href="${escapeAttribute(getSafeContentLink(item) || "#")}" target="_blank" rel="noreferrer">
              ${escapeHtml(item.title)}
            </a>
          </h3>
          <p class="feed-meta">${escapeHtml(formatFeedMeta(item))}</p>
        </article>
      `,
    )
    .join("");
}

function formatFeedMeta(item) {
  const parts = [];
  if (item.source_name) {
    parts.push(item.source_name);
  }
  if (item.published_at) {
    parts.push(formatDateTime(item.published_at));
  }
  return parts.join(" // ");
}

function getSafeContentLink(item) {
  const candidates = [item?.canonical_url, item?.source_url];
  return candidates.find((value) => /^https?:\/\//i.test(String(value || "").trim())) || "";
}

function buildMockContent(channel) {
  const base = mockContentCatalog[channel] || [];
  return Array.from({ length: 30 }, (_, index) => {
    const item = base[index % base.length];
    const publishedAt = new Date(Date.now() - index * 6 * 60 * 60 * 1000).toISOString();
    const externalUrl = `https://example.com/${channel}/${index + 1}`;
    return {
      id: `mock-${channel}-${index + 1}`,
      channel,
      title: item[0],
      summary_zh: item[1],
      summary_raw: `${item[1]} 这是用于前端联调的完整示例内容，后续接入真实 RSS 后，这里会替换成更长的正文摘要、原始描述或正文摘录。`,
      body_zh: `${item[1]}\n\n这是用于前端联调的完整示例内容，后续接入真实 RSS 后，这里会替换成更长的正文摘录，用于详情页阅读。`,
      body_raw: `${item[1]} This is a mock long-form body used for frontend integration testing before the real RSS pipeline is fully connected.`,
      source_name: item[2],
      source_url: externalUrl,
      canonical_url: externalUrl,
      author: channel === "science" ? "编辑部" : "市场编辑",
      published_at: publishedAt,
      fetched_at: publishedAt,
      content_type: item[3],
      tags: [
        channel === "science" ? "研究" : "市场",
        item[3],
      ],
      lang: "zh",
      is_featured: index < 3,
      is_favorite: false,
    };
  });
}

function getMockContentPayload(channel, currentState) {
  let items = buildMockContent(channel);
  const search = String(currentState.search || "").trim().toLowerCase();
  if (search) {
    items = items.filter((item) => {
      return [item.title, item.summary_zh, item.body_zh, item.source_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }
  if (currentState.tag !== "all") {
    items = items.filter((item) => Array.isArray(item.tags) && item.tags.includes(currentState.tag));
  }
  if (currentState.sourceId !== "all") {
    items = items.filter((item) => item.source_name === currentState.sourceId);
  }
  if (currentState.favoriteFilter === "favorites") {
    items = items.filter((item) => item.is_favorite);
  }
  if (currentState.sort === "oldest") {
    items = [...items].reverse();
  }
  const total = items.length;
  const page = Math.max(1, Number(currentState.page || 1));
  const start = (page - 1) * currentState.pageSize;
  const pagedItems = items.slice(start, start + currentState.pageSize);
  return {
    items: pagedItems,
    total,
    page,
    pageSize: currentState.pageSize,
    tags: [...new Set(items.flatMap((item) => item.tags || []))],
    sources: [...new Set(items.map((item) => item.source_name))].map((name) => ({
      id: name,
      name,
    })),
  };
}

function getContentElements(channel) {
  if (channel === "finance") {
    return {
      search: elements.financeSearch,
      tagFilter: elements.financeTagFilter,
      sourceFilter: elements.financeSourceFilter,
      favoriteFilter: elements.financeFavoriteFilter,
      sortFilter: elements.financeSortFilter,
      meta: elements.financeContentMeta,
      grid: elements.financeContentGrid,
      pagination: elements.financeContentPagination,
    };
  }
  return {
    search: elements.scienceSearch,
    tagFilter: elements.scienceTagFilter,
    sourceFilter: elements.scienceSourceFilter,
    favoriteFilter: elements.scienceFavoriteFilter,
    sortFilter: elements.scienceSortFilter,
    meta: elements.scienceContentMeta,
    grid: elements.scienceContentGrid,
    pagination: elements.scienceContentPagination,
  };
}

function renderContentStreams() {
  renderContentChannel("finance");
  renderContentChannel("science");
}

function renderContentChannel(channel) {
  const contentState = state.content[channel];
  const channelElements = getContentElements(channel);
  if (!channelElements.grid) {
    return;
  }

  channelElements.search.value = contentState.search;
  channelElements.sortFilter.value = contentState.sort;
  channelElements.favoriteFilter.value = contentState.favoriteFilter;
  channelElements.tagFilter.innerHTML = [
    '<option value="all">全部标签</option>',
    ...contentState.tags.map((tag) => `<option value="${escapeAttribute(tag)}">${escapeHtml(tag)}</option>`),
  ].join("");
  channelElements.sourceFilter.innerHTML = [
    '<option value="all">全部来源</option>',
    ...contentState.sources.map(
      (source) => `<option value="${escapeAttribute(source.id)}">${escapeHtml(source.name)}</option>`,
    ),
  ].join("");
  channelElements.tagFilter.value = contentState.tag;
  channelElements.sourceFilter.value = contentState.sourceId;
  channelElements.meta.textContent = contentState.meta || getContentMetaText(contentState);

  if (contentState.loading && contentState.items.length === 0) {
    channelElements.grid.innerHTML = '<div class="content-empty-state">正在加载资讯...</div>';
    channelElements.pagination.innerHTML = "";
    return;
  }

  if (contentState.error && contentState.items.length === 0) {
    channelElements.grid.innerHTML = `<div class="content-empty-state">${escapeHtml(contentState.error)}</div>`;
    channelElements.pagination.innerHTML = "";
    return;
  }

  if (contentState.items.length === 0) {
    channelElements.grid.innerHTML = '<div class="content-empty-state">暂无资讯，试试手动刷新或添加信源。</div>';
    channelElements.pagination.innerHTML = "";
    return;
  }

  channelElements.grid.innerHTML = contentState.items
    .map(
      (item) => `
        <article class="content-card ${item.is_favorite ? "is-favorited" : ""}" data-content-open="${escapeAttribute(item.id)}">
          <div class="content-card-main">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.summary_zh || "暂无摘要。")}</p>
            <div class="content-card-footer">
              <span>${escapeHtml(item.source_name || "未知来源")}</span>
              <span>${escapeHtml(item.author || "未知作者")}</span>
              <span>${escapeHtml(formatDateTime(item.published_at || item.fetched_at))}</span>
            </div>
          </div>
          <div class="content-card-side">
            <button
              type="button"
              class="content-favorite-button ${item.is_favorite ? "is-active" : ""}"
              data-content-favorite="${escapeAttribute(item.id)}"
              aria-label="${item.is_favorite ? "取消收藏" : "收藏资讯"}"
            >
              ${item.is_favorite ? "取消收藏" : "收藏"}
            </button>
            ${
              Array.isArray(item.tags) && item.tags.length
                ? `<div class="content-card-tags">${item.tags
                    .slice(0, 4)
                    .map((tag) => `<span class="content-tag">${escapeHtml(tag)}</span>`)
                    .join("")}</div>`
                : '<div class="content-card-tags"><span class="content-tag">资讯</span></div>'
            }
          </div>
        </article>
      `,
    )
    .join("");

  const totalPages = Math.max(1, Math.ceil(contentState.total / contentState.pageSize));
  channelElements.pagination.innerHTML = `
    <button type="button" class="task-cancel-action" data-content-page="${channel}:${contentState.page - 1}" ${
      contentState.page <= 1 ? "disabled" : ""
    }>上一页</button>
    <span class="content-page-indicator">第 ${contentState.page} / ${totalPages} 页</span>
    <button type="button" class="task-cancel-action" data-content-page="${channel}:${contentState.page + 1}" ${
      contentState.page >= totalPages ? "disabled" : ""
    }>下一页</button>
  `;
}

function getContentMetaText(contentState) {
  if (contentState.loading) {
    return "正在同步最新资讯...";
  }
  if (contentState.usingMock) {
    return `当前显示测试资讯 · 每页 ${contentState.pageSize} 条`;
  }
  if (contentState.favoriteFilter === "favorites") {
    return contentState.total
      ? `共 ${contentState.total} 条收藏资讯 · 每页 ${contentState.pageSize} 条`
      : "当前没有收藏资讯。";
  }
  const total = Number(contentState.total || 0);
  if (!total) {
    return "当前暂无缓存资讯，请手动刷新。";
  }
  return `共 ${total} 条资讯 · 每页 ${contentState.pageSize} 条`;
}

function renderContentDetailModal() {
  if (!elements.contentDetailModal || !elements.contentDetailBody || !elements.contentDetailTitle) {
    return;
  }
  const item = state.content.detailItem;
  elements.contentDetailModal.hidden = !item;
  if (!item) {
    elements.contentDetailTitle.textContent = "资讯详情";
    elements.contentDetailKicker.textContent = "Article";
    elements.contentDetailBody.innerHTML = "";
    return;
  }
  elements.contentDetailKicker.textContent = item.channel === "science" ? "Science insight" : "Finance insight";
  elements.contentDetailTitle.textContent = item.title;
  const contentLink = getSafeContentLink(item);
  const favoriteButton = `
    <button
      type="button"
      class="content-favorite-button ${item.is_favorite ? "is-active" : ""}"
      data-content-favorite="${escapeAttribute(item.id)}"
      aria-label="${item.is_favorite ? "取消收藏" : "收藏资讯"}"
    >
      ${item.is_favorite ? "取消收藏" : "收藏"}
    </button>
  `;
  const fullBody = item.body_zh || item.body_raw || item.summary_raw || item.summary_zh || "暂无内容。";
  const leadSummary =
    item.summary_zh && item.summary_zh !== fullBody ? item.summary_zh : "";
  elements.contentDetailBody.innerHTML = `
    <div class="content-detail-meta">
      <span>${escapeHtml(item.source_name || "未知来源")}</span>
      <span>${escapeHtml(item.author || "未知作者")}</span>
      <span>${escapeHtml(item.content_type || "资讯")}</span>
      <span>${escapeHtml(formatDateTime(item.published_at || item.fetched_at))}</span>
    </div>
    ${
      Array.isArray(item.tags) && item.tags.length
        ? `<div class="content-card-tags">${item.tags
            .map((tag) => `<span class="content-tag">${escapeHtml(tag)}</span>`)
            .join("")}</div>`
        : ""
    }
    <div class="content-detail-summary">
      <h3>正文内容</h3>
      ${
        leadSummary
          ? `<p class="content-detail-lead">${escapeHtml(leadSummary)}</p>`
          : ""
      }
      <p>${escapeHtml(fullBody)}</p>
    </div>
    <div class="content-detail-actions">
      ${favoriteButton}
      ${
        contentLink
          ? `<button type="button" class="settings-save content-link-button" data-content-open-link="${escapeAttribute(contentLink)}">
              打开官网原文
            </button>`
          : `<button type="button" class="task-cancel-action" disabled>暂无官网原文链接</button>`
      }
    </div>
  `;
}

function renderContentSourceModal() {
  if (!elements.contentSourceModal || !elements.contentSourceList || !elements.contentSourceTitle) {
    return;
  }
  const channel = state.content.sourceModalChannel;
  elements.contentSourceModal.hidden = !channel;
  if (!channel) {
    return;
  }
  const channelLabel = channel === "science" ? "Science" : "Finance";
  elements.contentSourceTitle.textContent = `${channelLabel} 信源管理`;
  const sources = state.content[channel].sources || [];
  const editingSource = sources.find((source) => source.id === state.content.sourceEditingId) || null;
  if (elements.contentSourceForm) {
    elements.contentSourceForm.dataset.channel = channel;
    elements.contentSourceId.value = editingSource?.id || "";
    elements.contentSourceForm.elements.name.value = editingSource?.name || "";
    elements.contentSourceForm.elements.type.value = editingSource?.type || "rss";
    elements.contentSourceForm.elements.url.value = editingSource?.url || "";
    elements.contentSourceForm.elements.parserKey.value = editingSource?.parser_key || "";
    elements.contentSourceForm.elements.enabled.value = String(
      typeof editingSource?.enabled === "boolean" ? editingSource.enabled : true,
    );
  }
  elements.contentSourceList.innerHTML = sources.length
    ? sources
        .map(
          (source) => `
            <article class="content-source-item">
              <div>
                <strong>${escapeHtml(source.name)}</strong>
                <p>${escapeHtml(source.url)}</p>
                <span class="feed-meta">${escapeHtml(source.type)} · ${source.enabled ? "已启用" : "已停用"}</span>
              </div>
              <div class="content-source-item-actions">
                <button type="button" class="task-cancel-action" data-content-source-edit="${escapeAttribute(source.id)}">编辑</button>
                ${
                  source.is_default
                    ? ""
                    : `<button type="button" class="delete-task" data-content-source-delete="${escapeAttribute(source.id)}">删除</button>`
                }
              </div>
            </article>
          `,
        )
        .join("")
    : '<div class="content-empty-state">当前没有可用信源。</div>';
}

async function loadFeaturedContent(channel) {
  if (!state.auth.user) {
    return;
  }
  try {
    const payload = await fetchApiJson(`/api/content/featured?channel=${channel}&limit=3`);
    state.content[channel].featured = Array.isArray(payload?.items) ? payload.items : [];
    state.content[channel].usingMock = false;
    renderFeeds();
  } catch (error) {
    console.warn(`Failed to load ${channel} featured content.`, error);
    if (error?.message === "Request failed: 404") {
      state.content[channel].featured = buildMockContent(channel).slice(0, 3);
      state.content[channel].usingMock = true;
      renderFeeds();
    }
  }
}

async function loadChannelContent(channel, options = {}) {
  if (!state.auth.user) {
    return;
  }
  const contentState = state.content[channel];
  if (!contentState) {
    return;
  }
  if (typeof options.page === "number") {
    contentState.page = options.page;
  }
  if (typeof options.search === "string") {
    contentState.search = options.search;
  }
  if (typeof options.tag === "string") {
    contentState.tag = options.tag;
  }
  if (typeof options.sourceId === "string") {
    contentState.sourceId = options.sourceId;
  }
  if (typeof options.favorite === "string") {
    contentState.favoriteFilter = options.favorite;
  }
  if (typeof options.sort === "string") {
    contentState.sort = options.sort;
  }
  contentState.loading = true;
  contentState.error = "";
  contentState.meta = "正在加载资讯...";
  renderContentChannel(channel);

  try {
    const params = new URLSearchParams({
      channel,
      page: String(contentState.page),
      pageSize: String(contentState.pageSize),
      sort: contentState.sort,
    });
    if (contentState.search) {
      params.set("q", contentState.search);
    }
    if (contentState.tag !== "all") {
      params.set("tag", contentState.tag);
    }
    if (contentState.sourceId !== "all") {
      params.set("sourceId", contentState.sourceId);
    }
    if (contentState.favoriteFilter !== "all") {
      params.set("favorite", contentState.favoriteFilter);
    }
    const payload = await fetchApiJson(`/api/content?${params.toString()}`);
    contentState.items = Array.isArray(payload?.items) ? payload.items : [];
    contentState.total = Number(payload?.total || 0);
    contentState.page = Number(payload?.page || contentState.page);
    contentState.tags = Array.isArray(payload?.tags) ? payload.tags : [];
    contentState.sources = Array.isArray(payload?.sources) ? payload.sources : [];
    contentState.loaded = true;
    contentState.usingMock = false;
    contentState.meta = getContentMetaText(contentState);
  } catch (error) {
    console.warn(`Failed to load ${channel} content.`, error);
    if (error?.message === "Request failed: 404") {
      const mockPayload = getMockContentPayload(channel, contentState);
      contentState.items = mockPayload.items;
      contentState.total = mockPayload.total;
      contentState.page = mockPayload.page;
      contentState.tags = mockPayload.tags;
      contentState.sources = mockPayload.sources;
      contentState.loaded = true;
      contentState.usingMock = true;
      contentState.error = "";
      contentState.meta = getContentMetaText(contentState);
    } else {
      contentState.error = error?.message || "资讯加载失败";
    }
  } finally {
    contentState.loading = false;
    renderContentChannel(channel);
  }
}

async function refreshChannelContentManually(channel) {
  const contentState = state.content[channel];
  if (!contentState || contentState.refreshing) {
    return;
  }
  contentState.refreshing = true;
  contentState.meta = "正在刷新资讯...";
  renderContentChannel(channel);
  try {
    await fetchApiJson("/api/content/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, limit: CONTENT_PAGE_SIZE + 6 }),
    });
    await Promise.all([loadChannelContent(channel), loadFeaturedContent(channel)]);
    setSaveStatus(`${channel === "science" ? "Science" : "Finance"} 资讯已刷新`, "success");
  } catch (error) {
    console.warn(`Failed to refresh ${channel} content.`, error);
    contentState.error = error?.message || "资讯刷新失败";
    setSaveStatus(contentState.error);
    renderContentChannel(channel);
  } finally {
    contentState.refreshing = false;
  }
}

function queueContentSearch(channel, value) {
  const nextSearch = String(value || "").trim();
  window.clearTimeout(contentSearchDebounceTimer);
  contentSearchDebounceTimer = window.setTimeout(() => {
    void loadChannelContent(channel, {
      page: 1,
      search: nextSearch,
    });
  }, 220);
}

function findLocalContentItem(itemId) {
  return [
    ...state.content.finance.items,
    ...state.content.finance.featured,
    ...state.content.science.items,
    ...state.content.science.featured,
  ].find((item) => item.id === itemId);
}

async function toggleContentFavorite(itemId) {
  if (!itemId || !state.auth.user) {
    return;
  }
  const item = findLocalContentItem(itemId) || state.content.detailItem;
  if (!item) {
    return;
  }
  try {
    if (item.is_favorite) {
      await fetchApiJson(
        `/api/content/favorites?channel=${encodeURIComponent(item.channel)}&canonicalUrl=${encodeURIComponent(item.canonical_url)}`,
        { method: "DELETE" },
      );
      setSaveStatus("已取消收藏", "success");
    } else {
      await fetchApiJson("/api/content/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          channel: item.channel,
          source_id: item.source_id || "",
          title: item.title,
          summary_zh: item.summary_zh || "",
          summary_raw: item.summary_raw || "",
          body_zh: item.body_zh || "",
          body_raw: item.body_raw || "",
          author: item.author || "",
          published_at: item.published_at || item.fetched_at || "",
          content_type: item.content_type || "",
          source_name: item.source_name || "",
          source_url: item.source_url || "",
          canonical_url: item.canonical_url,
          tags: Array.isArray(item.tags) ? item.tags : [],
          lang: item.lang || "unknown",
          image_url: item.image_url || "",
        }),
      });
      setSaveStatus("已加入收藏", "success");
    }
    await Promise.all([loadChannelContent(item.channel), loadFeaturedContent(item.channel)]);
    if (state.content.detailItem?.id === itemId) {
      state.content.detailItem = findLocalContentItem(itemId) || state.content.detailItem;
      renderContentDetailModal();
    }
  } catch (error) {
    console.warn("Failed to toggle content favorite.", error);
    setSaveStatus(error?.message || "收藏操作失败");
  }
}

async function openContentDetail(itemId) {
  if (!itemId) {
    return;
  }
  const localItem = findLocalContentItem(itemId);
  if (localItem?.id?.startsWith("mock-")) {
    state.content.detailItem = localItem;
    renderContentDetailModal();
    return;
  }
  try {
    const payload = await fetchApiJson(`/api/content/${itemId}`);
    state.content.detailItem = payload?.item || null;
    renderContentDetailModal();
  } catch (error) {
    console.warn("Failed to load content detail.", error);
  }
}

function closeContentDetailModal() {
  state.content.detailItem = null;
  renderContentDetailModal();
}

async function openContentSourceModal(channel) {
  state.content.sourceModalChannel = channel;
  state.content.sourceEditingId = "";
  renderContentSourceModal();
  try {
    const payload = await fetchApiJson(`/api/content-sources?channel=${channel}`);
    state.content[channel].sources = Array.isArray(payload?.sources) ? payload.sources : [];
  } catch (error) {
    console.warn(`Failed to load ${channel} sources.`, error);
    if (error?.message === "Request failed: 404") {
      state.content[channel].sources = [];
    }
  }
  renderContentSourceModal();
}

function closeContentSourceModal() {
  state.content.sourceModalChannel = "";
  state.content.sourceEditingId = "";
  renderContentSourceModal();
}

async function handleContentSourceSubmit(event) {
  if (event.target !== elements.contentSourceForm) {
    return;
  }
  event.preventDefault();
  const channel = elements.contentSourceForm.dataset.channel || state.content.sourceModalChannel;
  if (!channel) {
    return;
  }
  const formData = new FormData(elements.contentSourceForm);
  const sourceId = String(formData.get("sourceId") || "");
  const payload = {
    channel,
    name: String(formData.get("name") || "").trim(),
    type: String(formData.get("type") || "rss"),
    url: String(formData.get("url") || "").trim(),
    parserKey: String(formData.get("parserKey") || "").trim(),
    enabled: String(formData.get("enabled") || "true") === "true",
  };
  const path = sourceId ? `/api/content-sources/${sourceId}` : "/api/content-sources";
  const method = sourceId ? "PATCH" : "POST";
  try {
    await fetchApiJson(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    elements.contentSourceForm.reset();
    state.content.sourceEditingId = "";
    await Promise.all([
      openContentSourceModal(channel),
      loadChannelContent(channel),
      loadFeaturedContent(channel),
    ]);
    setSaveStatus("信源已保存", "success");
  } catch (error) {
    console.warn("Failed to save content source.", error);
    setSaveStatus(error?.message || "保存信源失败");
  }
}

async function deleteContentSource(channel, sourceId) {
  try {
    await fetchApiJson(`/api/content-sources/${sourceId}`, { method: "DELETE" });
    await Promise.all([openContentSourceModal(channel), loadChannelContent(channel), loadFeaturedContent(channel)]);
    setSaveStatus("信源已删除", "success");
  } catch (error) {
    console.warn("Failed to delete content source.", error);
    setSaveStatus(error?.message || "删除信源失败");
  }
}

function renderTaskList() {
  const record = ensureRecord(state.selectedDate);
  const sortedTasks = [...getActiveTaskTypes()].sort((left, right) => {
    const leftCompleted = record.tasks[left.id]?.completed ? 1 : 0;
    const rightCompleted = record.tasks[right.id]?.completed ? 1 : 0;
    if (leftCompleted !== rightCompleted) {
      return leftCompleted - rightCompleted;
    }
    return left.order - right.order;
  });

  const taskCards = sortedTasks
    .map((task) => {
      const taskState = record.tasks[task.id];
      const draft = state.noteDrafts[task.id] || "";
      const notesHtml = taskState.notes.length
        ? taskState.notes
            .map(
              (note) => `
                <div class="task-note-item">
                  <div class="task-note-row">
                    <span class="note-time">${formatDateTime(note.createdAt)}</span>
                    <button
                      type="button"
                      class="delete-note"
                      data-action="delete-note"
                      data-task-id="${task.id}"
                      data-note-id="${note.id}"
                    >
                      删除
                    </button>
                  </div>
                  <p>${escapeHtml(note.text)}</p>
                </div>
              `,
            )
            .join("")
        : "";

      return `
        <article
          class="task-card ${taskState.completed ? "is-task-completed" : ""}"
          style="--task-accent: ${task.color};"
          data-task-card="${task.id}"
        >
          <button
            type="button"
            class="task-drag-handle"
            aria-label="拖拽排序 ${escapeAttribute(task.name)}"
            data-drag-handle="${task.id}"
            data-task-id="${task.id}"
          >
            <span class="material-symbols-outlined">drag_indicator</span>
          </button>
          <button
            type="button"
            class="task-accent-trigger"
            aria-label="${escapeAttribute(task.name)} 颜色设置"
            data-action="toggle-task-palette"
            data-task-id="${task.id}"
          ></button>
          <div class="task-row">
            <div>
              <h3 class="task-title">${task.name}</h3>
              <p class="task-meta">执行记录</p>
            </div>
            <div class="task-card-actions">
              <button
                type="button"
                class="task-cancel-action"
                data-action="start-task-rename"
                data-task-id="${task.id}"
              >
                编辑
              </button>
              <button
                type="button"
                class="task-toggle ${taskState.completed ? "is-completed" : ""}"
                data-action="toggle-task"
                data-task-id="${task.id}"
              >
                ${taskState.completed ? "已完成" : "未完成"}
              </button>
              <button
                type="button"
                class="task-archive"
                data-action="archive-task"
                data-task-id="${task.id}"
              >
                存档
              </button>
              <button
                type="button"
                class="delete-task"
                data-action="request-delete-task"
                data-task-id="${task.id}"
              >
                删除
              </button>
            </div>
          </div>

          ${
            state.activePaletteTaskId === task.id
              ? `
                <div class="task-palette-popover" role="group" aria-label="${escapeAttribute(task.name)} 颜色选择">
                  ${renderTaskColorPalette(task.id, task.color)}
                </div>
              `
              : ""
          }

          <div class="note-compose">
            <textarea
              class="task-note-input"
              data-action="draft-note"
              data-task-id="${task.id}"
              placeholder="填写备注并提交。已提交备注只保留追加，不支持修改和删除。"
            >${escapeHtml(draft)}</textarea>
            <button
              type="button"
              class="note-submit"
              data-action="submit-note"
              data-task-id="${task.id}"
            >
              提交备注
            </button>
          </div>
          ${notesHtml ? `<div class="task-note-list">${notesHtml}</div>` : ""}
        </article>
      `;
    })
    .join("");

  elements.taskList.innerHTML = `
    ${taskCards}
    <article class="task-card new-task-card">
      <div>
        <h3 class="task-title">+ 新建任务</h3>
        <p class="task-meta">新增后会自动加入每日打卡与周复盘。</p>
      </div>
      <form id="new-task-form" class="new-task-form">
        <input
          id="new-task-name"
          name="taskName"
          type="text"
          maxlength="20"
          placeholder="输入新任务名称"
          required
        />
        <div class="new-task-color-hint">
          <span>颜色</span>
          <strong style="${state.newTaskColor ? `color:${state.newTaskColor};` : ""}">
            ${state.newTaskColor ? "已选颜色" : "随机分配"}
          </strong>
        </div>
        <button type="submit" class="add-task-submit">创建任务</button>
      </form>
    </article>
  `;

  initTaskListSortable();
}

function renderTaskColorPalette(taskId, selectedColor) {
  return TASK_COLOR_PALETTES.map(
    (palette) => `
      <button
        type="button"
        class="palette-swatch ${palette.value === selectedColor ? "is-active" : ""}"
        style="--swatch-color:${palette.value};"
        title="${palette.label}"
        aria-label="${palette.label}"
        data-action="set-task-color"
        data-task-id="${taskId}"
        data-color="${palette.value}"
      ></button>
    `,
  ).join("");
}

function renderNewTaskColorPalette(selectedColor) {
  return TASK_COLOR_PALETTES.map(
    (palette) => `
      <button
        type="button"
        class="palette-swatch ${palette.value === selectedColor ? "is-active" : ""}"
        style="--swatch-color:${palette.value};"
        title="${palette.label}"
        aria-label="${palette.label}"
        data-action="set-new-task-color"
        data-color="${palette.value}"
      ></button>
    `,
  ).join("");
}

function renderWeeklyReview() {
  const aggregation = getSelectedReviewAggregation();
  const weeklyTasks = getFilteredWeeklyTasks(aggregation);
  if (weeklyTasks.length === 0) {
    elements.weeklyReviewList.innerHTML = `
      <article class="review-card">
        <div class="review-card-header">
          <div>
            <h3 class="review-title">暂无匹配结果</h3>
          </div>
        </div>
        <div class="review-notes">
          <div class="review-note-item">
            <span class="review-note-date">-</span>
            <span>尝试切换周/月范围，或放宽搜索与筛选条件。</span>
          </div>
        </div>
      </article>
    `;
    return;
  }
  elements.weeklyReviewList.innerHTML = weeklyTasks
    .map((task) => {
      const notes = aggregation.notesByTask[task.id];
      const noteHtml = notes.length
        ? notes
            .map(
              (item) => `
                <div class="review-note-item">
                  <span class="review-note-date">${item.dateLabel}</span>
                  <span>${escapeHtml(item.note)}</span>
                </div>
              `,
            )
            .join("")
        : '<div class="review-note-item"><span class="review-note-date">-</span><span>暂无复盘备注</span></div>';

      return `
        <article class="review-card" style="--task-accent: ${task.color};">
          <div class="review-card-header">
            <div>
              <h3 class="review-title">${task.name}</h3>
            </div>
            <div class="review-summary">
              ${
                isTaskArchived(task)
                  ? '<span class="review-chip is-archived">已存档</span>'
                  : ""
              }
              ${
                isTaskArchived(task)
                  ? `
                    <button
                      type="button"
                      class="task-archive review-restore-button"
                      data-action="restore-task"
                      data-task-id="${task.id}"
                    >
                      恢复
                    </button>
                  `
                  : ""
              }
              <button
                type="button"
                class="task-cancel-action review-timeline-button"
                data-action="open-task-timeline"
                data-task-id="${task.id}"
              >
                时间线
              </button>
              <span class="review-chip">${aggregation.completionCounts[task.id]} / ${aggregation.totalDays} DAYS</span>
              <span class="review-chip">${notes.length} NOTES</span>
            </div>
          </div>
          <div class="review-notes">${noteHtml}</div>
        </article>
      `;
    })
    .join("");
}

function getFilteredWeeklyTasks(aggregation) {
  const weeklyTasks = getWeeklyVisibleTasks(aggregation);

  return weeklyTasks.filter((task) => {
    const notes = aggregation.notesByTask[task.id] || [];
    const completionCount = aggregation.completionCounts[task.id] || 0;

    if (
      state.weeklyFilters.taskId !== "all" &&
      state.weeklyFilters.taskId !== task.id
    ) {
      return false;
    }

    if (
      state.weeklyFilters.archive === "archived" &&
      !isTaskArchived(task)
    ) {
      return false;
    }
    if (
      state.weeklyFilters.archive === "active" &&
      isTaskArchived(task)
    ) {
      return false;
    }
    if (
      state.weeklyFilters.notes === "with-notes" &&
      notes.length === 0
    ) {
      return false;
    }
    if (
      state.weeklyFilters.notes === "without-notes" &&
      notes.length > 0
    ) {
      return false;
    }
    if (
      state.weeklyFilters.completion === "completed" &&
      completionCount === 0
    ) {
      return false;
    }
    if (
      state.weeklyFilters.completion === "incomplete" &&
      completionCount > 0
    ) {
      return false;
    }
    return true;
  });
}

function getSelectedReviewAggregation() {
  if (state.reviewMode === "month") {
    return aggregateMonth(state.selectedMonth);
  }
  return aggregateWeek(state.selectedWeek);
}

function normalizeWeeklyAggregation(payload) {
  const presenceCounts = {};
  const completionCounts = {};
  const notesByTask = {};
  const eventsByTask = {};

  state.data.taskTypes.forEach((task) => {
    presenceCounts[task.id] = Number(payload?.presenceCounts?.[task.id] || 0);
    completionCounts[task.id] = Number(
      payload?.completionCounts?.[task.id] || 0,
    );
    notesByTask[task.id] = Array.isArray(payload?.notesByTask?.[task.id])
      ? payload.notesByTask[task.id].map((item) => ({
          dateLabel: formatMonthDay(parseLocalDate(item.date)),
          note: item.text,
        }))
      : [];
    eventsByTask[task.id] = [];
  });

  return { presenceCounts, completionCounts, notesByTask, eventsByTask, totalDays: 7 };
}

function renderWidgets() {
  if (elements.githubWidgetDisplay) {
    elements.githubWidgetDisplay.innerHTML = renderGitHubWidget();
  }
  elements.weatherWidgetDisplay.innerHTML = renderWeatherWidget();
  elements.stockWidgetDisplay.innerHTML = renderStockWidget();
}

function renderGitHubWidget() {
  const repo = state.widgetData.github;
  const profileUrl = String(state.data.preferences.widgets.github?.profileUrl || "").trim();
  if (elements.githubCardLink) {
    elements.githubCardLink.href = profileUrl || "#";
    elements.githubCardLink.setAttribute("aria-disabled", profileUrl ? "false" : "true");
    elements.githubCardLink.tabIndex = profileUrl ? 0 : -1;
  }
  const items = Array.isArray(repo.repos) ? repo.repos.slice(0, 3) : [];
  if (!profileUrl) {
    return `
      <form class="github-profile-form" id="github-profile-form">
        <label class="settings-field">
          <span class="widget-label">GitHub 主页网址</span>
          <input name="githubProfileUrl" type="url" placeholder="https://github.com/your-name" />
        </label>
        <p class="settings-copy">启用 GitHub 卡片后，填写主页网址才会同步最近活跃仓库。</p>
        <div class="settings-actions">
          <button type="submit" class="settings-save">保存网址</button>
        </div>
      </form>
    `;
  }
  const list = items.length
    ? items
        .map(
          (item) => `
            <article class="github-repo-item">
              <div class="github-repo-copy">
                <h3>${escapeHtml(item.name)}</h3>
                <p>${escapeHtml(item.description || "暂无仓库简介。")}</p>
              </div>
              <div class="github-repo-meta">
                <span class="feed-meta">${escapeHtml(item.updatedAt ? `Updated ${formatDateTime(item.updatedAt)}` : "Recently active")}</span>
          <a class="show-more github-inline-link" href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">
                  <span>${escapeHtml(item.shortUrl || "Open Repo")}</span>
                  <span class="material-symbols-outlined">arrow_outward</span>
                </a>
              </div>
            </article>
          `,
        )
        .join("")
    : `
      <article class="github-repo-item">
        <div class="github-repo-copy">
          <h3>DanN-55 / life-flow</h3>
          <p>Dashboard preview for personal execution, market notes and research reading.</p>
        </div>
        <div class="github-repo-meta">
          <span class="feed-meta">GitHub 预览暂时不可用</span>
          <a class="show-more github-inline-link" href="${escapeAttribute(repo.url)}" target="_blank" rel="noreferrer">
            <span>Open GitHub</span>
            <span class="material-symbols-outlined">arrow_outward</span>
          </a>
        </div>
      </article>
    `;
  return `
    <div class="github-stream">
      ${list}
    </div>
  `;
}

async function handleGitHubProfileSubmit(event) {
  const form = event.target.closest("#github-profile-form");
  if (!form) {
    return;
  }
  event.preventDefault();
  const profileUrl = String(new FormData(form).get("githubProfileUrl") || "").trim();
  state.data.preferences.widgets.github.profileUrl = profileUrl;
  persistStateSilently();
  if (state.auth.user) {
    try {
      await saveAccountPreferencesRemote();
    } catch (error) {
      console.warn("Failed to save GitHub profile URL remotely.", error);
      setSaveStatus("GitHub 主页网址已保存在本地，云端同步稍后重试");
    }
  }
  renderWidgets();
  await refreshGitHubRepo();
  renderWidgets();
  setSaveStatus(profileUrl ? "已保存 GitHub 主页网址" : "已清空 GitHub 主页网址", "success");
}

function renderWeatherWidget() {
  const weather = state.widgetData.weather;
  const axis = buildWeatherAxis(weather.forecast);
  const hotspots = buildWeatherHotspots(weather.forecast);
  const chart = weather.forecast.length
    ? `
      <div class="weather-chart" aria-label="近7日气温变化">
        <svg viewBox="0 0 260 112" class="weather-chart-svg" preserveAspectRatio="none">
          <line x1="30" y1="12" x2="30" y2="88" class="weather-axis"></line>
          <line x1="30" y1="88" x2="250" y2="88" class="weather-axis"></line>
          <line x1="30" y1="20" x2="250" y2="20" class="weather-grid"></line>
          <line x1="30" y1="54" x2="250" y2="54" class="weather-grid"></line>
          <polyline points="${buildWeatherPolyline(weather.forecast)}" />
          <text x="8" y="20" class="weather-axis-label">${axis.max}</text>
          <text x="8" y="56" class="weather-axis-label">${axis.mid}</text>
          <text x="8" y="90" class="weather-axis-label">${axis.min}</text>
          ${weather.forecast
            .map(
              (item, index) => `
                <text x="${30 + (index * 220) / Math.max(weather.forecast.length - 1, 1)}" y="106" class="weather-axis-label weather-axis-day">${item.axisLabel || index + 1}</text>
              `,
            )
            .join("")}
        </svg>
        <div class="weather-hotspots">
          ${hotspots
            .map(
              (item) => `
                <div class="weather-hotspot" style="left:${item.left}%;">
                  <div class="weather-tooltip">
                    <strong>${escapeHtml(item.dateLabel)}</strong>
                    <span>${escapeHtml(item.weekdayLabel)}</span>
                    <span>${escapeHtml(item.tempLabel)}</span>
                  </div>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>
    `
    : `
      <div class="weather-chart weather-chart-empty">
        <div class="weather-chart-label">暂无趋势数据</div>
      </div>
    `;
  return `
    <div class="widget-stat">
      <div>
        <h3 class="widget-title">${escapeHtml(weather.location || "位置待获取")}</h3>
        <p class="widget-location">近 7 日气温变化</p>
      </div>
      <button
        type="button"
        class="widget-refresh-button"
        data-weather-refresh
        title="刷新天气"
        aria-label="刷新天气"
      >
        <span class="material-symbols-outlined">refresh</span>
      </button>
    </div>
    ${chart}
    <div class="widget-reading-line">
      <div class="widget-reading">${escapeHtml(weather.temperature || "--")}</div>
      <p class="widget-body">${escapeHtml(weather.detail || "正在尝试获取当地天气。")}</p>
    </div>
  `;
}

function renderStockWidget() {
  const widget = state.data.preferences.widgets.stock;
  const stock = state.widgetData.stock;
  const list = stock.symbols.length
    ? stock.symbols
        .map(
          (item) => `
            <div class="widget-symbol market-row">
              <div class="market-meta">
                <strong>${escapeHtml(item.name || item.symbol)}</strong>
                <span>${escapeHtml(item.symbol)} ${escapeHtml(item.price)}</span>
              </div>
              <div class="market-trend market-trend-${escapeHtml(item.trend)}">
                <svg viewBox="0 0 80 18" class="market-sparkline" preserveAspectRatio="none">
                  <polyline points="${sparklinePoints(item.trend)}"></polyline>
                </svg>
                <span>${escapeHtml(item.change)}</span>
              </div>
            </div>
          `,
        )
        .join("")
    : `
      <div class="widget-symbol">
        <strong>${escapeHtml(widget.symbols)}</strong>
        <span>--</span>
      </div>
    `;

  return `
    <div class="widget-stat">
      <div>
        <h3 class="widget-title">${escapeHtml(widget.title)}</h3>
      </div>
      <span class="material-symbols-outlined">finance_mode</span>
    </div>
    <div class="widget-symbol-list market-list">${list}</div>
    <p class="widget-status">${escapeHtml(stock.message || "尝试获取实时行情，失败时显示占位信息。")}</p>
  `;
}

function renderModal() {
  const widget = state.modal.widget;
  if (!widget) {
    elements.settingsModal.hidden = true;
    elements.settingsForm.innerHTML = "";
    return;
  }

  elements.settingsModal.hidden = false;
  elements.settingsTitle.textContent =
    widget === "weather" ? "Weather 设置" : "Stock 设置";
  elements.settingsForm.innerHTML = renderSettingsForm(widget);
}

function openArchiveTaskModal(taskId) {
  state.archiveDialogTaskId = taskId;
  renderArchiveTaskModal();
}

function openRenameTaskModal(taskId) {
  const task = state.data.taskTypes.find((item) => item.id === taskId);
  if (!task) {
    return;
  }
  state.renameDialogTaskId = taskId;
  state.taskNameDrafts[taskId] = task.name;
  renderRenameTaskModal();
}

function closeRenameTaskModal() {
  state.renameDialogTaskId = null;
  renderRenameTaskModal();
}

function closeArchiveTaskModal() {
  state.archiveDialogTaskId = null;
  renderArchiveTaskModal();
}

function openDeleteTaskModal(taskId) {
  state.deleteDialogTaskId = taskId;
  renderDeleteTaskModal();
}

function closeDeleteTaskModal() {
  state.deleteDialogTaskId = null;
  renderDeleteTaskModal();
}

function renderDeleteTaskModal() {
  if (!elements.deleteTaskModal || !elements.deleteTaskConfirm) {
    return;
  }

  const task = state.data.taskTypes.find((item) => item.id === state.deleteDialogTaskId);
  elements.deleteTaskModal.hidden = !task;
  elements.deleteTaskConfirm.disabled = !task;
  elements.deleteTaskConfirm.dataset.taskId = task?.id || "";
  elements.deleteTaskConfirm.title = task
    ? `确认永久删除 ${task.name}`
    : "确认删除";
}

function renderArchiveTaskModal() {
  if (!elements.archiveTaskModal || !elements.archiveTaskConfirm) {
    return;
  }

  const task = state.data.taskTypes.find((item) => item.id === state.archiveDialogTaskId);
  elements.archiveTaskModal.hidden = !task;
  elements.archiveTaskConfirm.disabled = !task;
  elements.archiveTaskConfirm.dataset.taskId = task?.id || "";
  elements.archiveTaskConfirm.title = task
    ? `确认存档 ${task.name}`
    : "确认存档";
}

function renderRenameTaskModal() {
  if (!elements.renameTaskModal || !elements.renameTaskInput || !elements.renameTaskConfirm) {
    return;
  }

  const task = state.data.taskTypes.find((item) => item.id === state.renameDialogTaskId);
  elements.renameTaskModal.hidden = !task;
  elements.renameTaskInput.value = task ? state.taskNameDrafts[task.id] || task.name : "";
  elements.renameTaskConfirm.disabled = !task;
  elements.renameTaskConfirm.dataset.taskId = task?.id || "";
  elements.renameTaskConfirm.title = task ? `确认编辑 ${task.name}` : "确认编辑";
}

function openWeeklySummarySaveModal() {
  state.weeklySummarySaveDialogOpen = true;
  renderWeeklySummarySaveModal();
}

function closeWeeklySummarySaveModal() {
  state.weeklySummarySaveDialogOpen = false;
  renderWeeklySummarySaveModal();
}

function renderWeeklySummarySaveModal() {
  if (!elements.weeklySummarySaveModal || !elements.weeklySummarySaveConfirm) {
    return;
  }

  const content = getWeeklySummaryDraft(state.selectedWeek).trim();
  elements.weeklySummarySaveModal.hidden = !state.weeklySummarySaveDialogOpen;
  elements.weeklySummarySaveConfirm.disabled = !content;
  elements.weeklySummarySaveConfirm.title = content
    ? `确认保存 ${formatWeekRangeText(state.selectedWeek)} 的周总结`
    : "请先填写周总结内容";
}

function openTaskTimelineModal(taskId) {
  state.taskTimelineTaskId = taskId;
  renderTaskTimelineModal();
}

function closeTaskTimelineModal() {
  state.taskTimelineTaskId = null;
  renderTaskTimelineModal();
}

function renderTaskTimelineModal() {
  if (!elements.taskTimelineModal || !elements.taskTimelineBody || !elements.taskTimelineTitle) {
    return;
  }

  const task = state.data.taskTypes.find((item) => item.id === state.taskTimelineTaskId);
  elements.taskTimelineModal.hidden = !task;
  if (!task) {
    elements.taskTimelineTitle.textContent = "任务时间线";
    elements.taskTimelineBody.innerHTML = "";
    return;
  }

  elements.taskTimelineTitle.textContent = task.name;
  const events = getTaskTimelineEntries(task.id);
  elements.taskTimelineBody.innerHTML = `
    <div class="task-timeline-header">
      <span>${events.length} 条历史记录</span>
    </div>
    <div class="task-timeline-list">
      ${
        events.length
          ? events
              .map(
                (entry) => `
                  <article class="task-timeline-item">
                    <div class="task-timeline-rail" aria-hidden="true">
                      <span class="task-timeline-dot ${entry.completed ? "is-complete" : ""}"></span>
                      <span class="task-timeline-line"></span>
                    </div>
                    <div class="task-timeline-content">
                      <div class="task-timeline-meta">
                        <strong>${escapeHtml(entry.dateLabel)}</strong>
                        <span class="task-timeline-status">${entry.completed ? "已完成" : "未完成"}</span>
                      </div>
                      <div class="task-timeline-notes">
                        ${
                          entry.notes.length
                            ? entry.notes
                                .map(
                                  (note) => `<div class="task-timeline-note-item">${escapeHtml(note.text)}</div>`,
                                )
                                .join("")
                            : '<div class="task-timeline-note-item is-empty">无备注</div>'
                        }
                      </div>
                    </div>
                  </article>
                `,
              )
              .join("")
          : '<div class="task-timeline-empty">暂无历史记录</div>'
      }
    </div>
  `;
}

async function loadAccountProfile() {
  if (!state.auth.user) {
    return;
  }
  state.accountProfileLoading = true;
  renderAccountProfileModal();
  try {
    const payload = await fetchApiJson("/api/account/profile");
    if (payload?.user?.preferences) {
      applyAccountPreferences(payload.user.preferences, { applyTheme: true });
    }
    state.accountProfile = {
      user: payload.user || null,
      counts: payload.counts || {},
    };
  } catch (error) {
    console.warn("Failed to load account profile.", error);
    state.accountProfile = null;
  } finally {
    state.accountProfileLoading = false;
    renderAccountProfileModal();
  }
}

function openAccountMenu() {
  if (!state.auth.user) {
    return;
  }
  state.accountMenuOpen = true;
  renderControls();
}

function closeAccountMenu() {
  state.accountMenuOpen = false;
  renderControls();
}

function toggleAccountMenu() {
  if (!state.auth.user) {
    return;
  }
  state.accountMenuOpen = !state.accountMenuOpen;
  renderControls();
}

function openAccountProfileModal() {
  closeAccountMenu();
  state.accountProfileModalOpen = true;
  state.accountProfile = null;
  renderAccountProfileModal();
  void loadAccountProfile();
}

function closeAccountProfileModal() {
  state.accountProfileModalOpen = false;
  renderAccountProfileModal();
}

async function handleAccountProfilePreferencesSubmit(event) {
  const form = event.target.closest("#account-preferences-form");
  if (!form) {
    return;
  }
  event.preventDefault();
  const formData = new FormData(form);
  state.data.preferences.sidebar = {
    calendar: formData.has("calendar"),
    github: formData.has("github"),
    financeFeed: formData.has("financeFeed"),
    scienceFeed: formData.has("scienceFeed"),
    weather: formData.has("weather"),
    stock: formData.has("stock"),
  };
  persistStateSilently();
  if (state.auth.user) {
    try {
      await saveAccountPreferencesRemote();
    } catch (error) {
      console.warn("Failed to save account preferences remotely.", error);
      setSaveStatus("面板设置已保存在本地，云端同步稍后重试");
    }
  }
  render();
  renderAccountProfileModal();
  if (state.data.preferences.sidebar.github) {
    await refreshGitHubRepo();
    renderWidgets();
  }
  setSaveStatus("已保存账号面板设置", "success");
}

function openChangePasswordModal() {
  closeAccountMenu();
  state.changePasswordModalOpen = true;
  state.auth.feedback = "";
  elements.changePasswordForm?.reset();
  renderChangePasswordModal();
}

function closeChangePasswordModal() {
  state.changePasswordModalOpen = false;
  state.changePasswordSubmitting = false;
  state.auth.feedback = "";
  renderChangePasswordModal();
}

function openClearAccountDataModal() {
  closeAccountMenu();
  state.clearAccountDataModalOpen = true;
  renderClearAccountDataModal();
}

function closeClearAccountDataModal() {
  state.clearAccountDataModalOpen = false;
  state.clearAccountDataSubmitting = false;
  renderClearAccountDataModal();
}

function openDeleteAccountModal() {
  closeAccountMenu();
  state.deleteAccountModalOpen = true;
  state.auth.feedback = "";
  elements.deleteAccountForm?.reset();
  renderDeleteAccountModal();
}

function closeDeleteAccountModal() {
  state.deleteAccountModalOpen = false;
  state.deleteAccountSubmitting = false;
  state.auth.feedback = "";
  renderDeleteAccountModal();
}

function getTaskTimelineEntries(taskId) {
  return Object.entries(state.data.dailyRecords)
    .map(([dateKey, record]) => {
      if (!record?.tasks?.[taskId]) {
        return null;
      }
      const taskState = migrateTaskRecord(record.tasks[taskId], record.updatedAt, dateKey);
      if (!taskState.completed && taskState.notes.length === 0) {
        return null;
      }
      return {
        dateKey,
        dateLabel: formatDisplayDate(parseLocalDate(dateKey)),
        completed: Boolean(taskState.completed),
        notes: taskState.notes,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

function renderSettingsForm(widget) {
  if (widget === "weather") {
    const config = state.data.preferences.widgets.weather;
    return `
      <p class="settings-copy">可填写城市/地区名称来固定天气位置；留空时继续使用自动定位。</p>
      <label class="settings-field">
        <span class="widget-label">位置</span>
        <input name="locationQuery" type="text" placeholder="例如：上海、杭州西湖、Shenzhen" value="${escapeAttribute(config.locationQuery || "")}" />
      </label>
      <div class="settings-actions">
        <button type="submit" class="settings-save">保存设置</button>
      </div>
    `;
  }

  const config = state.data.preferences.widgets.stock;
  return `
    <p class="settings-copy">输入 A 股股票代码或股票名称，支持逗号或换行分隔，例如：贵州茅台、000001。</p>
    <label class="settings-field">
      <span class="widget-label">代码列表</span>
      <textarea name="symbols" placeholder="贵州茅台, 宁德时代, 000001">${escapeHtml(config.symbols)}</textarea>
    </label>
    <div class="settings-actions">
      <button type="submit" class="settings-save">保存设置</button>
    </div>
  `;
}

function aggregateRange(start, end) {
  const presenceCounts = {};
  const completionCounts = {};
  const notesByTask = {};
  const eventsByTask = {};

  state.data.taskTypes.forEach((task) => {
    presenceCounts[task.id] = 0;
    completionCounts[task.id] = 0;
    notesByTask[task.id] = [];
    eventsByTask[task.id] = [];
  });

  for (
    let current = new Date(start);
    current <= end;
    current = addDays(current, 1)
  ) {
    const dateKey = formatDateKey(current);
    const record = state.data.dailyRecords[dateKey];
    if (!record) {
      continue;
    }

    state.data.taskTypes.forEach((task) => {
      const existsInRecord = Object.prototype.hasOwnProperty.call(
        record.tasks,
        task.id,
      );
      const taskState = migrateTaskRecord(record.tasks[task.id], record.updatedAt, dateKey);
      if (existsInRecord) {
        presenceCounts[task.id] += 1;
      }
      if (taskState.completed) {
        completionCounts[task.id] += 1;
      }
      eventsByTask[task.id].push({
        dateKey,
        dateLabel: formatMonthDay(current),
        completed: Boolean(taskState.completed),
        notes: taskState.notes.map((note) => ({
          text: note.text,
          createdAt: note.createdAt,
        })),
        notePreview: taskState.notes.map((note) => note.text).join(" "),
      });
      taskState.notes.forEach((note) => {
        notesByTask[task.id].push({
          dateLabel: formatMonthDay(parseIsoDate(note.createdAt) || current),
          note: note.text,
        });
      });
    });
  }

  return {
    presenceCounts,
    completionCounts,
    notesByTask,
    eventsByTask,
    totalDays: getDaySpan(start, end),
  };
}

function aggregateWeek(weekValue) {
  const range = getWeekRangeFromWeekValue(weekValue);
  return aggregateRange(range.start, range.end);
}

function aggregateMonth(monthValue) {
  const range = getMonthRange(monthValue);
  return aggregateRange(range.start, range.end);
}

function getCompletedCount(record) {
  return getActiveTaskTypes().reduce((count, task) => {
    return count + (record.tasks[task.id]?.completed ? 1 : 0);
  }, 0);
}

function resolveSaveStatusTone(message, explicitTone) {
  if (explicitTone) {
    return explicitTone;
  }

  if (/(待同步|失败|本地保存|本地缓存|请先)/.test(message)) {
    return "default";
  }
  if (/^(正在|发送中|登录中|创建中)/.test(message)) {
    return "progress";
  }
  if (/(已保存|已同步|已切换|已导出|已连接|已恢复|已追加|已更新|已创建|已重命名|已删除|已存档|已自动保存)/.test(message)) {
    return "success";
  }
  return "default";
}

function renderSaveStatusState() {
  elements.saveStatus.textContent = elements.saveStatus.textContent || "数据将自动保存到本地";
  elements.saveStatus.dataset.tone = state.saveStatusTone;
  elements.saveStatusUndo.hidden = !state.undoAction;
  elements.saveStatusRetry.hidden = !(state.remote.status === "sync-error" || hasPendingSync());
}

function setUndoAction(action) {
  if (undoActionTimer) {
    clearTimeout(undoActionTimer);
    undoActionTimer = null;
  }

  state.undoAction = action;
  renderSaveStatusState();

  if (!action) {
    return;
  }

  undoActionTimer = window.setTimeout(() => {
    state.undoAction = null;
    renderSaveStatusState();
    undoActionTimer = null;
  }, 8000);
}

function clearUndoAction() {
  setUndoAction(null);
}

function setSaveStatus(message, tone) {
  state.saveStatusTone = resolveSaveStatusTone(message, tone);
  elements.saveStatus.textContent = message;
  renderSaveStatusState();
}

function applyTheme(theme) {
  elements.body.dataset.theme = normalizeThemePreference(theme);
}

function updateTheme(theme) {
  state.data.preferences.theme = theme;
  saveData(`已切换到 ${themeLabel(theme)}`);
  render();
  if (state.auth.user) {
    void saveAccountPreferencesRemote().catch((error) => {
      console.warn("Failed to save theme remotely.", error);
      setSaveStatus(`已切换到 ${themeLabel(theme)}，云端同步稍后重试`);
    });
  }
}

function themeLabel(theme) {
  return theme === "light" ? "Light 模式" : "Dark 模式";
}

async function updateTaskCompletion(taskId) {
  const record = ensureRecord(state.selectedDate);
  record.tasks[taskId].completed = !record.tasks[taskId].completed;
  record.updatedAt = new Date().toISOString();
  persistStateSilently();
  renderControls();
  renderTaskList();
  renderWeeklyReview();
  await syncCurrentRecord(`已保存 ${getTaskName(taskId)} 的完成状态`);
}

function updateNoteDraft(taskId, value) {
  state.noteDrafts[taskId] = value;
}

function updateTaskNameDraft(taskId, value) {
  state.taskNameDrafts[taskId] = value;
}

async function submitTaskNote(taskId) {
  const draft = (state.noteDrafts[taskId] || "").trim();
  if (!draft) {
    return;
  }

  const record = ensureRecord(state.selectedDate);
  record.tasks[taskId].notes.push({
    id: `note-${Date.now()}`,
    text: draft,
    createdAt: new Date().toISOString(),
  });
  record.updatedAt = new Date().toISOString();
  state.noteDrafts[taskId] = "";
  persistStateSilently();
  renderTaskList();
  renderWeeklyReview();
  await syncCurrentRecord(`已追加 ${getTaskName(taskId)} 的备注`);
}

async function deleteTaskNote(taskId, noteId) {
  const record = ensureRecord(state.selectedDate);
  const taskState = record.tasks[taskId];
  if (!taskState) {
    return;
  }
  taskState.notes = taskState.notes.filter((note) => note.id !== noteId);
  record.updatedAt = new Date().toISOString();
  persistStateSilently();
  renderTaskList();
  renderWeeklyReview();
  await syncCurrentRecord(`已删除 ${getTaskName(taskId)} 的备注`);
}

async function addTask(taskName) {
  const normalizedName = taskName.trim();
  if (!normalizedName) {
    return;
  }

  const id = `task-${Date.now()}`;
  const nextTask = {
    id,
    name: normalizedName,
    order: state.data.taskTypes.length + 1,
    color: state.newTaskColor || getRandomPaletteColor(),
    archived: false,
    archivedAt: "",
  };
  state.data.taskTypes = [...state.data.taskTypes, nextTask];
  Object.values(state.data.dailyRecords).forEach((record) => {
    record.tasks[id] = { completed: false, notes: [] };
  });
  ensureRecord(state.selectedDate);
  state.newTaskColor = "";
  persistStateSilently();
  render();
  await syncTaskCreate(nextTask, `已创建任务：${normalizedName}`);
}

async function renameTask(taskId) {
  const task = state.data.taskTypes.find((item) => item.id === taskId);
  const draft = String(state.taskNameDrafts[taskId] || "").trim();
  if (!task || !draft || draft === task.name) {
    closeRenameTaskModal();
    return;
  }

  task.name = draft;
  closeRenameTaskModal();
  persistStateSilently();
  render();
  await syncTaskUpdate(task, `已重命名任务：${draft}`);
}

function cancelTaskRename(taskId) {
  delete state.taskNameDrafts[taskId];
  if (state.renameDialogTaskId === taskId) {
    closeRenameTaskModal();
  }
}

function startTaskRename(taskId) {
  openRenameTaskModal(taskId);
}

async function moveTask(taskId, direction) {
  const activeTasks = [...getActiveTaskTypes()].sort((a, b) => a.order - b.order);
  const currentIndex = activeTasks.findIndex((task) => task.id === taskId);
  if (currentIndex === -1) {
    return;
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  const targetTask = activeTasks[targetIndex];
  const currentTask = activeTasks[currentIndex];
  if (!targetTask || !currentTask) {
    return;
  }

  const currentOrder = currentTask.order;
  currentTask.order = targetTask.order;
  targetTask.order = currentOrder;
  state.data.taskTypes.sort((a, b) => a.order - b.order);
  persistStateSilently();
  render();

  await Promise.all([
    syncTaskUpdate(currentTask, `已调整 ${currentTask.name} 的顺序`),
    syncTaskUpdate(targetTask, `已调整 ${targetTask.name} 的顺序`),
  ]);
}

async function reorderTasksByDrag(sourceTaskId, targetTaskId) {
  if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) {
    return;
  }

  const fullSortedTasks = [...state.data.taskTypes].sort((a, b) => a.order - b.order);
  const activeTasks = fullSortedTasks.filter((task) => !isTaskArchived(task));
  const sourceIndex = activeTasks.findIndex((task) => task.id === sourceTaskId);
  const targetIndex = activeTasks.findIndex((task) => task.id === targetTaskId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return;
  }

  const reorderedActiveTasks = [...activeTasks];
  const [movedTask] = reorderedActiveTasks.splice(sourceIndex, 1);
  reorderedActiveTasks.splice(targetIndex, 0, movedTask);

  let activeCursor = 0;
  const mergedTasks = fullSortedTasks.map((task) => {
    if (isTaskArchived(task)) {
      return task;
    }
    const nextTask = reorderedActiveTasks[activeCursor];
    activeCursor += 1;
    return nextTask;
  });

  const changedTasks = [];
  mergedTasks.forEach((task, index) => {
    const nextOrder = index + 1;
    if (task.order !== nextOrder) {
      task.order = nextOrder;
      changedTasks.push(task);
    }
  });

  if (changedTasks.length === 0) {
    return;
  }

  state.data.taskTypes = mergedTasks;
  persistStateSilently();
  render();

  await Promise.all(
    changedTasks.map((task) =>
      syncTaskUpdate(task, `已调整 ${task.name} 的顺序`),
    ),
  );
}

async function reorderTasksToMatchOrder(orderedTaskIds) {
  const orderMap = new Map(orderedTaskIds.map((taskId, index) => [taskId, index + 1]));
  const changedTasks = [];

  state.data.taskTypes.forEach((task) => {
    if (!orderMap.has(task.id)) {
      return;
    }
    const nextOrder = orderMap.get(task.id);
    if (task.order !== nextOrder) {
      task.order = nextOrder;
      changedTasks.push(task);
    }
  });

  if (changedTasks.length === 0) {
    renderTaskList();
    return;
  }

  state.data.taskTypes.sort((a, b) => a.order - b.order);
  persistStateSilently();
  render();

  await Promise.all(
    changedTasks.map((task) =>
      syncTaskUpdate(task, `已调整 ${task.name} 的顺序`),
    ),
  );
}

function initTaskListSortable() {
  if (!elements.taskList || typeof window.Sortable === "undefined") {
    return;
  }

  if (taskListSortable) {
    taskListSortable.destroy();
  }

  taskListSortable = window.Sortable.create(elements.taskList, {
    animation: 220,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    draggable: ".task-card:not(.new-task-card)",
    handle: ".task-drag-handle",
    ghostClass: "task-card-sort-ghost",
    chosenClass: "task-card-sort-chosen",
    dragClass: "task-card-sort-drag",
    filter: ".new-task-card",
    preventOnFilter: false,
    onEnd(event) {
      const orderedTaskIds = [...elements.taskList.querySelectorAll(".task-card:not(.new-task-card)")]
        .map((card) => card.dataset.taskCard)
        .filter(Boolean);

      if (orderedTaskIds.length === 0) {
        renderTaskList();
        return;
      }

      void reorderTasksToMatchOrder(orderedTaskIds);
    },
  });
}

async function updateTaskColor(taskId, color) {
  const task = state.data.taskTypes.find((item) => item.id === taskId);
  if (!task || task.color === color) {
    return;
  }
  task.color = color;
  persistStateSilently();
  renderTaskList();
  renderWeeklyReview();
  await syncTaskUpdate(task, `已更新 ${task.name} 的颜色`);
}

async function deleteTask(taskId) {
  const task = state.data.taskTypes.find((item) => item.id === taskId);
  if (!task) {
    return;
  }
  const deletedTaskSnapshot = structuredClone(task);
  const deletedTaskRecords = Object.entries(state.data.dailyRecords).reduce(
    (accumulator, [dateKey, record]) => {
      if (!record?.tasks?.[taskId]) {
        return accumulator;
      }
      accumulator[dateKey] = structuredClone(record.tasks[taskId]);
      return accumulator;
    },
    {},
  );
  closeDeleteTaskModal();
  permanentlyRemoveTaskFromLocalState(taskId);
  persistStateSilently();
  render();
  setUndoAction({
    undo: async () => {
      state.data.taskTypes.push(deletedTaskSnapshot);
      state.data.taskTypes.sort((a, b) => a.order - b.order);
      Object.entries(deletedTaskRecords).forEach(([dateKey, taskState]) => {
        const record = ensureRecord(dateKey);
        record.tasks[taskId] = taskState;
      });
      persistStateSilently();
      render();
      await syncTaskCreate(deletedTaskSnapshot, `已撤销删除：${deletedTaskSnapshot.name}`);
      await Promise.all(
        Object.keys(deletedTaskRecords).map((dateKey) => syncRecordByDate(dateKey)),
      );
      setSaveStatus(`已撤销删除 ${deletedTaskSnapshot.name}`, "success");
    },
  });
  await syncTaskDelete(taskId, `已删除任务：${task.name}`);
}

async function archiveTask(taskId) {
  const task = state.data.taskTypes.find((item) => item.id === taskId);
  if (!task || isTaskArchived(task)) {
    return;
  }

  closeArchiveTaskModal();
  delete state.recentlyRestoredTaskIds[taskId];
  const previousState = {
    archived: Boolean(task.archived),
    archivedAt: task.archivedAt || "",
  };
  task.archived = true;
  task.archivedAt = new Date().toISOString();
  persistStateSilently();
  render();
  setUndoAction({
    undo: async () => {
      task.archived = previousState.archived;
      task.archivedAt = previousState.archivedAt;
      persistStateSilently();
      render();
      await syncTaskUpdate(task, `已撤销存档：${task.name}`);
    },
  });
  await syncTaskUpdate(task, `已存档任务：${task.name}`);
}

async function restoreTask(taskId) {
  const task = state.data.taskTypes.find((item) => item.id === taskId);
  if (!task || !isTaskArchived(task)) {
    return;
  }

  task.archived = false;
  task.archivedAt = "";
  state.recentlyRestoredTaskIds[taskId] = true;
  persistStateSilently();
  render();
  setUndoAction({
    undo: async () => {
      task.archived = true;
      task.archivedAt = new Date().toISOString();
      persistStateSilently();
      render();
      await syncTaskUpdate(task, `已撤销恢复：${task.name}`);
    },
  });
  await syncTaskUpdate(task, `已恢复任务：${task.name}`);
}

function updateWeeklySummaryDraft(value) {
  state.weeklySummaryDrafts[state.selectedWeek] = value;
  renderWeeklySummaryMeta();
}

async function saveWeeklySummary() {
  const currentWeek = state.selectedWeek;
  const content =
    elements.weeklySummaryInput && !elements.weeklySummaryInput.hidden
      ? String(elements.weeklySummaryInput.value || "").trim()
      : getWeeklySummaryDraft(currentWeek).trim();
  const summary = {
    content,
    updatedAt: new Date().toISOString(),
  };
  closeWeeklySummarySaveModal();
  state.data.weeklySummaries[currentWeek] = summary;
  state.weeklySummaryDrafts[currentWeek] = content;
  setWeeklySummaryMode(currentWeek, content ? "view" : "edit");
  persistStateSilently();
  renderControls();

  if (state.auth.user) {
    markWeeklySummaryPending(currentWeek, summary);
  }

  if (!isRemoteReady()) {
    setSaveStatus(state.auth.user ? "周总结已保存，已标记为待同步" : "周总结已保存");
    return;
  }

  if (state.selectedWeek === currentWeek) {
    elements.weeklySummarySave.disabled = true;
    elements.weeklySummarySave.textContent = "保存中...";
  }

  try {
    await fetchApiJson(`/api/weekly-summaries/${currentWeek}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    clearWeeklySummaryPending(currentWeek);
    setSaveStatus(`已保存 ${formatWeekRangeText(currentWeek)} 的周总结`);
  } catch (error) {
    console.warn("Failed to sync weekly summary.", error);
    setSaveStatus("周总结已保存在本地，云端同步稍后重试");
  } finally {
    if (state.selectedWeek === currentWeek) {
      elements.weeklySummarySave.disabled = false;
    }
    renderControls();
  }
}

function editWeeklySummary() {
  setWeeklySummaryMode(state.selectedWeek, "edit");
  renderControls();
  elements.weeklySummaryInput.focus();
  elements.weeklySummaryInput.setSelectionRange(
    elements.weeklySummaryInput.value.length,
    elements.weeklySummaryInput.value.length,
  );
}

function exportDashboardData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    data: state.data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `lifeflow-dashboard-${formatDateKey(new Date())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setSaveStatus("已导出当前 Dashboard 数据");
}

function openWidgetSettings(widget) {
  state.modal.widget = widget;
  renderModal();
}

function closeModal() {
  state.modal.widget = null;
  renderModal();
}

function saveSettings(formData) {
  if (state.modal.widget === "weather") {
    state.data.preferences.widgets.weather = {
      title: "Weather",
      locationQuery: String(formData.get("locationQuery") || "").trim(),
    };
    saveData("已保存 Weather 设置");
    closeModal();
    if (state.auth.user) {
      void saveAccountPreferencesRemote().catch((error) => {
        console.warn("Failed to save weather preferences remotely.", error);
        setSaveStatus("Weather 设置已保存在本地，云端同步稍后重试");
      });
    }
    void refreshWeather().finally(() => {
      renderWidgets();
    });
    return;
  }

  if (state.modal.widget === "stock") {
    state.data.preferences.widgets.stock = {
      title: "A股概览",
      symbols: normalizeSymbols(
        String(formData.get("symbols") || defaultWidgets.stock.symbols),
      ),
    };
    saveData("已保存 Stock 设置");
    closeModal();
    if (state.auth.user) {
      void saveAccountPreferencesRemote().catch((error) => {
        console.warn("Failed to save stock preferences remotely.", error);
        setSaveStatus("Stock 设置已保存在本地，云端同步稍后重试");
      });
    }
    refreshStocks();
    renderWidgets();
  }
}

async function initAuthClient() {
  state.auth.status = "authenticating";
  renderControls();

  try {
    const payload = await fetchAuthSession();
    state.auth.user = payload.user || null;
    saveSessionId(payload?.session?.id || loadSessionId());
    if (state.auth.user?.id) {
      switchDataScope(state.auth.user.id);
      if (payload?.user?.preferences) {
        applyAccountPreferences(payload.user.preferences, { applyTheme: true });
      }
    }
    state.auth.status = state.auth.user ? "ready" : "idle";
    state.auth.feedback = state.auth.user
      ? `已登录 ${state.auth.user.username}`
      : "请先登录你的账号。";

    if (!state.auth.user) {
      saveSessionId("");
      redirectToLoginPage();
      return null;
    }

    renderControls();
    setAppVisibility(true);
    void bootstrapRemoteData();
    return state.auth.user;
  } catch (error) {
    state.auth.user = null;
    state.auth.status = "idle";
    state.auth.feedback = "请先登录你的账号。";
    saveSessionId("");
    renderControls();
    redirectToLoginPage();
    return null;
  }
}

async function fetchAuthSession() {
  try {
    return await fetchApiJson("/api/auth/me", { requireAuth: false });
  } catch (error) {
    // If a stale cached API base points to the wrong backend, clear it and probe again once.
    state.remote.apiBase = "";
    saveApiBase("");
    return fetchApiJson("/api/auth/me", { requireAuth: false });
  }
}

async function signOutAuth() {
  try {
    await fetchApiJson("/api/auth/signout", {
      method: "POST",
      requireAuth: false,
    });
  } catch (error) {
    console.warn("Failed to sign out.", error);
  }
  state.auth.user = null;
  state.auth.status = "idle";
  state.remote.status = "offline";
  state.remote.apiBase = "";
  state.remote.weeklyReview = null;
  state.remote.connectedThisSession = false;
  saveApiBase("");
  saveSessionId("");
  switchDataScope(LOCAL_SCOPE_KEY);
  window.location.href = "./login.html";
}

function resetCurrentAccountLocalState(scopeKey = getCurrentScopeKey()) {
  const preservedPreferences = structuredClone(state.data.preferences);
  clearScopedStorage(scopeKey);
  delete state.pendingSync[scopeKey];
  persistPendingSyncStore();
  if (state.remote.apiBase) {
    localStorage.removeItem(`${API_SEED_PREFIX}${state.remote.apiBase}:${scopeKey}`);
  }
  state.data = createInitialData(scopeKey);
  state.data.preferences = preservedPreferences;
  persistScopedData(scopeKey, state.data);
  resetScopedUiState();
}

async function syncAccountPreferencesFromRemote() {
  if (!state.auth.user || !isRemoteReady()) {
    return;
  }
  const payload = await fetchApiJson("/api/account/profile");
  if (payload?.user?.preferences) {
    applyAccountPreferences(payload.user.preferences, { applyTheme: true });
  }
}

async function handleChangePasswordSubmit(event) {
  if (event.target !== elements.changePasswordForm) {
    return;
  }
  event.preventDefault();
  const formData = new FormData(elements.changePasswordForm);
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  if (!currentPassword || !newPassword || !confirmPassword) {
    state.auth.feedback = "请完整填写密码信息。";
    renderChangePasswordModal();
    return;
  }
  if (newPassword !== confirmPassword) {
    state.auth.feedback = "两次输入的新密码不一致。";
    renderChangePasswordModal();
    return;
  }
  state.changePasswordSubmitting = true;
  state.auth.feedback = "正在更新密码...";
  renderChangePasswordModal();
  try {
    await fetchApiJson("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setSaveStatus("密码已更新", "success");
    closeChangePasswordModal();
  } catch (error) {
    console.warn("Failed to change password.", error);
    state.auth.feedback = error?.message || "修改密码失败";
    state.changePasswordSubmitting = false;
    renderChangePasswordModal();
  }
}

async function clearAccountData() {
  if (!state.auth.user || state.clearAccountDataSubmitting) {
    return;
  }
  state.clearAccountDataSubmitting = true;
  renderClearAccountDataModal();
  try {
    await fetchApiJson("/api/account/clear-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    resetCurrentAccountLocalState(state.auth.user.id);
    closeClearAccountDataModal();
    render();
    setSaveStatus("当前账号数据已清空", "success");
  } catch (error) {
    console.warn("Failed to clear account data.", error);
    state.clearAccountDataSubmitting = false;
    setSaveStatus(error?.message || "清空账号数据失败");
    renderClearAccountDataModal();
  }
}

async function handleDeleteAccountSubmit(event) {
  if (event.target !== elements.deleteAccountForm) {
    return;
  }
  event.preventDefault();
  if (!state.auth.user || state.deleteAccountSubmitting) {
    return;
  }
  const formData = new FormData(elements.deleteAccountForm);
  const password = String(formData.get("password") || "");
  if (!password) {
    state.auth.feedback = "请输入当前密码。";
    renderDeleteAccountModal();
    return;
  }
  state.deleteAccountSubmitting = true;
  state.auth.feedback = "正在删除账号...";
  renderDeleteAccountModal();
  try {
    await fetchApiJson("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const scopeKey = state.auth.user.id;
    resetCurrentAccountLocalState(scopeKey);
    saveSessionId("");
    saveAuthConfig({ username: "" });
    window.location.href = "./login.html";
  } catch (error) {
    console.warn("Failed to delete account.", error);
    state.auth.feedback = error?.message || "删除账号失败";
    state.deleteAccountSubmitting = false;
    renderDeleteAccountModal();
  }
}

async function bootstrapRemoteData() {
  if (remoteBootstrapPromise) {
    return remoteBootstrapPromise;
  }

  remoteBootstrapPromise = (async () => {
  if (!state.auth.user) {
    state.remote.status = "offline";
    state.remote.apiBase = "";
    state.remote.weeklyReview = null;
    state.remote.connectedThisSession = false;
    saveApiBase("");
    setSaveStatus("未登录云端账号，当前使用本地保存");
    renderControls();
    return;
  }

  const localSnapshot = structuredClone(state.data);
  const shouldShowConnecting = !isRemoteReady();
  if (shouldShowConnecting) {
    state.remote.status = "connecting";
    setSaveStatus("正在检测后端连接...");
    renderControls();
  }

  const apiBase = state.remote.apiBase || (await detectApiBase());
  if (!apiBase) {
    state.remote.status = "offline";
    setSaveStatus("未连接后端，当前使用本地保存");
    renderControls();
    return;
  }

  state.remote.status = "connecting";
  state.remote.apiBase = apiBase;
  state.remote.connectedThisSession = true;
  saveApiBase(apiBase);
  renderControls();

  try {
    if (hasPendingSync()) {
      await flushPendingSync();
    } else {
      await seedRemoteFromLocal(localSnapshot);
    }
    await syncAccountPreferencesFromRemote();
    await syncTasksFromRemote();
    await Promise.all([
      syncSelectedDateRecord({ silent: true }),
      syncSelectedWeekReview({ silent: true }),
      syncSelectedWeekSummary({ silent: true }),
    ]);
    state.remote.status = "ready";
    if (shouldShowConnecting || state.remote.status !== "ready") {
      setSaveStatus("后端已连接，当前通过 API 同步数据");
    }
    render();
  } catch (error) {
    console.warn("Failed to bootstrap remote data.", error);
    state.remote.status = "offline";
    state.remote.apiBase = "";
    state.remote.weeklyReview = null;
    state.remote.connectedThisSession = false;
    saveApiBase("");
    renderControls();
    setSaveStatus("后端同步失败，已回退为本地保存");
  }
  })();

  try {
    return await remoteBootstrapPromise;
  } finally {
    remoteBootstrapPromise = null;
  }
}

async function refreshRemoteForCurrentUser() {
  if (!isRemoteReady()) {
    renderControls();
    return;
  }

  state.remote.status = "connecting";
  state.remote.weeklyReview = null;
  setSaveStatus(
    state.auth.user
      ? `正在切换到 ${state.auth.user.username} 的云端数据...`
      : "正在切换到公共数据...",
  );
  renderControls();

  try {
    await syncTasksFromRemote();
    await Promise.all([
      syncSelectedDateRecord({ silent: true }),
      syncSelectedWeekReview({ silent: true }),
      syncSelectedWeekSummary({ silent: true }),
    ]);
    state.remote.status = "ready";
    setSaveStatus(
      state.auth.user
        ? `已连接云端账号：${state.auth.user.username}`
        : "已切换回公共云端数据",
    );
  } catch (error) {
    console.warn("Failed to refresh remote data for current user.", error);
    state.remote.status = "sync-error";
    setSaveStatus("用户数据切换失败，当前仍显示本地缓存");
  }

  render();
}

async function seedRemoteFromLocal(snapshot) {
  if (!snapshot || !isRemoteReady() || state.auth.user) {
    return;
  }

  const seedKey = `${API_SEED_PREFIX}${state.remote.apiBase}:${getCurrentScopeKey()}`;
  if (localStorage.getItem(seedKey) === "done") {
    return;
  }

  const remoteTaskPayload = await fetchApiJson("/api/tasks");
  const remoteTaskIds = new Set(
    (remoteTaskPayload.tasks || []).map((task) => task.id),
  );
  const localTasks = sanitizeTaskTypes(snapshot.taskTypes);

  await Promise.all(
    localTasks
      .filter((task) => !remoteTaskIds.has(task.id))
      .map((task) =>
        fetchApiJson("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: task.id,
            name: task.name,
            color: task.color,
            displayOrder: task.order,
            archived: Boolean(task.archived),
            archivedAt: task.archivedAt || null,
          }),
        }),
      ),
  );

  const entries = Object.entries(snapshot.dailyRecords || {}).filter(
    ([, record]) => hasMeaningfulRecord(record),
  );

  await Promise.all(
    entries.map(([date, record]) =>
      fetchApiJson(`/api/daily-records/${date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRemoteDailyPayload(record)),
      }),
    ),
  );

  const weeklySummaryEntries = Object.entries(snapshot.weeklySummaries || {}).filter(
    ([, summary]) => summary && typeof summary.content === "string" && summary.content.trim(),
  );
  await Promise.all(
    weeklySummaryEntries.map(([week, summary]) =>
      fetchApiJson(`/api/weekly-summaries/${week}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: summary.content || "" }),
      }),
    ),
  );

  localStorage.setItem(seedKey, "done");
}

function hasMeaningfulRecord(record) {
  if (!record?.tasks) {
    return false;
  }

  return Object.values(record.tasks).some((taskState) => {
    return (
      Boolean(taskState?.completed) ||
      (Array.isArray(taskState?.notes) && taskState.notes.length > 0)
    );
  });
}

async function detectApiBase() {
  const candidates = getApiBaseCandidates();
  const [preferred, ...fallbacks] = candidates;

  if (preferred) {
    try {
      const health = await fetchJson(joinApiPath(preferred, "/health"), {
        timeoutMs: API_PROBE_TIMEOUT_MS,
      });
      if (health?.ok) {
        return preferred;
      }
    } catch (error) {
      // Ignore probe failures and continue with the fallback candidates.
    }
  }

  if (fallbacks.length === 0) {
    return "";
  }

  try {
    return await Promise.any(
      fallbacks.map(async (baseUrl) => {
        const health = await fetchJson(joinApiPath(baseUrl, "/health"), {
          timeoutMs: API_PROBE_TIMEOUT_MS,
        });
        if (!health?.ok) {
          throw new Error("Healthcheck failed");
        }
        return baseUrl;
      }),
    );
  } catch (error) {
    // Ignore probe failures and fall back to local mode.
  }
  return "";
}

function getApiBaseCandidates() {
  const fromStorage = localStorage.getItem(API_BASE_STORAGE_KEY) || "";
  const runtimeBase =
    typeof window !== "undefined" &&
    typeof window.LIFEFLOW_API_BASE === "string"
      ? window.LIFEFLOW_API_BASE
      : "";
  const localhostBase =
    window.location.hostname && window.location.hostname !== "localhost"
      ? "http://localhost:8787"
      : `${window.location.protocol}//${window.location.hostname || "localhost"}:8787`;
  const isLocalHost = ["localhost", "127.0.0.1"].includes(
    window.location.hostname,
  );
  const isStoredLocalhost =
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(fromStorage);
  const preferred = isLocalHost
    ? [
        fromStorage,
        runtimeBase,
        localhostBase,
        "http://127.0.0.1:8787",
        DEFAULT_REMOTE_API_BASE,
      ]
    : [
        isStoredLocalhost ? "" : fromStorage,
        runtimeBase,
        DEFAULT_REMOTE_API_BASE,
        localhostBase,
        "http://127.0.0.1:8787",
      ];

  return [...new Set(preferred)].map((item) => item.trim()).filter(Boolean);
}

function joinApiPath(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function isRemoteReady() {
  return state.remote.status === "ready" && Boolean(state.remote.apiBase);
}

async function fetchApiJson(path, options = {}) {
  const requireAuth = options.requireAuth !== false;
  if (!state.remote.apiBase) {
    state.remote.apiBase = localStorage.getItem(API_BASE_STORAGE_KEY) || "";
  }
  if (!state.remote.apiBase) {
    state.remote.apiBase = await detectApiBase();
  }
  if (!state.remote.apiBase || (!isRemoteReady() && requireAuth)) {
    if (!requireAuth && state.remote.apiBase) {
      // allow auth endpoints during initial handshake
    } else {
      throw new Error("Remote API unavailable");
    }
  }
  const headers = new Headers(options.headers || {});
  const sessionId = loadSessionId();
  if (sessionId) {
    headers.set("x-session-id", sessionId);
  }
  return fetchJson(joinApiPath(state.remote.apiBase, path), {
    ...options,
    headers,
  });
}

async function syncTasksFromRemote() {
  const payload = await fetchApiJson("/api/tasks");
  const remoteTasks = sanitizeTaskTypes(
    (payload.tasks || []).map((task, index) => ({
      id: task.id,
      name: task.name,
      order: Number(task.display_order) || index + 1,
      color: task.color || getFallbackColor(index),
      archived: Boolean(task.archived),
      archivedAt: task.archived_at || "",
    })),
  );
  state.data.taskTypes = remoteTasks;
  Object.entries(state.data.dailyRecords).forEach(([dateKey, record]) => {
    const recordDate = record?.date || dateKey;
    const scopedTaskTypes = getTaskTypesForDate(recordDate);
    const nextTasks = createEmptyTaskState(scopedTaskTypes);
    scopedTaskTypes.forEach((task) => {
      if (record.tasks[task.id]) {
        nextTasks[task.id] = migrateTaskRecord(
          record.tasks[task.id],
          record.updatedAt,
          recordDate,
        );
      }
    });
    record.date = recordDate;
    record.tasks = nextTasks;
  });
  ensureRecord(state.selectedDate);
  persistStateSilently();
}

async function syncSelectedDateRecord(options = {}) {
  if (!isRemoteReady()) {
    return ensureRecord(state.selectedDate);
  }

  const payload = await fetchApiJson(
    `/api/daily-records/${state.selectedDate}`,
  );
  const record = normalizeRemoteRecord(payload.record, state.selectedDate);
  state.data.dailyRecords[state.selectedDate] = record;
  persistStateSilently();

  if (!options.silent) {
    setSaveStatus(
      `已同步 ${formatDisplayDate(parseLocalDate(state.selectedDate))} 的记录`,
    );
  }

  return record;
}

async function syncSelectedWeekReview(options = {}) {
  if (!isRemoteReady()) {
    state.remote.weeklyReview = null;
    return null;
  }

  const payload = await fetchApiJson(
    `/api/weekly-review/${state.selectedWeek}`,
  );
  state.remote.weeklyReview = payload;

  if (!options.silent) {
    setSaveStatus(`已同步 ${formatWeekRangeText(state.selectedWeek)} 的周复盘`);
  }

  return payload;
}

async function syncSelectedWeekSummary(options = {}) {
  if (!isRemoteReady()) {
    return state.data.weeklySummaries[state.selectedWeek] || null;
  }

  const payload = await fetchApiJson(`/api/weekly-summaries/${state.selectedWeek}`);
  state.data.weeklySummaries[state.selectedWeek] = {
    content: payload.summary?.content || "",
    updatedAt: payload.summary?.updatedAt || "",
  };
  delete state.weeklySummaryDrafts[state.selectedWeek];
  setWeeklySummaryMode(
    state.selectedWeek,
    state.data.weeklySummaries[state.selectedWeek].content ? "view" : "edit",
  );
  persistStateSilently();

  if (!options.silent) {
    setSaveStatus(`已同步 ${formatWeekRangeText(state.selectedWeek)} 的周总结`);
  }

  return state.data.weeklySummaries[state.selectedWeek];
}

function normalizeRemoteRecord(record, fallbackDate) {
  const date = record?.date || fallbackDate;
  const scopedTaskTypes = getTaskTypesForDate(date);
  const nextRecord = createEmptyDailyRecord(date, scopedTaskTypes);
  const payloadTasks = record?.payload?.tasks || {};

  scopedTaskTypes.forEach((task) => {
    nextRecord.tasks[task.id] = {
      completed: Boolean(payloadTasks[task.id]?.completed),
      notes: Array.isArray(payloadTasks[task.id]?.notes)
        ? payloadTasks[task.id].notes.map((note) => ({
            id: note.id,
            text: note.text,
            createdAt: note.createdAt,
          }))
        : [],
    };
  });

  nextRecord.mood =
    typeof record?.payload?.mood === "string" ? record.payload.mood : "";
  nextRecord.dailySummary =
    typeof record?.payload?.dailySummary === "string"
      ? record.payload.dailySummary
      : "";
  nextRecord.updatedAt = record?.updatedAt || "";
  return nextRecord;
}

function buildRemoteDailyPayload(record) {
  const tasks = {};
  const recordDate = record?.date || state.selectedDate;
  getTaskTypesForDate(recordDate).forEach((task) => {
    const taskState = record.tasks[task.id] || { completed: false, notes: [] };
    tasks[task.id] = {
      completed: Boolean(taskState.completed),
      notes: Array.isArray(taskState.notes)
        ? taskState.notes.map((note) => ({
            id: note.id,
            text: note.text,
            createdAt: note.createdAt,
          }))
        : [],
    };
  });

  return {
    tasks,
    mood: record.mood || "",
    dailySummary: record.dailySummary || "",
  };
}

async function syncCurrentRecord(successMessage) {
  persistStateSilently();
  if (state.auth.user) {
    markRecordPending(state.selectedDate);
  }

  if (!isRemoteReady()) {
    setSaveStatus(
      state.auth.user
        ? `${successMessage}，已标记为待同步`
        : successMessage,
    );
    return;
  }

  try {
    const record = ensureRecord(state.selectedDate);
    const payload = buildRemoteDailyPayload(record);
    const response = await fetchApiJson(
      `/api/daily-records/${state.selectedDate}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    state.data.dailyRecords[state.selectedDate] = normalizeRemoteRecord(
      response.record,
      state.selectedDate,
    );
    clearRecordPending(state.selectedDate);
    await syncSelectedWeekReview({ silent: true });
    persistStateSilently();
    setSaveStatus(successMessage);
  } catch (error) {
    console.warn("Failed to sync daily record.", error);
    setSaveStatus(
      state.auth.user
        ? `${successMessage}，已标记为待同步`
        : `${successMessage}，但后端同步失败，当前仅保存在本地`,
    );
  }
}

async function syncRecordByDate(date) {
  persistStateSilently();
  if (state.auth.user) {
    markRecordPending(date);
  }

  if (!isRemoteReady()) {
    return;
  }

  const record = ensureRecord(date);
  const payload = buildRemoteDailyPayload(record);
  const response = await fetchApiJson(`/api/daily-records/${date}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  state.data.dailyRecords[date] = normalizeRemoteRecord(response.record, date);
  clearRecordPending(date);
  persistStateSilently();
}

async function syncTaskCreate(task, successMessage) {
  persistStateSilently();
  if (state.auth.user) {
    markTaskUpsertPending(task);
  }

  if (!isRemoteReady()) {
    setSaveStatus(
      state.auth.user
        ? `${successMessage}，已标记为待同步`
        : successMessage,
    );
    return;
  }

  try {
    await fetchApiJson("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: task.id,
        name: task.name,
        color: task.color,
        displayOrder: task.order,
        archived: Boolean(task.archived),
        archivedAt: task.archivedAt || null,
      }),
    });
    await syncTasksFromRemote();
    clearTaskPending(task.id);
    await syncCurrentRecord(successMessage);
    render();
  } catch (error) {
    console.warn("Failed to create task remotely.", error);
    setSaveStatus(
      state.auth.user
        ? `${successMessage}，已标记为待同步`
        : `${successMessage}，但后端同步失败，当前仅保存在本地`,
    );
  }
}

async function syncTaskDelete(taskId, successMessage) {
  persistStateSilently();
  if (state.auth.user) {
    markTaskDeletePending(taskId);
  }

  if (!isRemoteReady()) {
    setSaveStatus(
      state.auth.user
        ? `${successMessage}，已标记为待同步`
        : successMessage,
    );
    return;
  }

  try {
    await fetchApiJson(`/api/tasks/${taskId}`, { method: "DELETE" });
    clearTaskPending(taskId);
    await syncTasksFromRemote();
    await syncSelectedWeekReview({ silent: true });
    persistStateSilently();
    setSaveStatus(successMessage);
  } catch (error) {
    console.warn("Failed to delete task remotely.", error);
    setSaveStatus(
      state.auth.user
        ? `${successMessage}，已标记为待同步`
        : `${successMessage}，但后端同步失败，当前仅保存在本地`,
    );
  }
}

async function syncTaskUpdate(task, successMessage) {
  persistStateSilently();
  if (state.auth.user) {
    markTaskUpsertPending(task);
  }

  if (!isRemoteReady()) {
    setSaveStatus(
      state.auth.user
        ? `${successMessage}，已标记为待同步`
        : successMessage,
    );
    return;
  }

  try {
    await fetchApiJson(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: task.name,
        color: task.color,
        displayOrder: task.order,
        archived: Boolean(task.archived),
        archivedAt: task.archivedAt || null,
      }),
    });
    clearTaskPending(task.id);
    await syncTasksFromRemote();
    persistStateSilently();
    render();
    setSaveStatus(successMessage);
  } catch (error) {
    console.warn("Failed to update task remotely.", error);
    setSaveStatus(
      state.auth.user
        ? `${successMessage}，已标记为待同步`
        : `${successMessage}，但后端同步失败，当前仅保存在本地`,
    );
  }
}

async function refreshExternalData() {
  const jobs = [];
  if (getSidebarPreferences().github) {
    jobs.push(refreshGitHubRepo());
  }
  if (getSidebarPreferences().weather) {
    jobs.push(refreshWeather());
  }
  if (getSidebarPreferences().stock) {
    jobs.push(refreshStocks());
  }
  await Promise.allSettled(jobs);
  renderWidgets();
}

function parseGitHubOwnerFromUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw);
    if (!/github\.com$/i.test(parsed.hostname)) {
      return "";
    }
    const [owner] = parsed.pathname.split("/").filter(Boolean);
    return owner || "";
  } catch (error) {
    return "";
  }
}

async function refreshGitHubRepo() {
  const profileUrl = String(state.data.preferences.widgets.github?.profileUrl || "").trim();
  const owner = parseGitHubOwnerFromUrl(profileUrl);
  const fallback = {
    status: "fallback",
    repos: [
      {
        name: "DanN-55 / life-flow",
        description: "Dashboard preview for personal execution, market notes and research reading.",
        updatedAt: "",
        url: "https://github.com/DanN-55/life-flow",
        shortUrl: "life-flow",
      },
    ],
    url: profileUrl,
    message: "最近活跃仓库",
  };
  if (!owner || !profileUrl) {
    state.widgetData.github = {
      status: "idle",
      repos: [],
      url: profileUrl,
      message: "等待配置 GitHub 主页",
    };
    return;
  }
  state.widgetData.github = {
    ...state.widgetData.github,
    status: "loading",
    url: profileUrl,
    message: "正在同步仓库列表",
  };
  renderWidgets();

  try {
    const payload = await fetchJson(
      `https://api.github.com/users/${owner}/repos?sort=pushed&per_page=6`,
      {
        credentials: "omit",
        timeoutMs: 6000,
        headers: {
          Accept: "application/vnd.github+json",
        },
      },
    );
    const repos = Array.isArray(payload)
      ? payload
          .filter((repo) => !repo.fork)
          .sort((left, right) => {
            const leftTime = new Date(left.pushed_at || left.updated_at || 0).getTime();
            const rightTime = new Date(right.pushed_at || right.updated_at || 0).getTime();
            return rightTime - leftTime;
          })
          .slice(0, 3)
          .map((repo) => ({
            name: repo.full_name || repo.name || "Repository",
            description: repo.description || "暂无仓库简介。",
            updatedAt: repo.pushed_at || repo.updated_at || "",
            url: repo.html_url || profileUrl,
            shortUrl: repo.name || "Open Repo",
          }))
      : [];
    state.widgetData.github = {
      status: "ready",
      repos: repos.length ? repos : fallback.repos,
      url: profileUrl,
      message: "最近活跃仓库",
    };
  } catch (error) {
    state.widgetData.github = {
      ...fallback,
      status: "error",
      url: profileUrl,
      message: "GitHub 预览暂时不可用",
    };
  }
}

async function refreshWeather() {
  const cachedWeather = loadWeatherCache();
  state.widgetData.weather = {
    ...cachedWeather,
    status: "loading",
    location: cachedWeather.location || "定位中...",
    temperature: cachedWeather.temperature || "--",
    detail: cachedWeather.forecast.length ? "正在刷新天气信息" : "正在获取天气信息",
    message: cachedWeather.forecast.length
      ? "当前展示最近一次成功结果"
      : "",
  };
  renderWidgets();

  try {
    const manualLocation = String(
      state.data.preferences.widgets.weather?.locationQuery || "",
    ).trim();
    const browserLocation = manualLocation ? null : await getAutoLocation().catch(() => null);
    const query = manualLocation
      ? `?query=${encodeURIComponent(manualLocation)}`
      : browserLocation
        ? `?latitude=${encodeURIComponent(browserLocation.latitude)}&longitude=${encodeURIComponent(browserLocation.longitude)}`
        : "";
    const payload = await fetchApiJson(`/api/widgets/weather${query}`, {
      requireAuth: false,
    });
    const forecast = Array.isArray(payload?.weather?.forecast)
      ? payload.weather.forecast.map((item) => ({
          max: item.max,
          min: item.min,
          date: item.date,
          dayLabel: formatWeekday(item.date),
          axisLabel: formatWeekdayShortEn(item.date),
          dateLabel: formatMonthDayLabel(item.date),
        }))
      : [];

    state.widgetData.weather = {
      ...createEmptyWeatherState(),
      ...payload.weather,
      status: "ready",
      forecast,
    };
    saveWeatherCache(state.widgetData.weather);
  } catch (error) {
    if (cachedWeather.forecast.length) {
      state.widgetData.weather = {
        ...cachedWeather,
        status: "stale",
        detail: cachedWeather.detail || "已展示最近一次天气结果",
        message: "定位暂时不可用，当前展示最近一次成功结果",
      };
      return;
    }
    state.widgetData.weather = {
      ...createEmptyWeatherState(),
      status: "error",
      location: "位置不可用",
      temperature: "--",
      detail: "未能获取天气数据",
      message: "定位与天气接口均失败，请点击刷新重试",
    };
  }
}

async function refreshStocks() {
  const queries = normalizeSymbols(state.data.preferences.widgets.stock.symbols)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);

  state.widgetData.stock = {
    status: "loading",
    symbols: [],
    message: "正在获取行情",
  };
  renderWidgets();

  try {
    const resolved = await resolveAStockQueries(queries);
    if (!resolved.length) {
      throw new Error("No stock resolved");
    }
    const quotes = await fetchSinaQuotes(resolved.map((item) => item.symbol));

    state.widgetData.stock = {
      status: "ready",
      symbols: resolved.map((item) => {
        const quote = quotes.find((entry) => entry.symbol === item.symbol);
        if (!quote) {
          return {
            symbol: item.symbol,
            name: item.name,
            price: "--",
            change: "--",
            trend: "flat",
          };
        }
        return {
          symbol: item.symbol.toUpperCase(),
          name: quote.name || item.name,
          price: quote.price,
          change: quote.change,
          trend: quote.trend,
        };
      }),
      message: "A 股实时行情",
    };
  } catch (error) {
    state.widgetData.stock = {
      status: "error",
      symbols: queries.map((symbol) => ({
        symbol,
        name: symbol,
        price: "--",
        change: "--",
        trend: "flat",
      })),
      message: "A 股行情获取失败，请检查代码或名称",
    };
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs =
    Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : 0;
  const timeoutId = timeoutMs
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : 0;
  const response = await fetch(url, {
    ...options,
    credentials: options.credentials || "include",
    signal: options.signal || controller.signal,
  }).finally(() => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function getAutoLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      reject,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
    );
  });
}

function normalizeSymbols(value) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(",");
}

function normalizeThemePreference(theme) {
  return theme === "dark" ? "dark" : "light";
}

async function resolveAStockQueries(queries) {
  const results = [];
  for (const query of queries) {
    const resolved = isAStockCode(query)
      ? normalizeAStockCode(query)
      : await resolveStockByName(query);
    if (resolved) {
      results.push(resolved);
    }
  }
  return dedupeStocks(results);
}

function isAStockCode(query) {
  return /^(sh|sz)?\d{6}$/i.test(query);
}

function normalizeAStockCode(query) {
  const normalized = query.toLowerCase();
  if (/^(sh|sz)\d{6}$/.test(normalized)) {
    return { symbol: normalized, name: normalized.toUpperCase() };
  }
  const code = normalized.replace(/\D/g, "");
  const prefix = /^(5|6|9)/.test(code) ? "sh" : "sz";
  return { symbol: `${prefix}${code}`, name: code };
}

async function resolveStockByName(query) {
  const callbackName = `stock_suggest_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const raw = await loadScriptVariable(
    `https://suggest3.sinajs.cn/suggest/type=11,12,13,14,15&key=${encodeURIComponent(query)}&name=${callbackName}`,
    callbackName,
  );

  if (!raw) {
    return null;
  }

  const firstEntry = String(raw)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)[0];

  if (!firstEntry) {
    return null;
  }

  const tokens = firstEntry
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const symbol = tokens.find((item) => /^(sh|sz)\d{6}$/i.test(item));
  const name = tokens.find((item) => /[\u4e00-\u9fa5]/.test(item)) || query;

  return symbol ? { symbol: symbol.toLowerCase(), name } : null;
}

function dedupeStocks(stocks) {
  const seen = new Set();
  return stocks.filter((item) => {
    if (seen.has(item.symbol)) {
      return false;
    }
    seen.add(item.symbol);
    return true;
  });
}

async function fetchSinaQuotes(symbols) {
  if (!symbols.length) {
    return [];
  }

  await loadRemoteScript(`https://hq.sinajs.cn/list=${symbols.join(",")}`);
  return symbols
    .map((symbol) => {
      const raw = window[`hq_str_${symbol}`];
      if (!raw) {
        return null;
      }
      const parts = String(raw).split(",");
      const name = parts[0] || symbol.toUpperCase();
      const prevClose = Number(parts[2]) || 0;
      const price = Number(parts[3]) || 0;
      const changeValue = prevClose
        ? ((price - prevClose) / prevClose) * 100
        : 0;
      return {
        symbol,
        name,
        price: price ? price.toFixed(2) : "--",
        change: `${changeValue >= 0 ? "+" : ""}${changeValue.toFixed(2)}%`,
        trend: changeValue > 0 ? "up" : changeValue < 0 ? "down" : "flat",
      };
    })
    .filter(Boolean);
}

function loadRemoteScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });
}

async function loadScriptVariable(src, variableName) {
  await loadRemoteScript(src);
  const value = window[variableName];
  try {
    delete window[variableName];
  } catch (error) {
    window[variableName] = undefined;
  }
  return value;
}

function buildWeatherPolyline(forecast) {
  const values = forecast
    .flatMap((item) => [item.max, item.min])
    .filter((value) => Number.isFinite(value));
  if (!values.length) {
    return "30,86 250,86";
  }
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;
  return forecast
    .map((item, index) => {
      const x = 30 + (index * 220) / Math.max(forecast.length - 1, 1);
      const avg = (item.max + item.min) / 2;
      const y = 84 - ((avg - minValue) / range) * 60;
      return `${x},${y}`;
    })
    .join(" ");
}

function buildWeatherAxis(forecast) {
  const values = forecast
    .flatMap((item) => [item.max, item.min])
    .filter((value) => Number.isFinite(value));
  if (!values.length) {
    return { max: "--", mid: "--", min: "--" };
  }
  const max = Math.round(Math.max(...values));
  const min = Math.round(Math.min(...values));
  const mid = Math.round((max + min) / 2);
  return { max: `${max}°`, mid: `${mid}°`, min: `${min}°` };
}

function buildWeatherHotspots(forecast) {
  if (!forecast.length) {
    return [];
  }
  return forecast.map((item, index) => ({
    left: (index * 100) / Math.max(forecast.length - 1, 1),
    weekdayLabel: item.dayLabel || `${index + 1}`,
    dateLabel: item.dateLabel || "--/--",
    tempLabel: `${Math.round(item.min)}°C - ${Math.round(item.max)}°C`,
  }));
}

function formatWeekday(dateString) {
  const date = parseIsoDate(dateString);
  if (!date) {
    return "--";
  }
  return new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(date);
}

function formatWeekdayShortEn(dateString) {
  const date = parseIsoDate(dateString);
  if (!date) {
    return "--";
  }
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
}

function formatMonthDayLabel(dateString) {
  const date = parseIsoDate(dateString);
  if (!date) {
    return "--/--";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function sparklinePoints(trend) {
  if (trend === "up") {
    return "0,14 10,12 20,13 30,9 40,8 50,10 60,6 70,7 80,4";
  }
  if (trend === "down") {
    return "0,4 10,6 20,5 30,8 40,9 50,11 60,12 70,13 80,14";
  }
  return "0,9 80,9";
}

function getTaskName(taskId) {
  return (
    state.data.taskTypes.find((item) => item.id === taskId)?.name || taskId
  );
}

function handleTopTabClick(event) {
  const button = event.target.closest("[data-app-tab]");
  if (!button) {
    return;
  }
  state.activeAppTab = button.dataset.appTab;
  renderTopTabs();
  if (state.activeAppTab === "finance" || state.activeAppTab === "science") {
    void ensureContentChannelLoaded(state.activeAppTab);
  }
}

function handleCenterTabClick(event) {
  const button = event.target.closest("[data-center-tab]");
  if (!button) {
    return;
  }
  state.activeCenterTab = button.dataset.centerTab;
  renderCenterTabs();
}

function handleThemeClick(event) {
  const button = event.currentTarget?.matches?.("[data-theme]")
    ? event.currentTarget
    : event.target.closest("[data-theme]");
  if (!button) {
    return;
  }
  updateTheme(button.dataset.theme);
}

async function handleCalendarClick(event) {
  const button = event.target.closest("[data-calendar-date]");
  if (!button) {
    return;
  }
  state.selectedDate = button.dataset.calendarDate;
  ensureRecord(state.selectedDate);
  setSaveStatus(
    `正在加载 ${formatDisplayDate(parseLocalDate(state.selectedDate))} 的记录...`,
  );
  try {
    await syncSelectedDateRecord({ silent: true });
  } catch (error) {
    console.warn("Failed to load remote data for selected date.", error);
  }
  render();
  setSaveStatus(
    `已切换到 ${formatDisplayDate(parseLocalDate(state.selectedDate))}`,
  );
}

async function handleWeeklyRangeChange(event) {
  if (event.target !== elements.weeklyRangePicker) {
    return;
  }

  const nextWeek = String(elements.weeklyRangePicker.value || "").trim();
  if (!nextWeek || nextWeek === state.selectedWeek) {
    renderControls();
    return;
  }

  state.selectedWeek = nextWeek;
  renderControls();
  renderWeeklyReview();
  setSaveStatus(`正在加载 ${formatWeekRangeText(state.selectedWeek)} 的周复盘...`);

  try {
    await syncSelectedWeekReview({ silent: true });
    await syncSelectedWeekSummary({ silent: true });
  } catch (error) {
    console.warn("Failed to load remote weekly review.", error);
  }

  renderWeeklyReview();
  renderControls();
  setSaveStatus(`已切换到 ${formatWeekRangeText(state.selectedWeek)} 的周复盘`);
}

function handleTaskListClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }
  const { action, taskId } = actionTarget.dataset;

  if (action === "toggle-task") {
    void updateTaskCompletion(taskId);
  }
  if (action === "toggle-task-palette") {
    state.activePaletteTaskId =
      state.activePaletteTaskId === taskId ? null : taskId;
    renderTaskList();
  }
  if (action === "set-task-color") {
    state.activePaletteTaskId = null;
    void updateTaskColor(taskId, actionTarget.dataset.color);
  }
  if (action === "set-new-task-color") {
    state.newTaskColor = actionTarget.dataset.color;
    renderTaskList();
  }
  if (action === "start-task-rename") {
    startTaskRename(taskId);
  }
  if (action === "request-delete-task") {
    openDeleteTaskModal(taskId);
  }
  if (action === "archive-task") {
    openArchiveTaskModal(taskId);
  }
  if (action === "submit-note") {
    void submitTaskNote(taskId);
  }
  if (action === "delete-note") {
    void deleteTaskNote(taskId, actionTarget.dataset.noteId);
  }
}

function handleTaskListInput(event) {
  const input = event.target.closest('[data-action="draft-note"]');
  if (input) {
    updateNoteDraft(input.dataset.taskId, input.value);
  }
}

function handleTaskListSubmit(event) {
  const form = event.target.closest("#new-task-form");
  if (!form) {
    return;
  }
  event.preventDefault();
  const taskName = new FormData(form).get("taskName");
  void addTask(String(taskName || ""));
}

function handleWeeklyReviewClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    return;
  }

  const { action, taskId } = actionTarget.dataset;
  if (action === "restore-task") {
    void restoreTask(taskId);
  }
  if (action === "open-task-timeline") {
    openTaskTimelineModal(taskId);
  }
}

function handleWeeklySummaryInput(event) {
  if (event.target !== elements.weeklySummaryInput) {
    return;
  }
  updateWeeklySummaryDraft(elements.weeklySummaryInput.value);
}

function handleWeeklySummarySave() {
  if (!getWeeklySummaryDraft(state.selectedWeek).trim()) {
    setSaveStatus("请先填写周总结内容");
    return;
  }
  openWeeklySummarySaveModal();
}

function handleWeeklySummaryEdit() {
  editWeeklySummary();
}

function handleWeeklyFilterChange(event) {
  const target = event.target;
  if (target === elements.weeklyTaskFilter) {
    state.weeklyFilters.taskId = target.value;
  }
  if (target === elements.weeklyCompletionFilter) {
    state.weeklyFilters.completion = target.value;
  }
  if (target === elements.weeklyNotesFilter) {
    state.weeklyFilters.notes = target.value;
  }
  if (target === elements.weeklyArchiveFilter) {
    state.weeklyFilters.archive = target.value;
  }
  renderWeeklyReview();
}

function handleReviewModeClick(event) {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  if (button === elements.weeklyModeWeek) {
    state.reviewMode = "week";
  }
  if (button === elements.weeklyModeMonth) {
    state.reviewMode = "month";
  }
  renderControls();
  renderWeeklyReview();
}

function handleMonthlyRangeChange(event) {
  if (event.target !== elements.monthlyRangePicker) {
    return;
  }
  state.selectedMonth = String(elements.monthlyRangePicker.value || state.selectedMonth);
  renderControls();
  renderWeeklyReview();
  setSaveStatus(`已切换到 ${formatMonthRangeText(state.selectedMonth)} 的复盘`, "success");
}

function handleExportData() {
  exportDashboardData();
}

function handleShowMoreClick(event) {
  const button = event.target.closest("[data-app-tab-target]");
  if (!button) {
    return;
  }
  state.activeAppTab = button.dataset.appTabTarget;
  renderTopTabs();
  if (state.activeAppTab === "finance" || state.activeAppTab === "science") {
    void ensureContentChannelLoaded(state.activeAppTab);
  }
}

function getContentChannelFromControl(control) {
  if (
    control === elements.financeSearch ||
    control === elements.financeTagFilter ||
    control === elements.financeSourceFilter ||
    control === elements.financeFavoriteFilter ||
    control === elements.financeSortFilter
  ) {
    return "finance";
  }
  if (
    control === elements.scienceSearch ||
    control === elements.scienceTagFilter ||
    control === elements.scienceSourceFilter ||
    control === elements.scienceFavoriteFilter ||
    control === elements.scienceSortFilter
  ) {
    return "science";
  }
  return "";
}

function handleContentToolbarInput(event) {
  const channel = getContentChannelFromControl(event.target);
  if (!channel || event.target.type !== "search") {
    return;
  }
  queueContentSearch(channel, event.target.value);
}

function handleContentToolbarChange(event) {
  const channel = getContentChannelFromControl(event.target);
  if (!channel || event.target.type === "search") {
    return;
  }
  const channelElements = getContentElements(channel);
  void loadChannelContent(channel, {
    page: 1,
    tag: channelElements.tagFilter.value,
    sourceId: channelElements.sourceFilter.value,
    favorite: channelElements.favoriteFilter.value,
    sort: channelElements.sortFilter.value,
  });
}

function handleContentClick(event) {
  const detailCloseTarget = event.target.closest("[data-content-detail-modal-close]");
  if (detailCloseTarget) {
    closeContentDetailModal();
    return;
  }

  const sourceCloseTarget = event.target.closest("[data-content-source-modal-close]");
  if (sourceCloseTarget) {
    closeContentSourceModal();
    return;
  }

  const refreshTarget = event.target.closest("[data-content-refresh]");
  if (refreshTarget) {
    void refreshChannelContentManually(refreshTarget.dataset.contentRefresh || "");
    return;
  }

  const openSourcesTarget = event.target.closest("[data-content-open-sources]");
  if (openSourcesTarget) {
    void openContentSourceModal(openSourcesTarget.dataset.contentOpenSources || "");
    return;
  }

  const pageTarget = event.target.closest("[data-content-page]");
  if (pageTarget) {
    const [channel, pageValue] = String(pageTarget.dataset.contentPage || "").split(":");
    const page = Number(pageValue);
    if (["finance", "science"].includes(channel) && Number.isFinite(page) && page > 0) {
      void loadChannelContent(channel, { page });
    }
    return;
  }

  const sourceEditTarget = event.target.closest("[data-content-source-edit]");
  if (sourceEditTarget && state.content.sourceModalChannel) {
    state.content.sourceEditingId = sourceEditTarget.dataset.contentSourceEdit || "";
    renderContentSourceModal();
    return;
  }

  const sourceDeleteTarget = event.target.closest("[data-content-source-delete]");
  if (sourceDeleteTarget && state.content.sourceModalChannel) {
    const sourceId = sourceDeleteTarget.dataset.contentSourceDelete || "";
    if (sourceId && window.confirm("确认删除这个信源吗？")) {
      void deleteContentSource(state.content.sourceModalChannel, sourceId);
    }
    return;
  }

  const favoriteTarget = event.target.closest("[data-content-favorite]");
  if (favoriteTarget) {
    void toggleContentFavorite(favoriteTarget.dataset.contentFavorite || "");
    return;
  }

  const itemTarget = event.target.closest("[data-content-open]");
  if (itemTarget) {
    void openContentDetail(itemTarget.dataset.contentOpen || "");
    return;
  }

  const linkTarget = event.target.closest("[data-content-open-link]");
  if (linkTarget) {
    const link = String(linkTarget.dataset.contentOpenLink || "").trim();
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  }
}

function handleWidgetClick(event) {
  const weatherRefreshButton = event.target.closest("[data-weather-refresh]");
  if (weatherRefreshButton) {
    void refreshWeather().finally(() => {
      renderWidgets();
    });
    return;
  }
  const button = event.target.closest("[data-widget-toggle]");
  if (!button) {
    return;
  }
  openWidgetSettings(button.dataset.widgetToggle);
}

function handleAccountChipClick() {
  if (!state.auth.user) {
    return;
  }
  toggleAccountMenu();
}

function handleAccountMenuClick(event) {
  const action = event.target.closest("[data-account-action]")?.dataset.accountAction;
  if (!action) {
    return;
  }
  if (action === "profile") {
    openAccountProfileModal();
    return;
  }
  if (action === "password") {
    openChangePasswordModal();
    return;
  }
  if (action === "clear-data") {
    openClearAccountDataModal();
    return;
  }
  if (action === "delete-account") {
    openDeleteAccountModal();
  }
}

function handleModalClick(event) {
  if (event.target.closest("[data-modal-close]")) {
    closeModal();
  }
  if (event.target.closest("[data-delete-modal-close]")) {
    closeDeleteTaskModal();
  }
  if (event.target.closest("[data-archive-modal-close]")) {
    closeArchiveTaskModal();
  }
  if (event.target.closest("[data-rename-modal-close]")) {
    closeRenameTaskModal();
  }
  if (event.target.closest("[data-weekly-summary-save-modal-close]")) {
    closeWeeklySummarySaveModal();
  }
  if (event.target.closest("[data-task-timeline-modal-close]")) {
    closeTaskTimelineModal();
  }
  if (event.target.closest("[data-account-profile-modal-close]")) {
    closeAccountProfileModal();
  }
  if (event.target.closest("[data-change-password-modal-close]")) {
    closeChangePasswordModal();
  }
  if (event.target.closest("[data-clear-account-data-modal-close]")) {
    closeClearAccountDataModal();
  }
  if (event.target.closest("[data-delete-account-modal-close]")) {
    closeDeleteAccountModal();
  }
}

function handleModalSubmit(event) {
  if (event.target !== elements.settingsForm) {
    return;
  }
  event.preventDefault();
  saveSettings(new FormData(elements.settingsForm));
}

function handleDeleteTaskConfirmClick(event) {
  const button = event.target.closest("#delete-task-confirm");
  if (!button || !button.dataset.taskId) {
    return;
  }
  void deleteTask(button.dataset.taskId);
}

function handleArchiveTaskConfirmClick(event) {
  const button = event.target.closest("#archive-task-confirm");
  if (!button || !button.dataset.taskId) {
    return;
  }
  void archiveTask(button.dataset.taskId);
}

function handleRenameTaskConfirmClick(event) {
  const button = event.target.closest("#rename-task-confirm");
  if (!button || !button.dataset.taskId) {
    return;
  }
  void renameTask(button.dataset.taskId);
}

function handleWeeklySummarySaveConfirmClick(event) {
  const button = event.target.closest("#weekly-summary-save-confirm");
  if (!button || button.disabled) {
    return;
  }
  void saveWeeklySummary();
}

function handleSaveStatusUndo() {
  if (!state.undoAction?.undo) {
    return;
  }
  const undo = state.undoAction.undo;
  clearUndoAction();
  void undo();
}

function handleSaveStatusRetry() {
  if (isRemoteReady() && state.auth.user) {
    void flushPendingSync()
      .then(() => {
        state.remote.status = "ready";
        setSaveStatus("待同步内容已重新提交", "success");
        render();
      })
      .catch((error) => {
        console.warn("Retry sync failed.", error);
        state.remote.status = "sync-error";
        setSaveStatus("重新同步失败，请稍后再试");
        renderControls();
      });
    return;
  }

  if (state.auth.user) {
    void bootstrapRemoteData();
    return;
  }
  setSaveStatus("请先登录云端账号后再尝试同步");
}

function handleTaskListKeydown(event) {
  const input = event.target.closest('[data-action="draft-note"]');
  if (!input) {
    return;
  }
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void submitTaskNote(input.dataset.taskId);
  }
}

function handleRenameTaskInput(event) {
  if (event.target !== elements.renameTaskInput) {
    return;
  }
  const taskId = state.renameDialogTaskId;
  if (!taskId) {
    return;
  }
  updateTaskNameDraft(taskId, elements.renameTaskInput.value);
}

function handleAuthAction() {
  closeAccountMenu();
  if (state.auth.user) {
    void signOutAuth();
    return;
  }
  redirectToLoginPage();
}

function handleGlobalClick(event) {
  if (
    state.accountMenuOpen &&
    !event.target.closest(".account-menu-wrap")
  ) {
    closeAccountMenu();
  }
}

function hasUnsavedWeeklySummaryChanges() {
  return Object.keys(state.weeklySummaryDrafts).some((week) => {
    return getWeeklySummaryDraft(week) !== (state.data.weeklySummaries[week]?.content || "");
  });
}

function handleBeforeUnload(event) {
  if (!hasUnsavedWeeklySummaryChanges()) {
    return;
  }
  event.preventDefault();
  event.returnValue = "你有未保存的周总结修改。";
}

function bindEvents() {
  document
    .querySelector(".top-tabs")
    .addEventListener("click", handleTopTabClick);
  document
    .querySelector(".center-tabs")
    .addEventListener("click", handleCenterTabClick);
  elements.themeOptions.forEach((button) => {
    button.addEventListener("click", handleThemeClick);
  });
  elements.authStatusChip.addEventListener("click", handleAccountChipClick);
  elements.accountMenu?.addEventListener("click", handleAccountMenuClick);
  elements.authAction.addEventListener("click", handleAuthAction);
  elements.exportDataButton.addEventListener("click", handleExportData);
  elements.calendarGrid.addEventListener("click", handleCalendarClick);
  elements.weeklyModeWeek.addEventListener("click", handleReviewModeClick);
  elements.weeklyModeMonth.addEventListener("click", handleReviewModeClick);
  elements.weeklyRangePicker.addEventListener("change", handleWeeklyRangeChange);
  elements.monthlyRangePicker.addEventListener("change", handleMonthlyRangeChange);
  elements.weeklySummaryInput.addEventListener("input", handleWeeklySummaryInput);
  elements.weeklySummaryEdit.addEventListener("click", handleWeeklySummaryEdit);
  elements.weeklySummarySave.addEventListener("click", handleWeeklySummarySave);
  if (elements.weeklySummarySaveModal) {
    elements.weeklySummarySaveModal.addEventListener("click", handleModalClick);
    elements.weeklySummarySaveModal.addEventListener(
      "click",
      handleWeeklySummarySaveConfirmClick,
    );
  }
  elements.weeklyTaskFilter.addEventListener("change", handleWeeklyFilterChange);
  elements.weeklyCompletionFilter.addEventListener("change", handleWeeklyFilterChange);
  elements.weeklyNotesFilter.addEventListener("change", handleWeeklyFilterChange);
  elements.weeklyArchiveFilter.addEventListener("change", handleWeeklyFilterChange);
  elements.saveStatusUndo.addEventListener("click", handleSaveStatusUndo);
  elements.saveStatusRetry.addEventListener("click", handleSaveStatusRetry);
  elements.taskList.addEventListener("click", handleTaskListClick);
  elements.taskList.addEventListener("input", handleTaskListInput);
  elements.taskList.addEventListener("keydown", handleTaskListKeydown);
  elements.taskList.addEventListener("submit", handleTaskListSubmit);
  elements.weeklyReviewList.addEventListener("click", handleWeeklyReviewClick);
  document.querySelectorAll("[data-app-tab-target]").forEach((button) => {
    button.addEventListener("click", handleShowMoreClick);
  });
  document
    .querySelector(".left-rail")
    ?.addEventListener("submit", (event) => {
      void handleGitHubProfileSubmit(event);
    });
  elements.financeView?.addEventListener("click", handleContentClick);
  elements.scienceView?.addEventListener("click", handleContentClick);
  elements.financeView?.addEventListener("input", handleContentToolbarInput);
  elements.scienceView?.addEventListener("input", handleContentToolbarInput);
  elements.financeView?.addEventListener("change", handleContentToolbarChange);
  elements.scienceView?.addEventListener("change", handleContentToolbarChange);
  elements.contentDetailModal?.addEventListener("click", handleContentClick);
  elements.contentSourceModal?.addEventListener("click", handleContentClick);
  elements.contentSourceForm?.addEventListener("submit", handleContentSourceSubmit);
  document
    .querySelector(".right-rail")
    .addEventListener("click", handleWidgetClick);
  elements.settingsModal.addEventListener("click", handleModalClick);
  elements.settingsForm.addEventListener("submit", handleModalSubmit);
  elements.deleteTaskModal.addEventListener("click", handleModalClick);
  elements.deleteTaskConfirm.addEventListener("click", handleDeleteTaskConfirmClick);
  elements.archiveTaskModal.addEventListener("click", handleModalClick);
  elements.archiveTaskConfirm.addEventListener("click", handleArchiveTaskConfirmClick);
  elements.renameTaskModal.addEventListener("click", handleModalClick);
  elements.renameTaskConfirm.addEventListener("click", handleRenameTaskConfirmClick);
  elements.renameTaskInput.addEventListener("input", handleRenameTaskInput);
  if (elements.taskTimelineModal) {
    elements.taskTimelineModal.addEventListener("click", handleModalClick);
  }
  elements.accountProfileModal?.addEventListener("click", handleModalClick);
  elements.accountProfileModal?.addEventListener("submit", (event) => {
    void handleAccountProfilePreferencesSubmit(event);
  });
  elements.changePasswordModal?.addEventListener("click", handleModalClick);
  elements.changePasswordForm?.addEventListener("submit", handleChangePasswordSubmit);
  elements.clearAccountDataModal?.addEventListener("click", handleModalClick);
  elements.clearAccountDataConfirm?.addEventListener("click", () => {
    void clearAccountData();
  });
  elements.deleteAccountModal?.addEventListener("click", handleModalClick);
  elements.deleteAccountForm?.addEventListener("submit", handleDeleteAccountSubmit);
  document.addEventListener("click", handleGlobalClick);
  window.addEventListener("beforeunload", handleBeforeUnload);
}

function getTodayDateString() {
  return formatDateKey(new Date());
}

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function parseIsoDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getStartOfWeek(date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + diff);
  return next;
}

function formatWeekInputValue(date) {
  const weekDate = new Date(date);
  weekDate.setHours(0, 0, 0, 0);
  weekDate.setDate(weekDate.getDate() + 4 - (weekDate.getDay() || 7));
  const yearStart = new Date(weekDate.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((weekDate - yearStart) / 86400000 + 1) / 7);
  return `${weekDate.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function formatMonthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthRange(monthValue) {
  const [year, month] = String(monthValue).split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return { start, end };
}

function getDaySpan(start, end) {
  return Math.floor((end - start) / 86400000) + 1;
}

function getWeeklyRangeOptions() {
  const now = new Date();
  const currentWeek = formatWeekInputValue(now);
  const firstSelectableDate = new Date(now.getFullYear(), 1, 1);
  let cursor = getStartOfWeek(firstSelectableDate);
  const currentRange = getWeekRangeFromWeekValue(currentWeek);
  const options = [];

  while (cursor <= currentRange.start) {
    const value = formatWeekInputValue(cursor);
    options.push({
      value,
      label: formatWeekRangeText(value),
    });
    cursor = addDays(cursor, 7);
  }

  return options;
}

function getMonthlyRangeOptions() {
  const now = new Date();
  const firstSelectableDate = new Date(now.getFullYear(), 1, 1);
  const options = [];
  const cursor = new Date(firstSelectableDate.getFullYear(), firstSelectableDate.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  while (cursor <= end) {
    const value = formatMonthValue(cursor);
    options.push({
      value,
      label: formatMonthRangeText(value),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return options;
}

function getWeekRangeFromWeekValue(weekValue) {
  const [yearPart, weekPart] = weekValue.split("-W");
  const year = Number(yearPart);
  const week = Number(weekPart);
  const januaryFourth = new Date(year, 0, 4);
  const firstWeekStart = getStartOfWeek(januaryFourth);
  const start = addDays(firstWeekStart, (week - 1) * 7);
  const end = addDays(start, 6);
  return { start, end };
}

function formatDisplayDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function formatMonthDay(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatWeekRangeText(weekValue) {
  const range = getWeekRangeFromWeekValue(weekValue);
  return `${formatMonthDay(range.start)} - ${formatMonthDay(range.end)}`;
}

function formatMonthRangeText(monthValue) {
  const range = getMonthRange(monthValue);
  return `${formatMonthDay(range.start)} - ${formatMonthDay(range.end)}`;
}

function formatDateTime(value) {
  const date = parseIsoDate(value) || new Date(value);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getFallbackColor(index) {
  return TASK_COLOR_PALETTES[index % TASK_COLOR_PALETTES.length].value;
}

function getRandomPaletteColor() {
  const offset = Math.floor(Math.random() * TASK_COLOR_PALETTES.length);
  return TASK_COLOR_PALETTES[offset].value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}

setAppVisibility(false);
bindEvents();
ensureRecord(state.selectedDate);
persistStateSilently();
void initAuthClient().then((user) => {
  if (user) {
    render();
    refreshExternalData();
    return;
  }
  setAppVisibility(true);
});

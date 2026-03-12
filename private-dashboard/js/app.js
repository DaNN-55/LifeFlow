import {
  API_BASE_STORAGE_KEY,
  API_PROBE_TIMEOUT_MS,
  API_SEED_PREFIX,
  AUTH_CONFIG_STORAGE_KEY,
  CONTENT_PAGE_SIZE,
  DEFAULT_REMOTE_API_BASE,
  LOCAL_SCOPE_KEY,
  PENDING_SYNC_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  STORAGE_KEY,
  STORAGE_VERSION,
  TASK_COLOR_PALETTES,
  WEATHER_CACHE_STORAGE_KEY,
  createInitialContentChannelState,
  defaultTasks,
  defaultWidgets,
} from "./modules/app-config.js";
import { createAccountModule } from "./modules/account-module.js";
import { createAggregationModule } from "./modules/aggregation-module.js";
import { createContentModule } from "./modules/content-module.js";
import {
  addDays,
  formatDateKey,
  formatDateTime,
  formatDisplayDate,
  formatMonthDay,
  formatMonthRangeText,
  formatMonthValue,
  formatTime,
  formatWeekInputValue,
  formatWeekRangeText,
  getDaySpan,
  getMonthRange,
  getMonthlyRangeOptions,
  getStartOfWeek,
  getTodayDateString,
  getWeekRangeFromWeekValue,
  getWeeklyRangeOptions,
  parseIsoDate,
  parseLocalDate,
} from "./modules/date-utils.js";
import {
  escapeAttribute,
  escapeHtml,
  getFallbackColor,
  getRandomPaletteColor,
  normalizeThemePreference,
} from "./modules/dom-utils.js";
import { createHandlersModule } from "./modules/handlers-module.js";
import { createRemoteModule } from "./modules/remote-module.js";
import {
  clearScopedStorage,
  createEmptyDailyRecord,
  createEmptyTaskState,
  createEmptyWeatherState,
  createInitialData,
  createStorageModule,
  isMeaningfulTaskState,
  isTaskArchived,
  loadAuthConfig,
  loadData,
  loadPendingSyncStore,
  loadWeatherCache,
  migrateTaskRecord,
  persistScopedData,
  sanitizeTaskTypes,
  saveWeatherCache,
} from "./modules/storage-module.js";
import { createSummaryModule } from "./modules/summary-module.js";
import { createTasksModule } from "./modules/tasks-module.js";
import { createUiModule } from "./modules/ui-module.js";
import { createWeeklyModule } from "./modules/weekly-module.js";
import { createWidgetsModule } from "./modules/widgets-module.js";

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
  favoritesCard: document.querySelector("#favorites-card"),
  favoritesWidgetDisplay: document.querySelector("#favorites-widget-display"),
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
    sourceModalChannel: "",
    sourceEditingId: "",
  },
  pendingSync: loadPendingSyncStore(),
  widgetData: {
    favorites: {
      status: "idle",
      items: [],
      message: "最近收藏的资讯",
    },
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

let undoActionTimer = null;

const storageModule = createStorageModule({
  state,
  setSaveStatus,
  applyTheme,
});

const {
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
} = storageModule;

const aggregationModule = createAggregationModule({
  state,
  addDays,
  formatDateKey,
  formatMonthDay,
  getDaySpan,
  getMonthRange,
  getWeekRangeFromWeekValue,
  getActiveTaskTypes,
  migrateTaskRecord,
  parseIsoDate,
});

const {
  aggregateWeek,
  aggregateMonth,
  getCompletedCount,
} = aggregationModule;

const widgetsModule = createWidgetsModule({
  state,
  elements,
  defaultWidgets,
  escapeHtml,
  escapeAttribute,
  formatDateTime,
  parseIsoDate,
  fetchApiJson: (...args) => fetchApiJson(...args),
  fetchJson,
  saveData,
  saveAccountPreferencesRemote: (...args) => saveAccountPreferencesRemote(...args),
  setSaveStatus,
  createEmptyWeatherState,
  loadWeatherCache,
  saveWeatherCache,
  getSidebarPreferences: (...args) => getSidebarPreferences(...args),
});

const {
  renderWidgets,
  openWidgetSettings,
  closeModal,
  renderModal,
  saveWidgetSettings,
  handleGitHubProfileSubmit,
  refreshExternalData,
  refreshGitHubRepo,
  refreshWeather,
  refreshStocks,
} = widgetsModule;

const tasksModule = createTasksModule({
  state,
  elements,
  TASK_COLOR_PALETTES,
  ensureRecord,
  getActiveTaskTypes,
  formatDateTime,
  escapeHtml,
  escapeAttribute,
  persistStateSilently,
  renderControls: (...args) => renderControls(...args),
  renderWeeklyReview: (...args) => renderWeeklyReview(...args),
  render,
  syncCurrentRecord: (...args) => syncCurrentRecord(...args),
  syncTaskCreate: (...args) => syncTaskCreate(...args),
  syncTaskUpdate: (...args) => syncTaskUpdate(...args),
  syncTaskDelete: (...args) => syncTaskDelete(...args),
  syncRecordByDate: (...args) => syncRecordByDate(...args),
  getRandomPaletteColor,
  permanentlyRemoveTaskFromLocalState,
  setUndoAction,
  setSaveStatus,
  isTaskArchived,
  migrateTaskRecord,
  formatDisplayDate,
  parseLocalDate,
});

const {
  renderTaskList,
  renderTaskColorPalette,
  renderNewTaskColorPalette,
  openArchiveTaskModal,
  openRenameTaskModal,
  closeRenameTaskModal,
  closeArchiveTaskModal,
  openDeleteTaskModal,
  closeDeleteTaskModal,
  renderDeleteTaskModal,
  renderArchiveTaskModal,
  renderRenameTaskModal,
  openTaskTimelineModal,
  closeTaskTimelineModal,
  renderTaskTimelineModal,
  getTaskName,
  updateTaskCompletion,
  updateNoteDraft,
  updateTaskNameDraft,
  submitTaskNote,
  deleteTaskNote,
  addTask,
  renameTask,
  cancelTaskRename,
  startTaskRename,
  reorderTasksByDrag,
  reorderTasksToMatchOrder,
  updateTaskColor,
  deleteTask,
  archiveTask,
  restoreTask,
} = tasksModule;

const weeklyModule = createWeeklyModule({
  state,
  elements,
  escapeHtml,
  formatDateTime,
  formatMonthDay,
  formatWeekRangeText,
  parseLocalDate,
  aggregateWeek,
  aggregateMonth,
  getWeeklyVisibleTasks,
  isTaskArchived,
  getWeeklySummaryDraft,
  getWeeklySummaryMode,
});

const {
  renderWeeklyReview,
  getSelectedReviewAggregation,
  normalizeWeeklyAggregation,
  renderWeeklyFilterOptions,
  renderWeeklySummaryContent,
  renderWeeklySummaryMeta,
  openWeeklySummarySaveModal,
  closeWeeklySummarySaveModal,
  renderWeeklySummarySaveModal,
} = weeklyModule;

const remoteModule = createRemoteModule({
  state,
  API_BASE_STORAGE_KEY,
  API_PROBE_TIMEOUT_MS,
  API_SEED_PREFIX,
  DEFAULT_REMOTE_API_BASE,
  LOCAL_SCOPE_KEY,
  PENDING_SYNC_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  fetchJson,
  createInitialData,
  clearScopedStorage,
  persistScopedData,
  persistStateSilently,
  applyAccountPreferences,
  setSaveStatus,
  renderControls: (...args) => renderControls(...args),
  render,
  saveAuthConfig,
  switchDataScope,
  resetScopedUiState,
  getCurrentScopeKey,
  sanitizeTaskTypes,
  getFallbackColor,
  getTaskTypesForDate,
  createEmptyDailyRecord,
  createEmptyTaskState,
  migrateTaskRecord,
  ensureRecord,
  formatDisplayDate,
  formatWeekRangeText,
  parseLocalDate,
  setWeeklySummaryMode,
  refreshFavoriteHighlights: (...args) => refreshFavoriteHighlights(...args),
  prefetchContentFeedsOnSessionStart: (...args) =>
    prefetchContentFeedsOnSessionStart(...args),
});

const {
  loadSessionId,
  saveSessionId,
  saveApiBase,
  saveAccountPreferencesRemote,
  fetchAuthSession,
  signOutAuth,
  bootstrapRemoteData,
  resetCurrentAccountLocalState,
  refreshRemoteForCurrentUser,
  isRemoteReady,
  fetchApiJson,
  syncTasksFromRemote,
  syncSelectedDateRecord,
  syncSelectedWeekReview,
  syncSelectedWeekSummary,
  syncCurrentRecord,
  syncRecordByDate,
  syncTaskCreate,
  syncTaskDelete,
  syncTaskUpdate,
  normalizeRemoteRecord,
  hasPendingSync,
  flushPendingSync,
  markWeeklySummaryPending,
  clearWeeklySummaryPending,
} = remoteModule;

const summaryModule = createSummaryModule({
  state,
  elements,
  fetchApiJson,
  persistStateSilently,
  setSaveStatus,
  formatWeekRangeText,
  renderControls: (...args) => renderControls(...args),
  renderWeeklySummaryMeta: (...args) => renderWeeklySummaryMeta(...args),
  getWeeklySummaryDraft,
  setWeeklySummaryMode,
  closeWeeklySummarySaveModal: (...args) => closeWeeklySummarySaveModal(...args),
  isRemoteReady: (...args) => isRemoteReady(...args),
  markWeeklySummaryPending: (...args) => markWeeklySummaryPending(...args),
  clearWeeklySummaryPending: (...args) => clearWeeklySummaryPending(...args),
});

const {
  updateWeeklySummaryDraft,
  saveWeeklySummary,
  editWeeklySummary,
} = summaryModule;

const accountModule = createAccountModule({
  state,
  elements,
  escapeHtml,
  formatDateTime,
  getSidebarPreferences: (...args) => getSidebarPreferences(...args),
  applyAccountPreferences,
  fetchApiJson,
  fetchAuthSession,
  persistStateSilently,
  saveSessionId,
  loadSessionId,
  saveAccountPreferencesRemote,
  saveAuthConfig,
  switchDataScope,
  bootstrapRemoteData: (...args) => bootstrapRemoteData(...args),
  signOutAuth: (...args) => signOutAuth(...args),
  resetCurrentAccountLocalState: (...args) => resetCurrentAccountLocalState(...args),
  setAppVisibility,
  render,
  renderControls: (...args) => renderControls(...args),
  renderWidgets: (...args) => renderWidgets(...args),
  refreshGitHubRepo: (...args) => refreshGitHubRepo(...args),
  setSaveStatus,
});

const {
  renderAccountMenu,
  renderAccountProfileModal,
  renderChangePasswordModal,
  renderClearAccountDataModal,
  renderDeleteAccountModal,
  openAccountMenu,
  closeAccountMenu,
  toggleAccountMenu,
  openAccountProfileModal,
  closeAccountProfileModal,
  handleAccountProfilePreferencesSubmit,
  openChangePasswordModal,
  closeChangePasswordModal,
  openClearAccountDataModal,
  closeClearAccountDataModal,
  openDeleteAccountModal,
  closeDeleteAccountModal,
  initAuthClient,
  handleChangePasswordSubmit,
  clearAccountData,
  handleDeleteAccountSubmit,
  handleAuthAction,
} = accountModule;

const uiModule = createUiModule({
  state,
  elements,
  createInitialData,
  ensureRecord,
  getCompletedCount,
  getActiveTaskTypes,
  getWeeklySummaryDraft,
  renderWeeklyRangeOptions,
  renderMonthlyRangeOptions,
  renderWeeklyFilterOptions,
  renderWeeklySummaryContent,
  renderWeeklySummaryMeta,
  renderSaveStatusState,
  renderAccountMenu: (...args) => renderAccountMenu(...args),
  escapeHtml,
  parseLocalDate,
  addDays,
  getStartOfWeek,
  formatDateKey,
});

const {
  applyButtonTooltips,
  renderTopTabs,
  renderCenterTabs,
  getSidebarPreferences,
  renderSidebarCards,
  renderCalendar,
  renderControls,
} = uiModule;

const contentModule = createContentModule({
  state,
  elements,
  escapeHtml,
  escapeAttribute,
  formatDateTime,
  fetchApiJson,
  isLocalDevelopment,
  getSidebarPreferences: (...args) => getSidebarPreferences(...args),
  renderTopTabs: (...args) => renderTopTabs(...args),
  renderWidgets,
  setSaveStatus,
});

const {
  getContentElements,
  getContentChannelState,
  scrollContentChannelToTop,
  renderFeeds,
  renderContentStreams,
  renderContentChannel,
  renderContentSourceModal,
  loadFeaturedContent,
  refreshFavoriteHighlights,
  loadChannelContent,
  refreshChannelContentManually,
  prefetchContentFeedsOnSessionStart,
  toggleContentFavorite,
  openContentSourceModal,
  closeContentSourceModal,
  handleContentSourceSubmit,
  ensureContentChannelLoaded,
  queueContentSearch,
  deleteContentSource,
  getContentChannelFromControl,
  handleContentToolbarInput,
  handleContentToolbarChange,
  handleContentClick,
} = contentModule;

const handlersModule = createHandlersModule({
  state,
  elements,
  ensureRecord,
  formatDisplayDate,
  parseLocalDate,
  setSaveStatus,
  render,
  renderTopTabs,
  renderCenterTabs,
  renderControls,
  renderWeeklyReview,
  updateTheme,
  syncSelectedDateRecord,
  syncSelectedWeekReview,
  syncSelectedWeekSummary,
  updateTaskCompletion,
  updateTaskColor,
  startTaskRename,
  openDeleteTaskModal,
  openArchiveTaskModal,
  submitTaskNote,
  deleteTaskNote,
  updateNoteDraft,
  addTask,
  restoreTask,
  openTaskTimelineModal,
  updateWeeklySummaryDraft,
  getWeeklySummaryDraft,
  openWeeklySummarySaveModal,
  editWeeklySummary,
  exportDashboardData,
  ensureContentChannelLoaded,
  scrollContentChannelToTop,
  loadChannelContent,
  handleContentClick,
  handleContentToolbarInput,
  handleContentToolbarChange,
  refreshWeather,
  openWidgetSettings,
  toggleAccountMenu,
  openAccountProfileModal,
  openChangePasswordModal,
  openClearAccountDataModal,
  openDeleteAccountModal,
  closeAccountMenu,
  closeModal,
  closeDeleteTaskModal,
  closeArchiveTaskModal,
  closeRenameTaskModal,
  closeWeeklySummarySaveModal,
  closeTaskTimelineModal,
  closeAccountProfileModal,
  closeChangePasswordModal,
  closeClearAccountDataModal,
  closeDeleteAccountModal,
  saveWidgetSettings,
  deleteTask,
  archiveTask,
  renameTask,
  saveWeeklySummary,
  clearUndoAction,
  isRemoteReady,
  flushPendingSync,
  bootstrapRemoteData,
  updateTaskNameDraft,
  handleAuthAction,
  handleAccountProfilePreferencesSubmit,
  handleChangePasswordSubmit,
  clearAccountData,
  handleDeleteAccountSubmit,
  handleGitHubProfileSubmit,
  handleContentSourceSubmit,
  formatWeekRangeText,
  formatMonthRangeText,
  hasPendingSync,
});

const {
  bindEvents,
} = handlersModule;

function setAppVisibility(isVisible) {
  elements.body.style.visibility = isVisible ? "" : "hidden";
}

function isLocalDevelopment() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname || "");
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
  renderContentSourceModal();
  applyButtonTooltips();
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
}

function themeLabel(theme) {
  return theme === "light" ? "Light 模式" : "Dark 模式";
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

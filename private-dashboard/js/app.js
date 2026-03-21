import {
  API_BASE_STORAGE_KEY,
  API_PROBE_TIMEOUT_MS,
  API_SEED_PREFIX,
  AUTH_CONFIG_STORAGE_KEY,
  CONTENT_PAGE_SIZE,
  DEFAULT_REMOTE_API_BASE,
  LOCAL_SCOPE_KEY,
  PENDING_SYNC_STORAGE_KEY,
  SAFETY_BACKUP_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  STORAGE_KEY,
  STORAGE_VERSION,
  TASK_COLOR_PALETTES,
  WEATHER_CACHE_STORAGE_KEY,
  contentChannelIds,
  contentTabs,
  createInitialContentStateMap,
  createInitialContentChannelState,
  defaultTasks,
  defaultWidgets,
  getContentTabConfig,
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
  mergeDashboardData,
  migrateTaskRecord,
  normalizeDataPayload,
  persistScopedData,
  sanitizeTaskTypes,
  saveWeatherCache,
} from "./modules/storage-module.js";
import { createSummaryModule } from "./modules/summary-module.js";
import { createTasksModule } from "./modules/tasks-module.js";
import { createUiModule } from "./modules/ui-module.js";
import { createWeeklyModule } from "./modules/weekly-module.js";
import { createWidgetsModule } from "./modules/widgets-module.js";

function buildDynamicContentViewMarkup(tab) {
  const channel = tab.id;
  return `
    <section id="${channel}-view" class="stage-view content-stream-view" data-content-view="${channel}" hidden>
      <div class="content-stream-shell">
        <div class="panel-header">
          <div>
            <p class="panel-kicker">${escapeHtml(tab.panelKicker)}</p>
            <h1>${escapeHtml(tab.heading)}</h1>
          </div>
          <div class="content-stream-actions">
            <button type="button" class="task-cancel-action" data-content-open-sources="${escapeAttribute(channel)}">
              管理信源
            </button>
            <button type="button" class="settings-save" data-content-refresh="${escapeAttribute(channel)}">
              刷新资讯
            </button>
          </div>
        </div>
        <div id="${channel}-content-meta" class="content-stream-meta" hidden></div>
        <div class="content-toolbar">
          <label class="content-toolbar-field content-toolbar-search">
            <span class="weekly-filter-label">搜索</span>
            <input id="${channel}-search" type="search" placeholder="${escapeAttribute(tab.searchPlaceholder)}" />
          </label>
          <label class="content-toolbar-field">
            <span class="weekly-filter-label">标签</span>
            <select id="${channel}-tag-filter"></select>
          </label>
          <label class="content-toolbar-field">
            <span class="weekly-filter-label">来源</span>
            <select id="${channel}-source-filter"></select>
          </label>
          <label class="content-toolbar-field">
            <span class="weekly-filter-label">范围</span>
            <select id="${channel}-favorite-filter">
              <option value="all">全部资讯</option>
              <option value="favorites">仅看收藏</option>
              <option value="unread">未读</option>
              <option value="read">已读</option>
            </select>
          </label>
          <label class="content-toolbar-field">
            <span class="weekly-filter-label">排序</span>
            <select id="${channel}-sort-filter">
              <option value="latest">最新优先</option>
              <option value="oldest">最早优先</option>
            </select>
          </label>
        </div>
        <div id="${channel}-content-grid" class="content-masonry" aria-live="polite"></div>
        <div id="${channel}-content-pagination" class="content-pagination"></div>
      </div>
    </section>
  `;
}

function bootstrapExtraContentTabs() {
  const tabsMount = document.querySelector("#dynamic-content-tabs");
  const viewsMount = document.querySelector("#dynamic-content-views");
  if (!tabsMount || !viewsMount) {
    return;
  }
  contentTabs
    .filter((tab) => !["finance", "science"].includes(tab.id))
    .forEach((tab) => {
      if (!document.querySelector(`[data-app-tab="${tab.id}"]`)) {
        tabsMount.insertAdjacentHTML(
          "beforeend",
          `<button type="button" class="top-tab" data-app-tab="${escapeAttribute(tab.id)}">${escapeHtml(tab.label)}</button>`,
        );
      }
      if (!document.querySelector(`#${tab.id}-view`)) {
        viewsMount.insertAdjacentHTML("beforeend", buildDynamicContentViewMarkup(tab));
      }
    });
}

function buildContentChannelElements() {
  return Object.fromEntries(
    contentTabs.map((tab) => [
      tab.id,
      {
        view: document.querySelector(`#${tab.id}-view`),
        search: document.querySelector(`#${tab.id}-search`),
        tagFilter: document.querySelector(`#${tab.id}-tag-filter`),
        sourceFilter: document.querySelector(`#${tab.id}-source-filter`),
        favoriteFilter: document.querySelector(`#${tab.id}-favorite-filter`),
        sortFilter: document.querySelector(`#${tab.id}-sort-filter`),
        meta: document.querySelector(`#${tab.id}-content-meta`),
        grid: document.querySelector(`#${tab.id}-content-grid`),
        pagination: document.querySelector(`#${tab.id}-content-pagination`),
      },
    ]),
  );
}

bootstrapExtraContentTabs();

const elements = {
  body: document.body,
  appFrame: document.querySelector(".app-frame"),
  topTabs: document.querySelectorAll(".top-tab"),
  centerTabs: document.querySelectorAll(".center-tab"),
  themeOptions: document.querySelectorAll(".theme-option"),
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
  importDataButton: document.querySelector("#import-data-button"),
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
  contentByChannel: buildContentChannelElements(),
  contentViews: document.querySelectorAll("[data-content-view]"),
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
  dataTransferModal: document.querySelector("#data-transfer-modal"),
  dataTransferTitle: document.querySelector("#data-transfer-title"),
  dataTransferBody: document.querySelector("#data-transfer-body"),
  syncCenterModal: document.querySelector("#sync-center-modal"),
  syncCenterBody: document.querySelector("#sync-center-body"),
  appBootOverlay: document.querySelector("#app-boot-overlay"),
  appBootTitle: document.querySelector("#app-boot-title"),
  appBootDetail: document.querySelector("#app-boot-detail"),
  appBootActions: document.querySelector("#app-boot-actions"),
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
  accountRecoveryCode: "",
  accountRecoveryCodeBusy: false,
  accountRecoveryFeedback: "",
  accountProfileModalOpen: false,
  dataTransferModalOpen: false,
  dataTransferMode: "import",
  dataTransferBusy: false,
  syncCenterModalOpen: false,
  changePasswordModalOpen: false,
  clearAccountDataModalOpen: false,
  deleteAccountModalOpen: false,
  changePasswordSubmitting: false,
  clearAccountDataSubmitting: false,
  deleteAccountSubmitting: false,
  saveStatusTone: "default",
  appBoot: {
    visible: true,
    title: "正在进入 Dashboard",
    detail: "正在验证登录状态并连接云端数据...",
    actionsVisible: false,
  },
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
    ...createInitialContentStateMap(),
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
let externalRefreshTimer = null;

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
  contentTabs,
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
  contentChannelIds,
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
  recordSyncAttempt,
  recordSyncSuccess,
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
  queueAllCurrentDataForSync,
  syncAllDataToRemote,
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
  showAppBootOverlay,
  hideAppBootOverlay,
  render,
  renderControls: (...args) => renderControls(...args),
  renderWidgets: (...args) => renderWidgets(...args),
  refreshGitHubRepo: (...args) => refreshGitHubRepo(...args),
  setSaveStatus,
  exportDashboardData,
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
  handleAccountRecoveryCodeSubmit,
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
  contentChannelIds,
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
  contentChannelIds,
  contentTabs,
  getContentTabConfig,
  escapeHtml,
  escapeAttribute,
  formatDateTime,
  fetchApiJson,
  isLocalDevelopment,
  getSidebarPreferences: (...args) => getSidebarPreferences(...args),
  persistStateSilently,
  saveAccountPreferencesRemote: (...args) => saveAccountPreferencesRemote(...args),
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
  contentChannelIds,
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
  openDataTransferModal,
  closeDataTransferModal,
  handleDataTransferSubmit,
  openSyncCenterModal: openSyncCenterPanel,
  closeSyncCenterModal: closeSyncCenterPanel,
  handleSyncCenterClick,
  ensureContentChannelLoaded,
  scrollContentChannelToTop,
  loadChannelContent,
  handleContentClick,
  handleContentToolbarInput,
  handleContentToolbarChange,
  refreshWeather,
  refreshGitHubRepo,
  refreshStocks,
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
    handleAccountRecoveryCodeSubmit,
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
  if (!elements.appFrame) {
    return;
  }
  elements.appFrame.style.visibility = isVisible ? "" : "hidden";
}

function renderAppBootOverlay() {
  if (!elements.appBootOverlay || !elements.appBootTitle || !elements.appBootDetail || !elements.appBootActions) {
    return;
  }
  elements.appBootOverlay.hidden = !state.appBoot.visible;
  elements.appBootTitle.textContent = state.appBoot.title || "正在进入 Dashboard";
  elements.appBootDetail.textContent = state.appBoot.detail || "";
  elements.appBootActions.hidden = !state.appBoot.actionsVisible;
}

function showAppBootOverlay(options = {}) {
  state.appBoot = {
    ...state.appBoot,
    visible: true,
    title: options.title || state.appBoot.title || "正在进入 Dashboard",
    detail: options.detail || state.appBoot.detail || "",
    actionsVisible: Boolean(options.actionsVisible),
  };
  setAppVisibility(false);
  renderAppBootOverlay();
}

function hideAppBootOverlay() {
  state.appBoot.visible = false;
  state.appBoot.actionsVisible = false;
  renderAppBootOverlay();
  setAppVisibility(true);
}

function redirectToLoginPage() {
  window.location.replace("./login.html");
}

function retryAppBootstrap() {
  showAppBootOverlay({
    title: "正在重试连接",
    detail: "正在重新验证登录状态并恢复云端数据...",
    actionsVisible: false,
  });
  void initAuthClient().then((user) => {
    if (!user) {
      renderAppBootOverlay();
      return;
    }
    render();
    hideAppBootOverlay();
    scheduleExternalRefresh();
  });
}

function continueInLocalMode() {
  state.appBoot.visible = false;
  state.appBoot.actionsVisible = false;
  state.auth.user = null;
  state.auth.status = "idle";
  state.remote.status = "offline";
  render();
  hideAppBootOverlay();
}

function scheduleExternalRefresh(delayMs = 480) {
  if (externalRefreshTimer) {
    window.clearTimeout(externalRefreshTimer);
  }
  externalRefreshTimer = window.setTimeout(() => {
    externalRefreshTimer = null;
    void refreshExternalData();
  }, delayMs);
}

function isLocalDevelopment() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname || "");
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
  renderDataTransferModal();
  renderSyncCenterModal();
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

function trimSyncNotices(notices = []) {
  return notices
    .filter((item) => item && typeof item.message === "string" && item.message.trim())
    .slice(0, 12);
}

function addSyncNotice(message, tone) {
  if (!message || /^已自动保存 /.test(message)) {
    return;
  }
  const nextMessage = String(message).trim().slice(0, 200);
  if (!nextMessage) {
    return;
  }
  const current = Array.isArray(state.data.preferences?.sync?.notices)
    ? state.data.preferences.sync.notices
    : [];
  state.data.preferences.sync.notices = trimSyncNotices([
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message: nextMessage,
      tone: resolveSaveStatusTone(message, tone),
      createdAt: new Date().toISOString(),
    },
    ...current,
  ]);
  persistStateSilently();
}

function setSaveStatus(message, tone, options = {}) {
  state.saveStatusTone = resolveSaveStatusTone(message, tone);
  elements.saveStatus.textContent = message;
  if (!options.skipNotice) {
    addSyncNotice(message, tone);
  }
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

function buildExportPayload(data = state.data) {
  return {
    exportedAt: new Date().toISOString(),
    data,
  };
}

function downloadJsonPayload(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getSafetyBackupSnapshot() {
  try {
    const raw = localStorage.getItem(SAFETY_BACKUP_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.data) {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function saveSafetyBackup(reason = "manual") {
  const payload = {
    id: `backup-${Date.now()}`,
    reason,
    createdAt: new Date().toISOString(),
    scopeKey: getCurrentScopeKey(),
    username: state.auth.user?.username || "",
    data: structuredClone(state.data),
  };
  localStorage.setItem(SAFETY_BACKUP_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

function restoreSafetyBackupLocally(snapshot) {
  if (!snapshot?.data) {
    throw new Error("当前没有可恢复的安全备份");
  }
  state.data = normalizeDataPayload(snapshot.data, state.data.preferences);
  persistStateSilently();
  render();
}

function exportDashboardData(options = {}) {
  const {
    data = state.data,
    filename = `lifeflow-dashboard-${formatDateKey(new Date())}.json`,
    statusMessage = "已导出当前 Dashboard 数据",
    skipStatus = false,
  } = options;
  const payload = buildExportPayload(data);
  downloadJsonPayload(filename, payload);
  if (!skipStatus) {
    setSaveStatus(statusMessage, "success");
  }
  return payload;
}

function getPendingSyncCounts() {
  const bucket = state.pendingSync[state.auth.user?.id || ""] || {};
  return {
    tasks: Object.keys(bucket.taskUpserts || {}).length + Object.keys(bucket.taskDeletes || {}).length,
    records: Object.keys(bucket.dirtyRecords || {}).length,
    summaries: Object.keys(bucket.weeklySummaryUpserts || {}).length,
  };
}

function recordSyncAttempt() {
  state.data.preferences.sync.lastSyncAttemptAt = new Date().toISOString();
  persistStateSilently();
}

function recordSyncSuccess() {
  const now = new Date().toISOString();
  state.data.preferences.sync.lastSyncAttemptAt = now;
  state.data.preferences.sync.lastSuccessfulSyncAt = now;
  persistStateSilently();
}

function renderSyncCenterModal() {
  const modal = elements.syncCenterModal;
  if (!modal || !elements.syncCenterBody) {
    return;
  }
  modal.hidden = !state.syncCenterModalOpen;
  if (!state.syncCenterModalOpen) {
    elements.syncCenterBody.innerHTML = "";
    return;
  }
  const backup = getSafetyBackupSnapshot();
  const counts = getPendingSyncCounts();
  const totalPending = counts.tasks + counts.records + counts.summaries;
  const syncPreferences = state.data.preferences?.sync || {};
  const notices = Array.isArray(syncPreferences.notices) ? syncPreferences.notices : [];
  elements.syncCenterBody.innerHTML = `
    <div class="account-profile-grid">
      <div class="account-profile-item">
        <span class="account-profile-label">当前模式</span>
        <strong>${escapeHtml(state.remote.status === "ready" ? "云端已连接" : state.auth.user ? "待连接 / 待同步" : "本地模式")}</strong>
      </div>
      <div class="account-profile-item">
        <span class="account-profile-label">待同步内容</span>
        <strong>${totalPending} 项</strong>
      </div>
      <div class="account-profile-item">
        <span class="account-profile-label">最近同步尝试</span>
        <strong>${escapeHtml(syncPreferences.lastSyncAttemptAt ? formatDateTime(syncPreferences.lastSyncAttemptAt) : "--")}</strong>
      </div>
      <div class="account-profile-item">
        <span class="account-profile-label">最近同步成功</span>
        <strong>${escapeHtml(syncPreferences.lastSuccessfulSyncAt ? formatDateTime(syncPreferences.lastSuccessfulSyncAt) : "--")}</strong>
      </div>
    </div>
    <div class="account-profile-item">
      <span class="account-profile-label">同步操作</span>
      <div class="data-transfer-actions">
        <button type="button" class="settings-save" data-sync-action="retry" ${!state.auth.user ? "disabled" : ""}>重试待同步</button>
        <button type="button" class="task-cancel-action" data-sync-action="full-sync" ${!state.auth.user ? "disabled" : ""}>全量同步当前数据</button>
      </div>
      <p class="settings-copy">任务 ${counts.tasks} 项 · 每日记录 ${counts.records} 项 · 周总结 ${counts.summaries} 项</p>
    </div>
    <div class="account-profile-item">
      <span class="account-profile-label">最近安全备份</span>
      <p class="settings-copy">${
        backup
          ? `${escapeHtml(formatDateTime(backup.createdAt))} · ${escapeHtml(backup.reason || "manual")}`
          : "当前还没有安全备份。"
      }</p>
      <div class="data-transfer-actions">
        <button type="button" class="settings-save" data-sync-action="download-backup" ${backup ? "" : "disabled"}>导出最近安全备份</button>
        <button type="button" class="task-cancel-action" data-sync-action="restore-backup" ${backup ? "" : "disabled"}>恢复最近安全备份</button>
      </div>
    </div>
    <div class="account-profile-item">
      <span class="account-profile-label">最近状态</span>
      ${
        notices.length
          ? `<div class="sync-notice-list">${notices
              .map(
                (item) => `
                  <article class="sync-notice" data-tone="${escapeAttribute(item.tone || "default")}">
                    <strong>${escapeHtml(item.message)}</strong>
                    <span>${escapeHtml(item.createdAt ? formatDateTime(item.createdAt) : "--")}</span>
                  </article>
                `,
              )
              .join("")}</div>`
          : '<div class="content-empty-state">最近还没有同步或恢复记录。</div>'
      }
    </div>
  `;
}

function openSyncCenterPanel() {
  state.syncCenterModalOpen = true;
  renderSyncCenterModal();
}

function closeSyncCenterPanel() {
  state.syncCenterModalOpen = false;
  renderSyncCenterModal();
}

async function handleSyncCenterClick(event) {
  const action = event.target.closest("[data-sync-action]")?.dataset.syncAction;
  if (!action) {
    return;
  }
  if (action === "retry") {
    if (!state.auth.user) {
      setSaveStatus("请先登录账号后再使用同步中心");
      return;
    }
    if (!isRemoteReady()) {
      void bootstrapRemoteData();
      return;
    }
    try {
      await flushPendingSync();
      setSaveStatus("待同步内容已重新提交", "success");
      render();
    } catch (error) {
      console.warn("Retry sync failed from sync center.", error);
      setSaveStatus(error?.message || "重新同步失败，请稍后再试");
    }
    renderSyncCenterModal();
    return;
  }
  if (action === "full-sync") {
    if (!state.auth.user) {
      setSaveStatus("请先登录账号后再使用同步中心");
      return;
    }
    try {
      saveSafetyBackup("full-sync-before-push");
      const result = await syncAllDataToRemote({ replaceRemote: false });
      setSaveStatus(result.synced ? "当前数据已执行全量同步" : "当前数据已排队，等待云端同步", result.synced ? "success" : undefined);
    } catch (error) {
      console.warn("Full sync failed from sync center.", error);
      setSaveStatus(error?.message || "全量同步失败");
    }
    renderSyncCenterModal();
    return;
  }
  const backup = getSafetyBackupSnapshot();
  if (action === "download-backup") {
    if (!backup?.data) {
      setSaveStatus("当前没有可导出的安全备份");
      return;
    }
    exportDashboardData({
      data: backup.data,
      filename: `lifeflow-safety-backup-${formatDateKey(new Date(backup.createdAt || Date.now()))}.json`,
      statusMessage: "已导出最近安全备份",
    });
    return;
  }
  if (action === "restore-backup") {
    if (!backup?.data) {
      setSaveStatus("当前没有可恢复的安全备份");
      return;
    }
    if (!window.confirm("确认用最近的安全备份覆盖当前本地数据吗？")) {
      return;
    }
    try {
      saveSafetyBackup("before-restore-safety-backup");
      restoreSafetyBackupLocally(backup);
      setSaveStatus("最近安全备份已恢复到本地", "success");
    } catch (error) {
      console.warn("Failed to restore safety backup.", error);
      setSaveStatus(error?.message || "恢复安全备份失败");
    }
    renderSyncCenterModal();
  }
}

function renderDataTransferModal() {
  const modal = elements.dataTransferModal;
  if (!modal || !elements.dataTransferBody || !elements.dataTransferTitle) {
    return;
  }

  modal.hidden = !state.dataTransferModalOpen;
  if (!state.dataTransferModalOpen) {
    elements.dataTransferBody.innerHTML = "";
    return;
  }

  if (state.dataTransferMode === "export") {
    elements.dataTransferTitle.textContent = "导出数据";
    elements.dataTransferBody.innerHTML = `
      <form id="data-export-form" class="account-form">
        <div class="account-profile-item">
          <span class="account-profile-label">导出 JSON 备份</span>
          <p class="settings-copy">会导出当前 Dashboard 的任务、每日记录、周总结和偏好设置，文件格式为 JSON。</p>
          <p class="settings-copy">${
            state.auth.user
              ? "建议在执行覆盖恢复前先导出一份最新备份。"
              : "当前处于本地模式，导出内容仅包含本机当前数据。"
          }</p>
        </div>
        <div class="delete-task-dialog-actions">
          <button type="button" class="task-cancel-action" data-data-transfer-modal-close>
            取消
          </button>
          <button type="submit" class="settings-save">
            开始导出
          </button>
        </div>
      </form>
    `;
    return;
  }

  elements.dataTransferTitle.textContent = "数据导入 / 恢复";
  const backup = getSafetyBackupSnapshot();
  elements.dataTransferBody.innerHTML = `
    <form id="data-import-form" class="account-form">
      <div class="account-profile-item">
        <span class="account-profile-label">数据导入 / 恢复</span>
        <p class="settings-copy">支持导入当前 Dashboard 导出的 JSON。合并会保留现有数据；覆盖会用备份完整替换当前数据。</p>
        <label class="settings-field">
          <span class="widget-label">备份文件</span>
          <input name="backupFile" type="file" accept="application/json,.json" required />
        </label>
        <label class="settings-field">
          <span class="widget-label">恢复方式</span>
          <select name="importStrategy">
            <option value="merge">合并到当前数据</option>
            <option value="replace">完整覆盖当前数据</option>
          </select>
        </label>
        <div class="settings-field">
          <span class="widget-label">恢复确认</span>
          <label class="settings-inline-checkbox">
            <input name="replaceConfirmed" type="checkbox" />
            <span>导入前自动保存当前数据，并确认我了解覆盖会替换当前数据</span>
          </label>
        </div>
        <p class="settings-copy">${
          state.auth.user
            ? "登录账号后，导入结果会同步到当前云端账号。覆盖恢复要求云端当前已连接。"
            : "当前处于本地模式，导入只会影响本机数据。"
        }</p>
        <p class="settings-copy">${
          backup
            ? `最近安全备份：${escapeHtml(formatDateTime(backup.createdAt))}。`
            : "导入前会自动生成一份最近安全备份，便于回退。"
        }</p>
      </div>
      <div class="delete-task-dialog-actions">
        <button type="button" class="task-cancel-action" data-data-transfer-modal-close>
          取消
        </button>
        <button type="submit" class="settings-save" ${state.dataTransferBusy ? "disabled" : ""}>
          ${state.dataTransferBusy ? "恢复中..." : "开始恢复"}
        </button>
      </div>
    </form>
  `;
}

function openDataTransferModal(mode) {
  state.dataTransferMode = mode === "export" ? "export" : "import";
  state.dataTransferBusy = false;
  state.dataTransferModalOpen = true;
  renderDataTransferModal();
}

function closeDataTransferModal() {
  state.dataTransferModalOpen = false;
  state.dataTransferBusy = false;
  renderDataTransferModal();
}

async function handleDataTransferSubmit(event) {
  const importForm = event.target.closest("#data-import-form");
  if (importForm) {
    event.preventDefault();

    const formData = new FormData(importForm);
    const backupFile = formData.get("backupFile");
    const importStrategy = String(formData.get("importStrategy") || "merge");
    const replaceConfirmed = formData.has("replaceConfirmed");
    if (!(backupFile instanceof File) || !backupFile.size) {
      setSaveStatus("请选择要恢复的 JSON 备份文件");
      return;
    }
    if (importStrategy === "replace" && !replaceConfirmed) {
      setSaveStatus("请先勾选恢复确认，再执行完整覆盖");
      return;
    }
    if (state.auth.user && importStrategy === "replace" && !isRemoteReady()) {
      setSaveStatus("云端未连接时不能执行覆盖恢复，请先连上云端后再试");
      return;
    }

    state.dataTransferBusy = true;
    renderDataTransferModal();

    try {
      const raw = JSON.parse(await backupFile.text());
      const normalized = normalizeDataPayload(raw?.data || raw, state.data.preferences);
      if (
        normalized.taskTypes.length === 0 &&
        Object.keys(normalized.dailyRecords || {}).length === 0 &&
        Object.keys(normalized.weeklySummaries || {}).length === 0
      ) {
        throw new Error("备份文件中没有可恢复的数据");
      }

      saveSafetyBackup(importStrategy === "replace" ? "before-replace-import" : "before-merge-import");
      state.data =
        importStrategy === "replace"
          ? normalized
          : mergeDashboardData(state.data, normalized);
      persistStateSilently();
      render();

      if (!state.auth.user) {
        closeDataTransferModal();
        setSaveStatus(
          importStrategy === "replace" ? "本地数据已覆盖恢复" : "备份内容已合并到本地数据",
          "success",
        );
        return;
      }

      if (importStrategy === "replace") {
        const result = await syncAllDataToRemote({ replaceRemote: true });
        closeDataTransferModal();
        setSaveStatus(
          result.synced ? "当前账号数据已按备份完整恢复" : "本地已恢复，等待云端同步",
          result.synced ? "success" : undefined,
        );
      } else {
        queueAllCurrentDataForSync();
        const result = await syncAllDataToRemote({ replaceRemote: false });
        closeDataTransferModal();
        setSaveStatus(
          result.synced ? "备份内容已合并并同步到当前账号" : "备份内容已合并，待云端同步",
          result.synced ? "success" : undefined,
        );
      }
      void accountModule.loadAccountProfile();
    } catch (error) {
      console.warn("Failed to import dashboard data.", error);
      state.dataTransferBusy = false;
      renderDataTransferModal();
      setSaveStatus(error?.message || "导入备份失败，请检查 JSON 文件内容");
    }
    return;
  }

  const exportForm = event.target.closest("#data-export-form");
  if (!exportForm) {
    return;
  }

  event.preventDefault();
  exportDashboardData();
  closeDataTransferModal();
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
  let payload = null;
  if (response.status !== 204) {
    const raw = await response.text();
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch (error) {
        const normalizedText = raw
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        payload = normalizedText || raw;
      }
    }
  }
  if (!response.ok) {
    let message =
      typeof payload === "string" && payload.trim()
        ? payload.trim()
        : payload && typeof payload === "object" && payload.error
          ? String(payload.error)
          : `Request failed: ${response.status}`;
    if (/^Cannot (GET|POST|PUT|PATCH|DELETE)\s+\/api\//i.test(message)) {
      message = "当前运行的后端不支持这个接口，请重启本地后端到最新代码。";
    }
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

showAppBootOverlay({
  title: "正在进入 Dashboard",
  detail: "正在验证登录状态并连接云端数据...",
  actionsVisible: false,
});
bindEvents();
ensureRecord(state.selectedDate);
persistStateSilently();
elements.appBootOverlay?.addEventListener("click", (event) => {
  const action = event.target.closest("[data-boot-action]")?.dataset.bootAction;
  if (action === "retry") {
    retryAppBootstrap();
    return;
  }
  if (action === "login") {
    redirectToLoginPage();
    return;
  }
  if (action === "local") {
    continueInLocalMode();
  }
});
void initAuthClient().then((user) => {
  if (user) {
    render();
    hideAppBootOverlay();
    scheduleExternalRefresh();
  }
});

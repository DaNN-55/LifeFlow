const STORAGE_KEY = "lifeflow-private-dashboard-v1";
const STORAGE_VERSION = 4;
const API_BASE_STORAGE_KEY = "lifeflow-private-dashboard-api-base";
const API_SEED_PREFIX = "lifeflow-private-dashboard-seeded:";
const DEFAULT_REMOTE_API_BASE = "https://lifeflow-backend-mrs1.onrender.com";
const AUTH_CONFIG_STORAGE_KEY = "lifeflow-private-dashboard-auth-config";
const ENTRY_MODE_STORAGE_KEY = "lifeflow-private-dashboard-entry-mode";
const PENDING_SYNC_STORAGE_KEY = "lifeflow-private-dashboard-pending-sync";

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

const defaultWidgets = {
  weather: {
    title: "Weather",
  },
  stock: {
    title: "A股概览",
    symbols: "贵州茅台,宁德时代,000001",
  },
};

const elements = {
  body: document.body,
  topTabs: document.querySelectorAll(".top-tab"),
  centerTabs: document.querySelectorAll(".center-tab"),
  themeOptions: document.querySelectorAll(".theme-option"),
  cloudStatusChip: document.querySelector("#cloud-status-chip"),
  authStatusChip: document.querySelector("#auth-status-chip"),
  authAction: document.querySelector("#auth-action"),
  todayCompletedCount: document.querySelector("#today-completed-count"),
  currentWeekRange: document.querySelector("#current-week-range"),
  saveStatus: document.querySelector("#save-status"),
  calendarMonthLabel: document.querySelector("#calendar-month-label"),
  calendarGrid: document.querySelector("#calendar-grid"),
  financeFeed: document.querySelector("#finance-feed"),
  scienceFeed: document.querySelector("#science-feed"),
  taskList: document.querySelector("#task-list"),
  weeklyReviewList: document.querySelector("#weekly-review-list"),
  homeView: document.querySelector("#home-view"),
  financeView: document.querySelector("#finance-view"),
  scienceView: document.querySelector("#science-view"),
  weatherWidgetDisplay: document.querySelector("#weather-widget-display"),
  stockWidgetDisplay: document.querySelector("#stock-widget-display"),
  settingsModal: document.querySelector("#settings-modal"),
  settingsForm: document.querySelector("#settings-form"),
  settingsTitle: document.querySelector("#settings-title"),
  authGate: document.querySelector("#auth-gate"),
  authGateForm: document.querySelector("#auth-gate-form"),
  authGateFeedback: document.querySelector("#auth-gate-feedback"),
  trialAction: document.querySelector("#trial-action"),
};

const state = {
  data: loadData(),
  selectedDate: getTodayDateString(),
  selectedWeek: formatWeekInputValue(new Date()),
  activeAppTab: "home",
  activeCenterTab: "daily",
  noteDrafts: {},
  newTaskColor: "",
  activePaletteTaskId: null,
  modal: { widget: null },
  remote: {
    status: "idle",
    apiBase: "",
    weeklyReview: null,
    connectedThisSession: false,
  },
  auth: {
    status: "idle",
    client: null,
    user: null,
    session: null,
    config: loadAuthConfig(),
    feedback: "",
    entryMode: loadEntryMode(),
  },
  pendingSync: loadPendingSyncStore(),
  widgetData: {
    weather: {
      status: "idle",
      location: "定位中...",
      temperature: "--",
      detail: "",
      message: "",
      forecast: [],
    },
    stock: { status: "idle", symbols: [], message: "" },
  },
};

let remoteBootstrapPromise = null;

function createEmptyTaskState(taskTypes) {
  return taskTypes.reduce((accumulator, task) => {
    accumulator[task.id] = { completed: false, notes: [] };
    return accumulator;
  }, {});
}

function createEmptyDailyRecord(date, taskTypes) {
  return {
    date,
    tasks: createEmptyTaskState(taskTypes),
    mood: "",
    dailySummary: "",
    updatedAt: "",
  };
}

function createInitialData() {
  return {
    version: STORAGE_VERSION,
    taskTypes: defaultTasks,
    dailyRecords: {},
    preferences: {
      theme: "light",
      widgets: structuredClone(defaultWidgets),
    },
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
      preferences: {
        theme: normalizeThemePreference(
          parsed.preferences?.theme || base.preferences.theme,
        ),
        widgets: {
          weather: {
            ...base.preferences.widgets.weather,
            ...(parsed.preferences?.widgets?.weather || {}),
          },
          stock: {
            ...base.preferences.widgets.stock,
            ...(parsed.preferences?.widgets?.stock || {}),
          },
        },
      },
    };
  } catch (error) {
    console.warn("Failed to load dashboard data, resetting state.", error);
    return createInitialData();
  }
}

function loadAuthConfig() {
  try {
    const runtimeConfig =
      typeof window !== "undefined" && window.LIFEFLOW_AUTH_CONFIG
        ? {
            supabaseUrl: String(
              window.LIFEFLOW_AUTH_CONFIG.supabaseUrl || "",
            ).trim(),
            supabaseAnonKey: String(
              window.LIFEFLOW_AUTH_CONFIG.supabaseAnonKey || "",
            ).trim(),
          }
        : { supabaseUrl: "", supabaseAnonKey: "" };
    const raw = localStorage.getItem(AUTH_CONFIG_STORAGE_KEY);
    if (!raw) {
      return { ...runtimeConfig, email: "" };
    }

    const parsed = JSON.parse(raw);
    return {
      supabaseUrl:
        runtimeConfig.supabaseUrl ||
        (typeof parsed.supabaseUrl === "string"
          ? parsed.supabaseUrl.trim()
          : ""),
      supabaseAnonKey:
        runtimeConfig.supabaseAnonKey ||
        (typeof parsed.supabaseAnonKey === "string"
          ? parsed.supabaseAnonKey.trim()
          : ""),
      email: typeof parsed.email === "string" ? parsed.email.trim() : "",
    };
  } catch (error) {
    return {
      supabaseUrl: String(
        window.LIFEFLOW_AUTH_CONFIG?.supabaseUrl || "",
      ).trim(),
      supabaseAnonKey: String(
        window.LIFEFLOW_AUTH_CONFIG?.supabaseAnonKey || "",
      ).trim(),
      email: "",
    };
  }
}

function loadEntryMode() {
  const value = localStorage.getItem(ENTRY_MODE_STORAGE_KEY);
  return value === "trial" ? "trial" : "login";
}

function sanitizeTaskTypes(taskTypes) {
  if (!Array.isArray(taskTypes)) {
    return defaultTasks;
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
      };
    })
    .sort((a, b) => a.order - b.order);
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
      state.data.taskTypes,
    );
  }

  const record = state.data.dailyRecords[date];
  state.data.taskTypes.forEach((task) => {
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

  return record;
}

function saveData(message) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  setSaveStatus(message || `已自动保存 ${formatTime(new Date())}`);
}

function persistStateSilently() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
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
    Object.keys(bucket.dirtyRecords || {}).length > 0
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
}

function saveAuthConfig(config) {
  state.auth.config = {
    supabaseUrl: (config.supabaseUrl || "").trim(),
    supabaseAnonKey: (config.supabaseAnonKey || "").trim(),
    email: (config.email || "").trim(),
  };
  localStorage.setItem(
    AUTH_CONFIG_STORAGE_KEY,
    JSON.stringify(state.auth.config),
  );
}

function getCurrentScopeKey() {
  return state.auth.user?.id || "public";
}

function saveEntryMode(mode) {
  state.auth.entryMode = mode === "trial" ? "trial" : "login";
  localStorage.setItem(ENTRY_MODE_STORAGE_KEY, state.auth.entryMode);
}

function redirectToLoginPage() {
  window.location.href = "./login.html";
}

function parseAuthCallbackParams() {
  const searchParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);

  const errorCode =
    hashParams.get("error_code") || searchParams.get("error_code");
  const errorDescription =
    hashParams.get("error_description") ||
    searchParams.get("error_description");

  if (errorCode || errorDescription) {
    return {
      mode: "error",
      errorCode,
      errorDescription,
    };
  }

  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  if (accessToken && refreshToken) {
    return {
      mode: "hash-session",
      accessToken,
      refreshToken,
    };
  }

  const code = searchParams.get("code");
  if (code) {
    return {
      mode: "auth-code",
      code,
    };
  }

  const tokenHash = searchParams.get("token_hash");
  if (tokenHash) {
    return {
      mode: "token-hash",
      tokenHash,
      verifyType: searchParams.get("type") || "magiclink",
    };
  }

  return null;
}

function clearAuthCallbackParams() {
  if (!window.location.hash && !window.location.search) {
    return;
  }
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

async function consumeAuthHashSession(client) {
  const parsed = parseAuthCallbackParams();
  if (!parsed) {
    return null;
  }

  if (parsed.mode === "error") {
    state.auth.feedback = decodeURIComponent(
      parsed.errorDescription || "云端登录失败，请重试。",
    );
    clearAuthCallbackParams();
    return null;
  }

  try {
    let result;
    if (parsed.mode === "hash-session") {
      result = await client.auth.setSession({
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken,
      });
    } else if (parsed.mode === "auth-code") {
      result = await client.auth.exchangeCodeForSession(parsed.code);
    } else if (parsed.mode === "token-hash") {
      result = await client.auth.verifyOtp({
        token_hash: parsed.tokenHash,
        type: parsed.verifyType,
      });
    } else {
      return null;
    }

    const { data, error } = result;
    if (error) {
      throw error;
    }
    clearAuthCallbackParams();
    return data.session || null;
  } catch (error) {
    console.warn("Failed to consume auth hash session.", error);
    state.auth.feedback = "登录链接已返回，但会话建立失败，请重新发送登录链接。";
    clearAuthCallbackParams();
    return null;
  }
}

function render() {
  applyTheme(state.data.preferences.theme);
  syncWeekToDate();
  renderTopTabs();
  renderCenterTabs();
  renderControls();
  renderCalendar();
  renderFeeds();
  renderTaskList();
  renderWeeklyReview();
  renderWidgets();
  renderModal();
  renderAuthGate();
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

function renderCenterTabs() {
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
  elements.todayCompletedCount.textContent = `${getCompletedCount(record)} / ${state.data.taskTypes.length}`;
  elements.currentWeekRange.textContent = formatWeekRangeText(
    state.selectedWeek,
  );

  elements.themeOptions.forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.theme === state.data.preferences.theme,
    );
  });
  renderCloudStatusChip();
  renderAuthStatusChip();
}

function renderCloudStatusChip() {
  const chip = elements.cloudStatusChip;
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

  if (state.auth.status === "ready" && state.auth.user?.email) {
    chip.classList.add("is-cloud");
    chip.textContent = trimEmail(state.auth.user.email);
    elements.authAction.textContent = "退出登录";
    return;
  }

  if (state.auth.status === "sending-link") {
    chip.classList.add("is-syncing");
    chip.textContent = "发送中";
    elements.authAction.textContent = "云端登录";
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

  if (hasAuthConfig()) {
    chip.textContent = state.auth.entryMode === "trial" ? "试用中" : "未登录";
  } else {
    chip.textContent = "未配置";
  }
  elements.authAction.textContent = "云端登录";
}

function renderAuthGate() {
  if (!elements.authGate || !elements.authGateFeedback) {
    return;
  }
  const shouldShow = !state.auth.user && state.auth.entryMode !== "trial";
  elements.authGate.hidden = !shouldShow;
  if (!shouldShow) {
    return;
  }

  if (elements.authGateForm) {
    elements.authGateForm.elements.email.value = state.auth.config.email || "";
  }

  elements.authGateFeedback.textContent =
    state.auth.feedback || getAuthGateHint();
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
  renderFeedInto(elements.financeFeed, placeholderFeeds.finance);
  renderFeedInto(elements.scienceFeed, placeholderFeeds.science);
}

function renderFeedInto(container, items) {
  container.innerHTML = items
    .map(
      (item) => `
        <article class="feed-item">
          <p class="feed-meta">${item.meta}</p>
          <h3>${item.title}</h3>
        </article>
      `,
    )
    .join("");
}

function renderTaskList() {
  const record = ensureRecord(state.selectedDate);
  const sortedTasks = [...state.data.taskTypes].sort((left, right) => {
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
        : '<div class="task-note-item"><span class="note-time">EMPTY</span><p>暂无备注</p></div>';

      return `
        <article class="task-card ${taskState.completed ? "is-task-completed" : ""}" style="--task-accent: ${task.color};">
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
                class="task-toggle ${taskState.completed ? "is-completed" : ""}"
                data-action="toggle-task"
                data-task-id="${task.id}"
              >
                ${taskState.completed ? "已完成" : "未完成"}
              </button>
              <button
                type="button"
                class="delete-task"
                data-action="delete-task"
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

          <div class="task-note-list">${notesHtml}</div>
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
  const aggregation = getWeeklyAggregation(state.selectedWeek);
  elements.weeklyReviewList.innerHTML = state.data.taskTypes
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
              <span class="review-chip">${aggregation.completionCounts[task.id]} / 7 DAYS</span>
              <span class="review-chip">${notes.length} NOTES</span>
            </div>
          </div>
          <div class="review-notes">${noteHtml}</div>
        </article>
      `;
    })
    .join("");
}

function getWeeklyAggregation(weekValue) {
  if (state.remote.weeklyReview?.week === weekValue) {
    return normalizeWeeklyAggregation(state.remote.weeklyReview);
  }
  return aggregateWeek(weekValue);
}

function normalizeWeeklyAggregation(payload) {
  const completionCounts = {};
  const notesByTask = {};

  state.data.taskTypes.forEach((task) => {
    completionCounts[task.id] = Number(
      payload?.completionCounts?.[task.id] || 0,
    );
    notesByTask[task.id] = Array.isArray(payload?.notesByTask?.[task.id])
      ? payload.notesByTask[task.id].map((item) => ({
          dateLabel: formatMonthDay(parseLocalDate(item.date)),
          note: item.text,
        }))
      : [];
  });

  return { completionCounts, notesByTask };
}

function renderWidgets() {
  elements.weatherWidgetDisplay.innerHTML = renderWeatherWidget();
  elements.stockWidgetDisplay.innerHTML = renderStockWidget();
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
      <span class="material-symbols-outlined">my_location</span>
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

function getAuthGateHint() {
  if (!hasAuthConfig()) {
    return "当前前端还未配置 Supabase 登录参数，请先在代码中补齐 URL 与 Anon Key。";
  }
  return "使用邮箱魔法链接登录。试用模式仅保存在当前浏览器，不会同步到云端。";
}

function renderSettingsForm(widget) {
  if (widget === "weather") {
    return `
      <p class="settings-copy">天气卡片会在每次打开页面时自动请求浏览器定位，并拉取当地 7 日天气预报。</p>
      <div class="settings-actions">
        <button type="submit" class="settings-save" data-save-widget="weather">保存设置</button>
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
      <button type="submit" class="settings-save" data-save-widget="stock">保存设置</button>
    </div>
  `;
}

function aggregateWeek(weekValue) {
  const range = getWeekRangeFromWeekValue(weekValue);
  const completionCounts = {};
  const notesByTask = {};

  state.data.taskTypes.forEach((task) => {
    completionCounts[task.id] = 0;
    notesByTask[task.id] = [];
  });

  for (
    let current = new Date(range.start);
    current <= range.end;
    current = addDays(current, 1)
  ) {
    const dateKey = formatDateKey(current);
    const record = state.data.dailyRecords[dateKey];
    if (!record) {
      continue;
    }

    state.data.taskTypes.forEach((task) => {
      const taskState = migrateTaskRecord(
        record.tasks[task.id],
        record.updatedAt,
        dateKey,
      );
      if (taskState.completed) {
        completionCounts[task.id] += 1;
      }
      taskState.notes.forEach((note) => {
        notesByTask[task.id].push({
          dateLabel: formatMonthDay(parseIsoDate(note.createdAt) || current),
          note: note.text,
        });
      });
    });
  }

  return { completionCounts, notesByTask };
}

function getCompletedCount(record) {
  return state.data.taskTypes.reduce((count, task) => {
    return count + (record.tasks[task.id]?.completed ? 1 : 0);
  }, 0);
}

function setSaveStatus(message) {
  elements.saveStatus.textContent = message;
}

function syncWeekToDate() {
  state.selectedWeek = formatWeekInputValue(parseLocalDate(state.selectedDate));
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
  state.data.taskTypes = state.data.taskTypes.filter(
    (item) => item.id !== taskId,
  );
  Object.values(state.data.dailyRecords).forEach((record) => {
    delete record.tasks[taskId];
  });
  delete state.noteDrafts[taskId];
  persistStateSilently();
  render();
  await syncTaskDelete(taskId, `已删除任务：${task.name}`);
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
    };
    saveData("已保存 Weather 设置");
    closeModal();
    refreshWeather();
    renderWidgets();
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
    refreshStocks();
    renderWidgets();
  }
}

function hasAuthConfig() {
  return Boolean(
    state.auth.config.supabaseUrl && state.auth.config.supabaseAnonKey,
  );
}

function trimEmail(email) {
  const [name, domain] = String(email).split("@");
  if (!domain) {
    return email;
  }
  return `${name.slice(0, 10)}@${domain}`;
}

function getAuthAccessToken() {
  return state.auth.session?.access_token || "";
}

async function initAuthClient() {
  if (!hasAuthConfig()) {
    state.auth.status = "idle";
    state.auth.client = null;
    state.auth.session = null;
    state.auth.user = null;
    state.auth.feedback = "当前站点尚未配置云端登录。";
    renderControls();
    renderAuthGate();
    return null;
  }

  if (state.auth.client) {
    return state.auth.client;
  }

  try {
    const { createClient } =
      await import("https://esm.sh/@supabase/supabase-js@2");
    const client = createClient(
      state.auth.config.supabaseUrl,
      state.auth.config.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );

    const hashSession = await consumeAuthHashSession(client);
    const {
      data: { session },
    } = await client.auth.getSession();
    const activeSession = hashSession || session || null;
    state.auth.client = client;
    state.auth.session = activeSession;
    state.auth.user = activeSession?.user || null;
    state.auth.status = activeSession?.user ? "ready" : "idle";
    state.auth.feedback = activeSession?.user
      ? "已连接到你的 Supabase 账号。"
      : state.auth.feedback;
    if (activeSession?.user) {
      saveEntryMode("login");
    } else if (state.auth.entryMode !== "trial") {
      redirectToLoginPage();
      return client;
    }

    client.auth.onAuthStateChange(async (event, sessionValue) => {
      state.auth.session = sessionValue || null;
      state.auth.user = sessionValue?.user || null;
      state.auth.status = sessionValue?.user ? "ready" : "idle";
      if (sessionValue?.user) {
        saveEntryMode("login");
      }
      state.auth.feedback =
        event === "SIGNED_IN"
          ? `已登录 ${sessionValue?.user?.email || "当前账号"}`
          : event === "SIGNED_OUT"
            ? "已退出云端账号。"
            : event === "TOKEN_REFRESHED"
              ? "云端会话已续期。"
              : state.auth.feedback;

      if (event === "SIGNED_IN" && sessionValue?.user) {
        await bootstrapRemoteData();
        return;
      }

      if (event === "SIGNED_OUT") {
        state.remote.status = "offline";
        state.remote.apiBase = "";
        state.remote.weeklyReview = null;
        state.remote.connectedThisSession = false;
        saveApiBase("");
        setSaveStatus("已退出云端账号，当前使用本地保存");
        render();
        return;
      }

      renderControls();
    });

    renderControls();
    renderAuthGate();
    if (activeSession?.user) {
      await bootstrapRemoteData();
    }
    return client;
  } catch (error) {
    console.warn("Failed to initialize Supabase auth client.", error);
    state.auth.status = "error";
    state.auth.feedback = "Supabase Auth 初始化失败，请检查 URL 与 Anon Key。";
    renderControls();
    renderAuthGate();
    return null;
  }
}

async function requestMagicLink(formData) {
  const config = {
    supabaseUrl: state.auth.config.supabaseUrl,
    supabaseAnonKey: state.auth.config.supabaseAnonKey,
    email: String(formData.get("email") || ""),
  };

  saveAuthConfig(config);
  state.auth.feedback = "";
  state.auth.client = null;
  state.auth.session = null;
  state.auth.user = null;
  state.auth.status = "sending-link";
  renderControls();

  const client = await initAuthClient();
  if (!client) {
    return;
  }

  try {
    const { error } = await client.auth.signInWithOtp({
      email: config.email,
      options: {
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });

    if (error) {
      throw error;
    }

    state.auth.status = "idle";
    state.auth.feedback = `登录链接已发送到 ${config.email}，请在邮箱中完成登录。`;
    renderControls();
    renderAuthGate();
  } catch (error) {
    console.warn("Failed to send auth link.", error);
    state.auth.status = "error";
    state.auth.feedback = "发送登录链接失败，请检查邮箱和 Supabase 配置。";
    renderControls();
    renderAuthGate();
  }
}

async function authenticateWithPassword(formData, mode = "signin") {
  const config = {
    supabaseUrl: state.auth.config.supabaseUrl,
    supabaseAnonKey: state.auth.config.supabaseAnonKey,
    email: String(formData.get("email") || "").trim(),
  };
  const password = String(formData.get("password") || "");

  saveAuthConfig(config);
  state.auth.feedback = "";
  state.auth.client = null;
  state.auth.session = null;
  state.auth.user = null;
  state.auth.status = mode === "signup" ? "creating-account" : "authenticating";
  renderControls();
  renderAuthGate();

  const client = await initAuthClient();
  if (!client) {
    return;
  }

  try {
    let result;
    if (mode === "signup") {
      result = await client.auth.signUp({
        email: config.email,
        password,
      });
    } else {
      result = await client.auth.signInWithPassword({
        email: config.email,
        password,
      });
    }

    if (result.error) {
      throw result.error;
    }

    if (result.data?.session?.user) {
      state.auth.session = result.data.session;
      state.auth.user = result.data.session.user;
      state.auth.status = "ready";
      state.auth.feedback = `已登录 ${result.data.session.user.email || config.email}`;
      saveEntryMode("login");
      await bootstrapRemoteData();
      render();
      return;
    }

    state.auth.status = "idle";
    state.auth.feedback =
      mode === "signup"
        ? "账号已创建，请按 Supabase 的安全设置完成邮箱确认后再登录。"
        : "登录完成，但未返回会话，请检查 Supabase Auth 配置。";
    renderControls();
    renderAuthGate();
  } catch (error) {
    console.warn("Password auth failed.", error);
    state.auth.status = "error";
    state.auth.feedback =
      mode === "signup"
        ? "创建账号失败，请检查邮箱是否已注册或密码是否符合要求。"
        : "登录失败，请检查邮箱和密码。";
    renderControls();
    renderAuthGate();
  }
}

async function signOutAuth() {
  if (!state.auth.client) {
    saveEntryMode("login");
    window.location.href = "./login.html";
    return;
  }
  await state.auth.client.auth.signOut();
  saveEntryMode("login");
  window.location.href = "./login.html";
}

function openAuthGate() {
  window.location.href = "./login.html";
}

function enterTrialMode() {
  saveEntryMode("trial");
  state.auth.feedback = "";
  state.remote.status = "offline";
  state.remote.apiBase = "";
  state.remote.weeklyReview = null;
  saveApiBase("");
  setSaveStatus("试用模式已启用，数据只保存在当前浏览器");
  render();
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

  state.remote.status = "ready";
  state.remote.apiBase = apiBase;
  state.remote.connectedThisSession = true;
  saveApiBase(apiBase);

  try {
    if (hasPendingSync()) {
      await flushPendingSync();
    } else {
      await seedRemoteFromLocal(localSnapshot);
    }
    await syncTasksFromRemote();
    await syncSelectedDateRecord({ silent: true });
    await syncSelectedWeekReview({ silent: true });
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
      ? `正在切换到 ${state.auth.user.email} 的云端数据...`
      : "正在切换到公共数据...",
  );
  renderControls();

  try {
    await syncTasksFromRemote();
    await syncSelectedDateRecord({ silent: true });
    await syncSelectedWeekReview({ silent: true });
    state.remote.status = "ready";
    setSaveStatus(
      state.auth.user
        ? `已连接云端账号：${state.auth.user.email}`
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
  if (!snapshot || !isRemoteReady()) {
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

  for (const task of localTasks) {
    if (remoteTaskIds.has(task.id)) {
      continue;
    }
    await fetchApiJson("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: task.id,
        name: task.name,
        color: task.color,
        displayOrder: task.order,
      }),
    });
  }

  const entries = Object.entries(snapshot.dailyRecords || {}).filter(
    ([, record]) => hasMeaningfulRecord(record),
  );

  for (const [date, record] of entries) {
    await fetchApiJson(`/api/daily-records/${date}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRemoteDailyPayload(record)),
    });
  }

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
  for (const baseUrl of candidates) {
    try {
      const health = await fetchJson(joinApiPath(baseUrl, "/health"));
      if (health?.ok) {
        return baseUrl;
      }
    } catch (error) {
      // Ignore probe failures and continue with the next candidate.
    }
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
  const preferred = isLocalHost
    ? [
        fromStorage,
        runtimeBase,
        localhostBase,
        "http://127.0.0.1:8787",
        DEFAULT_REMOTE_API_BASE,
      ]
    : [
        fromStorage,
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
  if (!isRemoteReady()) {
    throw new Error("Remote API unavailable");
  }
  const headers = new Headers(options.headers || {});
  const accessToken = getAuthAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
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
    })),
  );
  state.data.taskTypes = remoteTasks;
  Object.values(state.data.dailyRecords).forEach((record) => {
    const nextTasks = createEmptyTaskState(remoteTasks);
    remoteTasks.forEach((task) => {
      if (record.tasks[task.id]) {
        nextTasks[task.id] = record.tasks[task.id];
      }
    });
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

function normalizeRemoteRecord(record, fallbackDate) {
  const date = record?.date || fallbackDate;
  const nextRecord = createEmptyDailyRecord(date, state.data.taskTypes);
  const payloadTasks = record?.payload?.tasks || {};

  state.data.taskTypes.forEach((task) => {
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
  state.data.taskTypes.forEach((task) => {
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
  await Promise.allSettled([refreshWeather(), refreshStocks()]);
  renderWidgets();
}

async function refreshWeather() {
  state.widgetData.weather = {
    status: "loading",
    location: "定位中...",
    temperature: "--",
    detail: "正在获取天气信息",
    message: "",
    forecast: [],
  };
  renderWidgets();

  try {
    const target = await getPreferredWeatherLocation();

    const [weatherData, locationData] = await Promise.all([
      fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${target.latitude}&longitude=${target.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=auto`,
      ),
      fetchJson(
        `https://nominatim.openstreetmap.org/reverse?lat=${target.latitude}&lon=${target.longitude}&format=jsonv2&accept-language=zh-CN`,
      ).catch(() => ({})),
    ]);

    const current = weatherData.current;
    const address = locationData.address || {};
    const city =
      address.city ||
      address.town ||
      address.state_district ||
      address.state ||
      "";
    const district =
      address.city_district ||
      address.suburb ||
      address.borough ||
      address.quarter ||
      address.county ||
      "";
    const forecast = (weatherData.daily?.temperature_2m_max || []).map(
      (max, index) => ({
        max,
        min: weatherData.daily.temperature_2m_min[index],
        date: weatherData.daily.time[index],
        dayLabel: formatWeekday(weatherData.daily.time[index]),
        axisLabel: formatWeekdayShortEn(weatherData.daily.time[index]),
        dateLabel: formatMonthDayLabel(weatherData.daily.time[index]),
      }),
    );
    state.widgetData.weather = {
      status: "ready",
      location: formatLocationLabel(city, district),
      temperature: `${Math.round(current.temperature_2m)}°C`,
      detail: weatherCodeToText(current.weather_code),
      message: target.source === "browser" ? "浏览器定位" : "IP 定位",
      forecast,
    };
  } catch (error) {
    state.widgetData.weather = {
      status: "error",
      location: "位置不可用",
      temperature: "--",
      detail: "未能获取天气数据",
      message: "定位与天气接口均失败",
      forecast: [],
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
  const response = await fetch(url, options);
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

async function getPreferredWeatherLocation() {
  try {
    const browserLocation = await getAutoLocation();
    return { ...browserLocation, source: "browser" };
  } catch (error) {
    const ipLocation = await fetchJson("https://ipapi.co/json/");
    if (
      !Number.isFinite(ipLocation.latitude) ||
      !Number.isFinite(ipLocation.longitude)
    ) {
      throw error;
    }
    return {
      latitude: Number(ipLocation.latitude),
      longitude: Number(ipLocation.longitude),
      source: "ip",
    };
  }
}

function weatherCodeToText(code) {
  const map = {
    0: "晴朗",
    1: "大致晴",
    2: "局部多云",
    3: "阴天",
    45: "有雾",
    48: "冻雾",
    51: "小毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    71: "小雪",
    80: "阵雨",
    95: "雷暴",
  };
  return map[code] || `天气代码 ${code}`;
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

function formatLocationLabel(city, district) {
  const cityLabel = city || "当前城市";
  if (!district || district === cityLabel) {
    return cityLabel;
  }
  return `${cityLabel}, ${district}`;
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
  const button = event.target.closest("[data-theme]");
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
  syncWeekToDate();
  ensureRecord(state.selectedDate);
  setSaveStatus(
    `正在加载 ${formatDisplayDate(parseLocalDate(state.selectedDate))} 的记录...`,
  );
  try {
    await syncSelectedDateRecord({ silent: true });
    await syncSelectedWeekReview({ silent: true });
  } catch (error) {
    console.warn("Failed to load remote data for selected date.", error);
  }
  render();
  setSaveStatus(
    `已切换到 ${formatDisplayDate(parseLocalDate(state.selectedDate))}`,
  );
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
  if (action === "delete-task") {
    void deleteTask(taskId);
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
  if (!input) {
    return;
  }
  updateNoteDraft(input.dataset.taskId, input.value);
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

function handleShowMoreClick(event) {
  const button = event.target.closest("[data-app-tab-target]");
  if (!button) {
    return;
  }
  state.activeAppTab = button.dataset.appTabTarget;
  renderTopTabs();
}

function handleWidgetClick(event) {
  const button = event.target.closest("[data-widget-toggle]");
  if (!button) {
    return;
  }
  openWidgetSettings(button.dataset.widgetToggle);
}

function handleModalClick(event) {
  if (event.target.closest("[data-modal-close]")) {
    closeModal();
  }
}

function handleModalSubmit(event) {
  if (event.target !== elements.settingsForm) {
    return;
  }
  event.preventDefault();
  saveSettings(new FormData(elements.settingsForm));
}

function handleAuthAction() {
  if (state.auth.user) {
    void signOutAuth();
    return;
  }
  openAuthGate();
}

function handleAuthSubmit(event) {
  if (!elements.authGateForm || event.target !== elements.authGateForm) {
    return;
  }
  event.preventDefault();
  const submitter = event.submitter;
  const action = submitter?.dataset.authAction || "signin";
  void authenticateWithPassword(new FormData(elements.authGateForm), action);
}

function bindEvents() {
  document
    .querySelector(".top-tabs")
    .addEventListener("click", handleTopTabClick);
  document
    .querySelector(".center-tabs")
    .addEventListener("click", handleCenterTabClick);
  document
    .querySelector(".theme-switcher")
    .addEventListener("click", handleThemeClick);
  elements.authAction.addEventListener("click", handleAuthAction);
  elements.calendarGrid.addEventListener("click", handleCalendarClick);
  elements.taskList.addEventListener("click", handleTaskListClick);
  elements.taskList.addEventListener("input", handleTaskListInput);
  elements.taskList.addEventListener("submit", handleTaskListSubmit);
  document.querySelectorAll("[data-app-tab-target]").forEach((button) => {
    button.addEventListener("click", handleShowMoreClick);
  });
  document
    .querySelector(".right-rail")
    .addEventListener("click", handleWidgetClick);
  elements.settingsModal.addEventListener("click", handleModalClick);
  elements.settingsForm.addEventListener("submit", handleModalSubmit);
  if (elements.authGateForm) {
    elements.authGateForm.addEventListener("submit", handleAuthSubmit);
  }
  if (elements.trialAction) {
    elements.trialAction.addEventListener("click", enterTrialMode);
  }
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

bindEvents();
ensureRecord(state.selectedDate);
persistStateSilently();
render();
void initAuthClient();
void bootstrapRemoteData();
refreshExternalData();

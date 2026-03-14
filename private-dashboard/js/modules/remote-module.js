export function createRemoteModule(deps) {
  const {
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
    renderControls,
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
    refreshFavoriteHighlights,
    prefetchContentFeedsOnSessionStart,
    recordSyncAttempt,
    recordSyncSuccess,
  } = deps;

  let remoteBootstrapPromise = null;
  let apiBaseDetectionPromise = null;

  function getPreferencesWithoutTheme(preferences) {
    if (!preferences || typeof preferences !== "object") {
      return preferences;
    }
    return {
      ...preferences,
      theme: undefined,
    };
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

  function saveApiBase(baseUrl) {
    if (!baseUrl) {
      localStorage.removeItem(API_BASE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(API_BASE_STORAGE_KEY, baseUrl);
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

  function resetPendingBucket() {
    const scopeKey = getPendingScopeKey();
    if (!scopeKey) {
      return;
    }
    state.pendingSync[scopeKey] = {
      taskUpserts: {},
      taskDeletes: {},
      dirtyRecords: {},
      weeklySummaryUpserts: {},
    };
    persistPendingSyncStore();
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

  async function saveAccountPreferencesRemote() {
    if (!state.auth.user) {
      return state.data.preferences;
    }
    recordSyncAttempt();
    const payload = getPreferencesWithoutTheme(structuredClone(state.data.preferences));
    const response = await fetchApiJson("/api/account/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response?.preferences) {
      applyAccountPreferences(getPreferencesWithoutTheme(response.preferences), {
        applyTheme: false,
      });
    }
    recordSyncSuccess();
    return state.data.preferences;
  }

  async function fetchAuthSession() {
    try {
      return await fetchApiJson("/api/auth/me", {
        requireAuth: false,
        timeoutMs: 3500,
      });
    } catch (error) {
      state.remote.apiBase = "";
      saveApiBase("");
      return fetchApiJson("/api/auth/me", {
        requireAuth: false,
        timeoutMs: 3500,
      });
    }
  }

  async function signOutAuth() {
    const apiBase = state.remote.apiBase || localStorage.getItem(API_BASE_STORAGE_KEY) || "";
    const sessionId = loadSessionId();
    state.auth.user = null;
    state.auth.status = "idle";
    state.remote.status = "offline";
    state.remote.apiBase = "";
    state.remote.weeklyReview = null;
    state.remote.connectedThisSession = false;
    saveApiBase("");
    saveSessionId("");
    switchDataScope(LOCAL_SCOPE_KEY);

    try {
      if (apiBase) {
        const headers = sessionId ? { "x-session-id": sessionId } : {};
        void fetchJson(joinApiPath(apiBase, "/api/auth/signout"), {
          method: "POST",
          requireAuth: false,
          credentials: "include",
          keepalive: true,
          headers,
          timeoutMs: 1200,
        }).catch((error) => {
          console.warn("Failed to sign out.", error);
        });
      }
    } catch (error) {
      console.warn("Failed to sign out.", error);
    }
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
      applyAccountPreferences(getPreferencesWithoutTheme(payload.user.preferences), {
        applyTheme: false,
      });
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
        let pendingSyncFailed = false;
        if (hasPendingSync()) {
          try {
            await flushPendingSync();
          } catch (error) {
            pendingSyncFailed = true;
            console.warn("Failed to flush pending sync during bootstrap.", error);
          }
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
        if (pendingSyncFailed) {
          setSaveStatus("云端已连接，但有部分待同步内容提交失败", "default");
        } else if (shouldShowConnecting || state.remote.status !== "ready") {
          setSaveStatus("后端已连接，当前通过 API 同步数据");
        }
        render();
        void refreshFavoriteHighlights();
        void prefetchContentFeedsOnSessionStart();
      } catch (error) {
        console.warn("Failed to bootstrap remote data.", error);
        state.remote.status = "offline";
        state.remote.apiBase = "";
        state.remote.weeklyReview = null;
        state.remote.connectedThisSession = false;
        saveApiBase("");
        renderControls();
        const reason = String(error?.message || "").trim();
        setSaveStatus(
          reason
            ? `后端同步失败：${reason}，已回退为本地保存`
            : "后端同步失败，已回退为本地保存",
        );
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
    if (!snapshot || !isRemoteReady() || !state.auth.user) {
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
    if (!apiBaseDetectionPromise) {
      apiBaseDetectionPromise = (async () => {
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
          return "";
        }
      })().finally(() => {
        apiBaseDetectionPromise = null;
      });
    }

    return apiBaseDetectionPromise;
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
    if (!state.remote.apiBase) {
      throw new Error("Remote API unavailable");
    }
    const headers = new Headers(options.headers || {});
    const sessionId = loadSessionId();
    if (requireAuth && !sessionId && !state.auth.user) {
      throw new Error("Remote API unavailable");
    }
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
    };
  }

  function queueAllCurrentDataForSync() {
    if (!state.auth.user) {
      return;
    }
    state.data.taskTypes.forEach((task) => {
      markTaskUpsertPending(task);
    });
    Object.keys(state.data.dailyRecords || {}).forEach((date) => {
      const record = ensureRecord(date);
      if (
        Object.values(record.tasks || {}).some((taskState) =>
          Boolean(taskState?.completed) ||
          (Array.isArray(taskState?.notes) && taskState.notes.length > 0),
        )
      ) {
        markRecordPending(date);
      }
    });
    Object.entries(state.data.weeklySummaries || {}).forEach(([week, summary]) => {
      if (summary?.content?.trim()) {
        markWeeklySummaryPending(week, summary);
      }
    });
  }

  async function syncAllDataToRemote(options = {}) {
    const { replaceRemote = false } = options;
    if (!state.auth.user) {
      return { synced: false, mode: "local-only" };
    }

    resetPendingBucket();
    queueAllCurrentDataForSync();

    if (!isRemoteReady()) {
      return { synced: false, mode: "queued" };
    }

    if (replaceRemote) {
      recordSyncAttempt();
      await fetchApiJson("/api/account/clear-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      clearContentCacheForUser();
    }

    await flushPendingSync();
    await syncTasksFromRemote();
    await Promise.all([
      syncSelectedDateRecord({ silent: true }),
      syncSelectedWeekReview({ silent: true }),
      syncSelectedWeekSummary({ silent: true }),
    ]);
    persistStateSilently();
    recordSyncSuccess();
    return { synced: true, mode: replaceRemote ? "replace" : "merge" };
  }

  function clearContentCacheForUser() {
    state.content.finance.items = [];
    state.content.finance.featured = [];
    state.content.finance.total = 0;
    state.content.finance.loaded = false;
    state.content.finance.lastRefreshedAt = "";
    state.content.finance.lastRefreshStats = null;
    state.content.finance.error = "";
    state.content.science.items = [];
    state.content.science.featured = [];
    state.content.science.total = 0;
    state.content.science.loaded = false;
    state.content.science.lastRefreshedAt = "";
    state.content.science.lastRefreshStats = null;
    state.content.science.error = "";
  }

  async function flushPendingSync() {
    if (!isRemoteReady() || !state.auth.user) {
      return;
    }

    const bucket = getPendingBucket(false);
    if (!bucket) {
      return;
    }

    recordSyncAttempt();

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
    recordSyncSuccess();
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
      recordSyncAttempt();
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
      recordSyncSuccess();
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
    recordSyncAttempt();
    const response = await fetchApiJson(`/api/daily-records/${date}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.data.dailyRecords[date] = normalizeRemoteRecord(response.record, date);
    clearRecordPending(date);
    persistStateSilently();
    recordSyncSuccess();
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
      recordSyncAttempt();
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
      recordSyncSuccess();
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
      recordSyncAttempt();
      await fetchApiJson(`/api/tasks/${taskId}`, { method: "DELETE" });
      clearTaskPending(taskId);
      await syncTasksFromRemote();
      await syncSelectedWeekReview({ silent: true });
      persistStateSilently();
      recordSyncSuccess();
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
      recordSyncAttempt();
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
      recordSyncSuccess();
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

    nextRecord.updatedAt = record?.updatedAt || "";
    return nextRecord;
  }

  return {
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
  };
}

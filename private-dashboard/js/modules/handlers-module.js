export function createHandlersModule(deps) {
  const {
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
    openDataTransferModal,
    closeDataTransferModal,
    handleDataTransferSubmit,
    openSyncCenterModal,
    closeSyncCenterModal,
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
  } = deps;

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
      render();
    }
    if (action === "set-task-color") {
      state.activePaletteTaskId = null;
      void updateTaskColor(taskId, actionTarget.dataset.color);
    }
    if (action === "set-new-task-color") {
      state.newTaskColor = actionTarget.dataset.color;
      render();
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

  function handleImportData() {
    openDataTransferModal("import");
  }

  function handleExportData() {
    openDataTransferModal("export");
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

  function handleWidgetClick(event) {
    const favoritesJump = event.target.closest("[data-favorites-jump]");
    if (favoritesJump) {
      const channel = favoritesJump.dataset.favoritesJump || "finance";
      if (channel === "finance" || channel === "science") {
        state.activeAppTab = channel;
        renderTopTabs();
        scrollContentChannelToTop(channel);
        void loadChannelContent(channel, {
          page: 1,
          favorite: "favorites",
        });
      }
      return;
    }
    const weatherRefreshButton = event.target.closest("[data-weather-refresh]");
    if (weatherRefreshButton) {
      void refreshWeather();
      return;
    }
    const githubRefreshButton = event.target.closest("[data-github-refresh]");
    if (githubRefreshButton) {
      void refreshGitHubRepo();
      return;
    }
    const stockRefreshButton = event.target.closest("[data-stock-refresh]");
    if (stockRefreshButton) {
      void refreshStocks();
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
    if (action === "sync-center") {
      closeAccountMenu();
      openSyncCenterModal();
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
    if (event.target.closest("[data-data-transfer-modal-close]")) {
      closeDataTransferModal();
    }
    if (event.target.closest("[data-sync-center-modal-close]")) {
      closeSyncCenterModal();
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
    saveWidgetSettings(new FormData(elements.settingsForm));
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
    elements.importDataButton?.addEventListener("click", handleImportData);
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
      void handleAccountRecoveryCodeSubmit(event);
    });
    elements.dataTransferModal?.addEventListener("click", handleModalClick);
    elements.dataTransferModal?.addEventListener("submit", (event) => {
      void handleDataTransferSubmit(event);
    });
    elements.syncCenterModal?.addEventListener("click", handleModalClick);
    elements.syncCenterModal?.addEventListener("click", (event) => {
      void handleSyncCenterClick(event);
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

  return {
    bindEvents,
  };
}

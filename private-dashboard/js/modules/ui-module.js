export function createUiModule(deps) {
  const {
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
    renderAccountMenu,
    escapeHtml,
    parseLocalDate,
    addDays,
    getStartOfWeek,
    formatDateKey,
  } = deps;

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
    contentChannelIds.forEach((channel) => {
      const view = elements.contentByChannel?.[channel]?.view;
      if (view) {
        view.hidden = state.activeAppTab !== channel;
      }
    });
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
    if (elements.favoritesCard) {
      elements.favoritesCard.hidden = !sidebar.favorites;
    }
    if (elements.weatherCard) {
      elements.weatherCard.hidden = !sidebar.weather;
    }
    if (elements.stockCard) {
      elements.stockCard.hidden = !sidebar.stock;
    }
  }

  function renderCalendar() {
    const date = parseLocalDate(state.selectedDate);
    const month = date.getMonth();
    const firstCell = getStartOfWeek(new Date(date.getFullYear(), month, 1));
    const cells = [];
    const todayKey = formatDateKey(new Date());
    const activeTaskCount = Math.max(1, getActiveTaskTypes().length);

    const year = String(date.getFullYear()).slice(-2);
    const monthLabel = `${date.getMonth() + 1}`.padStart(2, "0");
    const dayLabelShort = `${date.getDate()}`.padStart(2, "0");
    elements.calendarMonthLabel.textContent = `${year}/${monthLabel}/${dayLabelShort}`;

    function getHeatLevel(completedCount) {
      if (completedCount <= 0) {
        return 0;
      }
      const ratio = completedCount / activeTaskCount;
      if (ratio >= 1 || completedCount >= 4) {
        return 4;
      }
      if (ratio >= 0.72 || completedCount >= 3) {
        return 3;
      }
      if (ratio >= 0.4 || completedCount >= 2) {
        return 2;
      }
      return 1;
    }

    for (
      let current = new Date(firstCell);
      cells.length < 42;
      current = addDays(current, 1)
    ) {
      const currentKey = formatDateKey(current);
      const record = state.data.dailyRecords[currentKey];
      const completedCount = record ? getCompletedCount(record) : 0;
      const level = getHeatLevel(completedCount);
      const dayLabel = new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        weekday: "short",
      }).format(current);
      const taskLabel = completedCount > 0 ? `完成 ${completedCount} 项任务` : "暂无完成任务";
      cells.push(`
        <button
          type="button"
          class="calendar-day level-${level} ${current.getMonth() === month ? "" : "is-muted"} ${
            currentKey === state.selectedDate ? "is-selected" : ""
          } ${currentKey === todayKey ? "is-today" : ""}"
          data-calendar-date="${currentKey}"
          aria-label="${dayLabel}，${taskLabel}"
          title="${dayLabel} · ${taskLabel}"
        >
          <span class="calendar-day-dot" aria-hidden="true"></span>
        </button>
      `);
    }

    elements.calendarGrid.innerHTML = cells.join("");
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
    renderAuthStatusChip();
    renderAccountMenu();
  }

  return {
    applyButtonTooltips,
    renderTopTabs,
    renderCenterTabs,
    renderAuthStatusChip,
    getSidebarPreferences,
    renderSidebarCards,
    renderCalendar,
    renderControls,
  };
}

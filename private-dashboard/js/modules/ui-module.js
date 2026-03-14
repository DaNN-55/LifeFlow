export function createUiModule(deps) {
  const {
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
    elements.financeView.hidden = state.activeAppTab !== "finance";
    elements.scienceView.hidden = state.activeAppTab !== "science";
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

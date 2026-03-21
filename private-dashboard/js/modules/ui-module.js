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
  let toolbarSelectEventsBound = false;

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

  function closeToolbarSelectMenus(exceptControl = null) {
    document.querySelectorAll(".toolbar-select-control.is-open").forEach((control) => {
      if (exceptControl && control === exceptControl) {
        return;
      }
      control.classList.remove("is-open");
      control
        .querySelector("[data-toolbar-select-trigger]")
        ?.setAttribute("aria-expanded", "false");
    });
  }

  function buildToolbarSelectOptionMarkup(select) {
    return Array.from(select.options || [])
      .map((option) => {
        const selected = option.value === select.value;
        return `
          <button
            type="button"
            class="toolbar-select-option ${selected ? "is-selected" : ""}"
            data-toolbar-select-option="${escapeHtml(option.value)}"
            role="option"
            aria-selected="${selected ? "true" : "false"}"
          >
            <span class="material-symbols-outlined toolbar-select-option-check" aria-hidden="true">check</span>
            <span class="toolbar-select-option-text">${escapeHtml(option.textContent || "")}</span>
          </button>
        `;
      })
      .join("");
  }

  function syncToolbarSelectControl(select) {
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }
    const control = select.closest(".toolbar-select-control");
    if (!control) {
      return;
    }

    select.classList.add("toolbar-native-select");

    let shell = control.querySelector("[data-toolbar-select-shell]");
    if (!shell) {
      shell = document.createElement("div");
      shell.className = "toolbar-select-shell";
      shell.dataset.toolbarSelectShell = "true";
      shell.innerHTML = `
        <button
          type="button"
          class="toolbar-select-trigger"
          data-toolbar-select-trigger
          aria-haspopup="listbox"
          aria-expanded="false"
        >
          <span class="toolbar-select-trigger-text"></span>
          <span class="material-symbols-outlined toolbar-select-caret" aria-hidden="true">expand_more</span>
        </button>
        <div class="toolbar-select-menu" data-toolbar-select-menu role="listbox"></div>
      `;
      control.appendChild(shell);
    }

    const trigger = shell.querySelector("[data-toolbar-select-trigger]");
    const triggerText = shell.querySelector(".toolbar-select-trigger-text");
    const menu = shell.querySelector("[data-toolbar-select-menu]");
    const selectedOption =
      Array.from(select.options || []).find((option) => option.value === select.value) ||
      select.options?.[0] ||
      null;

    const isHidden = Boolean(select.hidden || control.hidden);
    control.classList.toggle("is-hidden", isHidden);
    shell.hidden = isHidden;
    if (isHidden) {
      control.classList.remove("is-open");
      trigger?.setAttribute("aria-expanded", "false");
      return;
    }

    control.dataset.selectId = select.id || "";
    if (trigger) {
      trigger.disabled = Boolean(select.disabled || !select.options.length);
      trigger.dataset.selectId = select.id || "";
    }
    if (triggerText) {
      triggerText.textContent = selectedOption?.textContent?.trim() || "";
    }
    if (menu) {
      menu.dataset.selectId = select.id || "";
      menu.innerHTML = buildToolbarSelectOptionMarkup(select);
    }
  }

  function bindToolbarSelectEvents() {
    if (toolbarSelectEventsBound) {
      return;
    }
    toolbarSelectEventsBound = true;

    document.addEventListener("click", (event) => {
      const optionButton = event.target.closest("[data-toolbar-select-option]");
      if (optionButton) {
        const menu = optionButton.closest("[data-toolbar-select-menu]");
        const selectId = menu?.dataset.selectId || "";
        const select = selectId ? document.getElementById(selectId) : null;
        if (select instanceof HTMLSelectElement) {
          select.value = optionButton.dataset.toolbarSelectOption || "";
          select.dispatchEvent(new Event("change", { bubbles: true }));
          syncToolbarSelectControl(select);
        }
        closeToolbarSelectMenus();
        return;
      }

      const trigger = event.target.closest("[data-toolbar-select-trigger]");
      if (trigger) {
        const control = trigger.closest(".toolbar-select-control");
        const shouldOpen = !control?.classList.contains("is-open");
        closeToolbarSelectMenus(control || null);
        if (control && shouldOpen) {
          control.classList.add("is-open");
          trigger.setAttribute("aria-expanded", "true");
        } else {
          trigger.setAttribute("aria-expanded", "false");
        }
        return;
      }

      if (!event.target.closest(".toolbar-select-control")) {
        closeToolbarSelectMenus();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeToolbarSelectMenus();
      }
    });
  }

  function syncToolbarFilterControls(root = document) {
    bindToolbarSelectEvents();
    root
      .querySelectorAll(".toolbar-select-control select")
      .forEach((select) => syncToolbarSelectControl(select));
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
      return;
    }

    if (state.auth.status === "authenticating") {
      chip.classList.add("is-syncing");
      chip.textContent = "登录中";
      return;
    }

    if (state.auth.status === "creating-account") {
      chip.classList.add("is-syncing");
      chip.textContent = "创建中";
      return;
    }

    chip.classList.add("account-chip");
    chip.textContent = "未登录";
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

    const year = String(date.getFullYear());
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

  function setProgressFill(element, ratio) {
    if (!element) {
      return;
    }
    const safeRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
    element.style.width = `${(safeRatio * 100).toFixed(1)}%`;
  }

  function renderHeaderProgress() {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);
    const yearRatio = (now.getTime() - yearStart.getTime()) / (nextYearStart.getTime() - yearStart.getTime());
    setProgressFill(elements.yearProgressFill, yearRatio);
    if (elements.yearProgressValue) {
      elements.yearProgressValue.textContent = `${(yearRatio * 100).toFixed(1)}%`;
    }

    const birthDateValue = String(state.data.preferences?.profile?.birthDate || "1996-11-05").trim();
    const lifeExpectancyYears = Number(state.data.preferences?.profile?.lifeExpectancyYears) || 80;
    let lifeRatio = 0;
    let lifeLabel = "--";
    if (/^\d{4}-\d{2}-\d{2}$/.test(birthDateValue)) {
      const birthDate = new Date(`${birthDateValue}T00:00:00`);
      const endDate = new Date(`${birthDateValue}T00:00:00`);
      endDate.setFullYear(endDate.getFullYear() + lifeExpectancyYears);
      const denominator = endDate.getTime() - birthDate.getTime();
      if (denominator > 0) {
        lifeRatio = Math.max(0, Math.min(1, (now.getTime() - birthDate.getTime()) / denominator));
        lifeLabel = `${(lifeRatio * 100).toFixed(1)}%`;
      }
    }
    if (elements.lifeProgressValue) {
      elements.lifeProgressValue.textContent = lifeLabel;
    }
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
    renderHeaderProgress();
    renderWeeklyFilterOptions();
    elements.weeklyTaskFilter.value = state.weeklyFilters.taskId;
    elements.weeklyCompletionFilter.value = state.weeklyFilters.completion;
    elements.weeklyArchiveFilter.value = state.weeklyFilters.archive;
    elements.weeklySummaryInput.value = getWeeklySummaryDraft(state.selectedWeek);
    renderWeeklySummaryContent();
    renderWeeklySummaryMeta();
    renderSaveStatusState();
    syncToolbarFilterControls(document.querySelector("#weekly-panel") || document);

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
    syncToolbarFilterControls,
  };
}

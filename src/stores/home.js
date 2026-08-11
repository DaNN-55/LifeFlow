import { defineStore } from "pinia";

import { defaultWidgets } from "../app/constants";
import {
  applyDashboardMutation,
  hasDashboardSnapshotData,
  loadDashboardSnapshot,
  syncDashboardSnapshot,
} from "../services/sync-service";
import {
  createEmptyHomeState,
  createEmptyWeatherState,
  fetchGitHubPreview,
  fetchStockWidget,
  fetchWeatherWidget,
  formatDisplayStockCode,
  normalizeSymbols,
} from "../services/home-api";
import { demoState } from "../services/demo-state";
import {
  addDays,
  formatDateKey,
  formatDateTime,
  formatMonthDay,
  formatMonthValue,
  getTodayDateString,
  parseLocalDate,
} from "../utils/date";
import { formatMonthDayLabel, formatWeekday, formatWeekdayShortEn } from "../utils/home";
import { loadSessionId } from "../services/config";
import { useSessionStore } from "./session";
import { useTodayStore } from "./today";

function countExecutionDensity(record) {
  const tasks = record?.payload?.tasks;
  if (!tasks || typeof tasks !== "object") {
    return 0;
  }
  return Object.values(tasks).reduce((total, task) => {
    const completed = task?.completed ? 1 : 0;
    const notes = Array.isArray(task?.notes) ? Math.min(task.notes.length, 3) : 0;
    return total + completed + notes;
  }, 0);
}

function getCalendarLevel(score) {
  if (score >= 6) {
    return 4;
  }
  if (score >= 4) {
    return 3;
  }
  if (score >= 2) {
    return 2;
  }
  if (score >= 1) {
    return 1;
  }
  return 0;
}

function createCalendarGrid(selectedDateString) {
  const selected = parseLocalDate(selectedDateString || getTodayDateString());
  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const monthEnd = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
  const gridStart = new Date(monthStart);
  const startDay = gridStart.getDay();
  const startOffset = startDay === 0 ? 6 : startDay - 1;
  gridStart.setDate(gridStart.getDate() - startOffset);
  const gridEnd = new Date(monthEnd);
  const endDay = gridEnd.getDay();
  const endOffset = endDay === 0 ? 0 : 7 - endDay;
  gridEnd.setDate(gridEnd.getDate() + endOffset);

  const dates = [];
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    dates.push(new Date(cursor));
  }

  return {
    selected,
    monthLabel: `${selected.getFullYear()}/${String(selected.getMonth() + 1).padStart(2, "0")}/${String(selected.getDate()).padStart(2, "0")}`,
    dates,
  };
}

function pickSupplementalHomeState(home = {}) {
  const picked = {};
  if (home?.github && typeof home.github === "object") {
    picked.github = home.github;
  }
  if (home?.weather && typeof home.weather === "object") {
    picked.weather = home.weather;
  }
  if (home?.stock && typeof home.stock === "object") {
    picked.stock = home.stock;
  }
  if (typeof home?.sidebarRefreshSessionId === "string") {
    picked.sidebarRefreshSessionId = home.sidebarRefreshSessionId;
  }
  return picked;
}

export const useHomeStore = defineStore("home", {
  state: () => ({
    calendarMonth: formatMonthValue(new Date()),
    calendarSelectedDate: getTodayDateString(),
    calendarDays: [],
    calendarLabel: "",
    loadingCalendar: false,
    loaded: false,
    ...createEmptyHomeState(),
  }),
  getters: {
    githubProfileUrl() {
      const sessionStore = useSessionStore();
      return String(sessionStore.user?.preferences?.widgets?.github?.profileUrl || defaultWidgets.github.profileUrl || "").trim();
    },
    favoritesChannel() {
      const sessionStore = useSessionStore();
      return String(sessionStore.user?.preferences?.widgets?.favorites?.channel || defaultWidgets.favorites.channel || "all");
    },
    weatherLocationQuery() {
      const sessionStore = useSessionStore();
      return String(sessionStore.user?.preferences?.widgets?.weather?.locationQuery || defaultWidgets.weather.locationQuery || "").trim();
    },
    stockSymbolsInput() {
      const sessionStore = useSessionStore();
      return String(sessionStore.user?.preferences?.widgets?.stock?.symbols || defaultWidgets.stock.symbols);
    },
    todaySummary() {
      const todayStore = useTodayStore();
      return {
        completedCount: todayStore.completedCount,
        activeTaskCount: todayStore.activeTaskCount,
        dateLabel: todayStore.selectedDateLabel,
      };
    },
  },
  actions: {
    applyCachedHome(home = {}) {
      if (home.github && typeof home.github === "object") {
        this.github = home.github;
      }
      if (home.weather && typeof home.weather === "object") {
        this.weather = {
          ...createEmptyWeatherState(),
          ...home.weather,
        };
      }
      if (home.stock && typeof home.stock === "object") {
        this.stock = home.stock;
      }
    },
    async bootstrap() {
      const sessionStore = useSessionStore();
      if (sessionStore.previewMode) {
        const snapshot = demoState.ensure();
        this.applyCachedHome({
          ...pickSupplementalHomeState(snapshot.home || {}),
        });
        this.weather = {
          ...this.weather,
          forecast: (this.weather.forecast || []).map((item) => ({
            ...item,
            dayLabel: formatWeekday(item.date),
            axisLabel: formatWeekdayShortEn(item.date),
            dateLabel: formatMonthDayLabel(item.date),
          })),
        };
        await this.loadCalendar(this.calendarSelectedDate, snapshot);
        this.loaded = true;
        return;
      }
      if (!sessionStore.user?.id) {
        this.loaded = false;
        this.weather = createEmptyWeatherState();
        return;
      }

      const cachedSnapshot = loadDashboardSnapshot(sessionStore.user.id);
      const cachedHome = {
        ...pickSupplementalHomeState(cachedSnapshot?.home || {}),
      };
      this.applyCachedHome(cachedHome);
      const currentSessionId = loadSessionId();
      const lastSidebarRefreshSessionId = String(cachedHome.sidebarRefreshSessionId || "");
      const shouldAutoRefreshSidebar = Boolean(currentSessionId && currentSessionId !== lastSidebarRefreshSessionId);
      if (hasDashboardSnapshotData(cachedSnapshot)) {
        await this.loadCalendar(this.calendarSelectedDate, cachedSnapshot);
      }

      const remoteSnapshot = await syncDashboardSnapshot(sessionStore.user.id);
      this.applyCachedHome({
        ...pickSupplementalHomeState(remoteSnapshot?.home || {}),
      });

      const jobs = [this.loadCalendar(this.calendarSelectedDate, remoteSnapshot)];
      if (shouldAutoRefreshSidebar) {
        jobs.push(this.refreshSidebarAfterLogin(currentSessionId));
      }

      await Promise.allSettled(jobs);
      this.loaded = true;
    },
    async refreshSidebarAfterLogin(sessionId = loadSessionId()) {
      await Promise.allSettled([
        this.refreshGitHub(),
        this.refreshWeather(),
        this.refreshStocks(),
      ]);

      const sessionStore = useSessionStore();
      applyDashboardMutation(sessionStore.user?.id, {
        sidebarRefreshSessionId: String(sessionId || ""),
      });
    },
    async loadCalendar(dateString = this.calendarSelectedDate, snapshot = null) {
      this.loadingCalendar = true;
      this.calendarSelectedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(dateString || "")) ? String(dateString) : getTodayDateString();
      const { dates, monthLabel } = createCalendarGrid(this.calendarSelectedDate);
      this.calendarLabel = monthLabel;

      const todayKey = getTodayDateString();
      const selectedMonth = parseLocalDate(this.calendarSelectedDate).getMonth();
      const selectedYear = parseLocalDate(this.calendarSelectedDate).getFullYear();
      const resolvedSnapshot = snapshot || loadDashboardSnapshot(useSessionStore().user?.id);
      const records = dates.map((date) => {
        const key = formatDateKey(date);
        return resolvedSnapshot?.dailyRecords?.[key] || { date: key, payload: { tasks: {} } };
      });

      this.calendarDays = dates.map((date, index) => {
        const key = formatDateKey(date);
        const density = countExecutionDensity(records[index]);
        return {
          date: key,
          label: String(date.getDate()),
          level: getCalendarLevel(density),
          density,
          isMuted: date.getFullYear() !== selectedYear || date.getMonth() !== selectedMonth,
          isToday: key === todayKey,
          isSelected: key === this.calendarSelectedDate,
        };
      });
      this.loadingCalendar = false;
    },
    async selectCalendarDate(dateString) {
      await this.loadCalendar(dateString);
    },
    async refreshGitHub() {
      if (useSessionStore().previewMode) {
        return;
      }
      this.github = await fetchGitHubPreview(this.githubProfileUrl).catch(() => ({
        status: "error",
        repos: [],
        url: this.githubProfileUrl,
        message: "GitHub 预览暂时不可用",
      }));
      const sessionStore = useSessionStore();
      applyDashboardMutation(sessionStore.user?.id, {
        github: this.github,
      });
    },
    async refreshWeather() {
      if (useSessionStore().previewMode) {
        return;
      }
      const weather = await fetchWeatherWidget(this.weatherLocationQuery).catch(() => createEmptyWeatherState());
      this.weather = {
        ...createEmptyWeatherState(),
        ...weather,
        forecast: Array.isArray(weather?.forecast)
          ? weather.forecast.map((item) => ({
              ...item,
              dayLabel: formatWeekday(item.date),
              axisLabel: formatWeekdayShortEn(item.date),
              dateLabel: formatMonthDayLabel(item.date),
            }))
          : [],
        status: weather?.location ? "ready" : "error",
      };
      const sessionStore = useSessionStore();
      applyDashboardMutation(sessionStore.user?.id, {
        weather: this.weather,
      });
    },
    async refreshStocks() {
      if (useSessionStore().previewMode) {
        return;
      }
      this.stock = await fetchStockWidget(this.stockSymbolsInput);
      const sessionStore = useSessionStore();
      applyDashboardMutation(sessionStore.user?.id, {
        stock: this.stock,
      });
    },
    formatDateTime,
    formatMonthDay,
    formatDisplayStockCode,
    normalizeSymbols,
  },
});

import { defineStore } from "pinia";

import { defaultWidgets } from "../app/constants";
import { stateContinuity, views } from "../services/state-continuity";
import {
  createEmptyHomeState,
  createEmptyWeatherState,
  fetchGitHubPreview,
  fetchStockWidget,
  fetchWeatherWidget,
  formatDisplayStockCode,
  normalizeSymbols,
} from "../services/home-api";
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

let observedScope = null;
let stopObserving = null;

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
      return String(sessionStore.preferences?.widgets?.github?.profileUrl || defaultWidgets.github.profileUrl || "").trim();
    },
    favoritesChannel() {
      const sessionStore = useSessionStore();
      return String(sessionStore.preferences?.widgets?.favorites?.channel || defaultWidgets.favorites.channel || "all");
    },
    weatherLocationQuery() {
      const sessionStore = useSessionStore();
      return String(sessionStore.preferences?.widgets?.weather?.locationQuery || defaultWidgets.weather.locationQuery || "").trim();
    },
    stockSymbolsInput() {
      const sessionStore = useSessionStore();
      return String(sessionStore.preferences?.widgets?.stock?.symbols || defaultWidgets.stock.symbols);
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
    getContinuityScope() {
      const sessionStore = useSessionStore();
      if (sessionStore.previewMode) return stateContinuity.open({ mode: "demo" });
      if (!sessionStore.user?.id) return null;
      return stateContinuity.open({ id: sessionStore.user.id });
    },
    observeContinuity(scope) {
      if (!scope || observedScope === scope) return;
      stopObserving?.();
      observedScope = scope;
      stopObserving = scope.observe(() => {
        const data = scope.view(views.home()).data;
        this.applyCachedHome(pickSupplementalHomeState(data.supplemental));
        this.loadCalendar(this.calendarSelectedDate, data);
      });
    },
    applyCachedHome(home = {}) {
      const empty = createEmptyHomeState();
      this.github = home.github && typeof home.github === "object" ? home.github : empty.github;
      this.weather = {
        ...createEmptyWeatherState(),
        ...(home.weather && typeof home.weather === "object" ? home.weather : {}),
      };
      this.stock = home.stock && typeof home.stock === "object" ? home.stock : empty.stock;
    },
    async bootstrap() {
      const sessionStore = useSessionStore();
      const scope = this.getContinuityScope();
      this.observeContinuity(scope);
      if (sessionStore.previewMode) {
        const projection = scope.view(views.home());
        this.applyCachedHome({
          ...pickSupplementalHomeState(projection.data.supplemental),
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
        await this.loadCalendar(this.calendarSelectedDate, projection.data);
        this.loaded = true;
        return;
      }
      if (!sessionStore.user?.id) {
        this.loaded = false;
        this.weather = createEmptyWeatherState();
        return;
      }

      const cachedSnapshot = scope.view(views.home()).data;
      const cachedHome = {
        ...pickSupplementalHomeState(cachedSnapshot?.supplemental || {}),
      };
      this.applyCachedHome(cachedHome);
      const currentSessionId = loadSessionId();
      const lastSidebarRefreshSessionId = String(cachedHome.sidebarRefreshSessionId || "");
      const shouldAutoRefreshSidebar = Boolean(currentSessionId && currentSessionId !== lastSidebarRefreshSessionId);
      await this.loadCalendar(this.calendarSelectedDate, cachedSnapshot);

      await scope.control.sync();
      const remoteSnapshot = scope.view(views.home()).data;
      this.applyCachedHome({
        ...pickSupplementalHomeState(remoteSnapshot?.supplemental || {}),
      });

      const jobs = [this.loadCalendar(this.calendarSelectedDate, remoteSnapshot)];
      if (shouldAutoRefreshSidebar) {
        jobs.push(this.refreshSidebarAfterLogin(currentSessionId, scope));
      }

      await Promise.allSettled(jobs);
      this.loaded = true;
    },
    async refreshSidebarAfterLogin(sessionId = loadSessionId(), scope = this.getContinuityScope()) {
      const commitHome = scope?.supplemental.beginHomeUpdate();
      await Promise.allSettled([
        this.refreshGitHub(scope),
        this.refreshWeather(scope),
        this.refreshStocks(scope),
      ]);

      commitHome?.({
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
      const resolvedSnapshot = snapshot || this.getContinuityScope()?.view(views.home()).data || {};
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
    async refreshGitHub(scope = this.getContinuityScope()) {
      if (useSessionStore().previewMode) {
        return;
      }
      const commitHome = scope?.supplemental.beginHomeUpdate();
      const github = await fetchGitHubPreview(this.githubProfileUrl).catch(() => ({
        status: "error",
        repos: [],
        url: this.githubProfileUrl,
        message: "GitHub 预览暂时不可用",
      }));
      if (commitHome?.({ github })) this.github = github;
    },
    async refreshWeather(scope = this.getContinuityScope()) {
      if (useSessionStore().previewMode) {
        return;
      }
      const commitHome = scope?.supplemental.beginHomeUpdate();
      const weather = await fetchWeatherWidget(this.weatherLocationQuery).catch(() => createEmptyWeatherState());
      const nextWeather = {
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
      if (commitHome?.({ weather: nextWeather })) this.weather = nextWeather;
    },
    async refreshStocks(scope = this.getContinuityScope()) {
      if (useSessionStore().previewMode) {
        return;
      }
      const commitHome = scope?.supplemental.beginHomeUpdate();
      const stock = await fetchStockWidget(this.stockSymbolsInput);
      if (commitHome?.({ stock })) this.stock = stock;
    },
    formatDateTime,
    formatMonthDay,
    formatDisplayStockCode,
    normalizeSymbols,
  },
});

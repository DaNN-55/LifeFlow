import { defineStore } from "pinia";

import { contentTabs, defaultWidgets } from "../app/constants";
import {
  loadCachedDailyRecord,
  loadCachedHomeData,
  saveCachedDailyRecords,
  saveCachedHomeData,
} from "../services/dashboard-cache";
import { fetchDailyRecord } from "../services/today-api";
import {
  createEmptyHomeState,
  createEmptyWeatherState,
  fetchFavoritesPreview,
  fetchFeaturedContent,
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

function buildFreshNewsKey(item = {}) {
  return String(item?.id || item?.canonical_url || item?.source_url || item?.title || "").trim();
}

function shuffleItems(items = []) {
  const pool = Array.isArray(items) ? items.slice() : [];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool;
}

function buildFreshNewsFeed(financeFeed = [], scienceFeed = [], limit = 5) {
  const merged = [...financeFeed, ...scienceFeed]
    .map((item) => ({
      ...item,
      channel: item?.channel || (scienceFeed.includes(item) ? "science" : "finance"),
    }))
    .filter((item) => buildFreshNewsKey(item));

  const deduped = [];
  const seen = new Set();
  merged.forEach((item) => {
    const key = buildFreshNewsKey(item);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(item);
  });

  return shuffleItems(deduped).slice(0, limit);
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
    async bootstrap() {
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        this.loaded = false;
        this.weather = createEmptyWeatherState();
        return;
      }

      const cachedHome = loadCachedHomeData(sessionStore.user.id);
      if (Array.isArray(cachedHome.financeFeed)) {
        this.financeFeed = cachedHome.financeFeed;
      }
      if (Array.isArray(cachedHome.scienceFeed)) {
        this.scienceFeed = cachedHome.scienceFeed;
      }
      if (Array.isArray(cachedHome.freshNewsFeed)) {
        this.freshNewsFeed = cachedHome.freshNewsFeed;
      } else {
        this.rebuildFreshNewsFeed(false);
      }
      if (cachedHome.favorites && typeof cachedHome.favorites === "object") {
        this.favorites = cachedHome.favorites;
      }
      if (cachedHome.github && typeof cachedHome.github === "object") {
        this.github = cachedHome.github;
      }
      if (cachedHome.weather && typeof cachedHome.weather === "object") {
        this.weather = {
          ...createEmptyWeatherState(),
          ...cachedHome.weather,
        };
      }
      if (cachedHome.stock && typeof cachedHome.stock === "object") {
        this.stock = cachedHome.stock;
      }
      const currentSessionId = loadSessionId();
      const lastSidebarRefreshSessionId = String(cachedHome.sidebarRefreshSessionId || "");
      const shouldAutoRefreshSidebar = Boolean(currentSessionId && currentSessionId !== lastSidebarRefreshSessionId);
      const shouldPrimeFreshNews = !shouldAutoRefreshSidebar && this.freshNewsFeed.length === 0;

      const jobs = [this.loadCalendar(this.calendarSelectedDate)];
      if (shouldAutoRefreshSidebar) {
        jobs.push(this.refreshSidebarAfterLogin(currentSessionId));
      } else if (shouldPrimeFreshNews) {
        jobs.push(this.refreshFeeds());
      }

      await Promise.allSettled(jobs);
      this.loaded = true;
    },
    async refreshSidebarAfterLogin(sessionId = loadSessionId()) {
      await Promise.allSettled([
        this.refreshFeeds(),
        this.refreshFavorites(),
        this.refreshGitHub(),
        this.refreshWeather(),
        this.refreshStocks(),
      ]);

      const sessionStore = useSessionStore();
      saveCachedHomeData(sessionStore.user?.id, {
        sidebarRefreshSessionId: String(sessionId || ""),
      });
    },
    async loadCalendar(dateString = this.calendarSelectedDate) {
      const sessionStore = useSessionStore();
      this.loadingCalendar = true;
      this.calendarSelectedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(dateString || "")) ? String(dateString) : getTodayDateString();
      const { dates, monthLabel } = createCalendarGrid(this.calendarSelectedDate);
      this.calendarLabel = monthLabel;

      const todayKey = getTodayDateString();
      const selectedMonth = parseLocalDate(this.calendarSelectedDate).getMonth();
      const selectedYear = parseLocalDate(this.calendarSelectedDate).getFullYear();
      const cachedRecords = dates.map((date) => {
        const key = formatDateKey(date);
        return loadCachedDailyRecord(sessionStore.user?.id, key);
      });
      const missingDates = dates.filter((_, index) => !cachedRecords[index]);
      if (missingDates.length) {
        const fetchedRecords = await Promise.all(
          missingDates.map(async (date) => {
            const key = formatDateKey(date);
            try {
              const payload = await fetchDailyRecord(key);
              return payload?.record || { date: key, payload: { tasks: {} } };
            } catch {
              return { date: key, payload: { tasks: {} } };
            }
          }),
        );
        saveCachedDailyRecords(sessionStore.user?.id, fetchedRecords);
      }

      const records = dates.map((date) => {
        const key = formatDateKey(date);
        return loadCachedDailyRecord(sessionStore.user?.id, key) || { date: key, payload: { tasks: {} } };
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
    async refreshFeeds() {
      const [finance, science] = await Promise.allSettled([
        this.refreshFeed("finance"),
        this.refreshFeed("science"),
      ]);
      if (finance.status === "rejected") {
        this.financeFeed = [];
      }
      if (science.status === "rejected") {
        this.scienceFeed = [];
      }
      this.rebuildFreshNewsFeed();
    },
    async refreshFeed(channel) {
      const targetChannel = channel === "science" ? "science" : "finance";
      const payload = await fetchFeaturedContent(targetChannel, 3).catch(() => ({ items: [] }));
      const items = Array.isArray(payload?.items)
        ? payload.items.map((item) => ({
            ...item,
            channel: item?.channel || targetChannel,
          }))
        : [];
      if (targetChannel === "science") {
        this.scienceFeed = items;
      } else {
        this.financeFeed = items;
      }
    },
    rebuildFreshNewsFeed(persist = true) {
      this.freshNewsFeed = buildFreshNewsFeed(this.financeFeed, this.scienceFeed);
      if (!persist) {
        return;
      }
      const sessionStore = useSessionStore();
      saveCachedHomeData(sessionStore.user?.id, {
        financeFeed: this.financeFeed,
        scienceFeed: this.scienceFeed,
        freshNewsFeed: this.freshNewsFeed,
      });
    },
    async refreshFavorites() {
      const items = await fetchFavoritesPreview(this.favoritesChannel).catch(() => []);
      this.favorites = {
        status: items.length ? "ready" : "empty",
        items,
        message: items.length ? "最近收藏资讯" : "当前还没有收藏资讯。",
      };
      const sessionStore = useSessionStore();
      saveCachedHomeData(sessionStore.user?.id, {
        favorites: this.favorites,
      });
    },
    async refreshGitHub() {
      this.github = await fetchGitHubPreview(this.githubProfileUrl).catch(() => ({
        status: "error",
        repos: [],
        url: this.githubProfileUrl,
        message: "GitHub 预览暂时不可用",
      }));
      const sessionStore = useSessionStore();
      saveCachedHomeData(sessionStore.user?.id, {
        github: this.github,
      });
    },
    async refreshWeather() {
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
      saveCachedHomeData(sessionStore.user?.id, {
        weather: this.weather,
      });
    },
    async refreshStocks() {
      this.stock = await fetchStockWidget(this.stockSymbolsInput);
      const sessionStore = useSessionStore();
      saveCachedHomeData(sessionStore.user?.id, {
        stock: this.stock,
      });
    },
    formatDateTime,
    formatMonthDay,
    formatDisplayStockCode,
    normalizeSymbols,
    contentTabs,
  },
});

import { defineStore } from "pinia";

import { contentTabs, defaultWidgets } from "../app/constants";
import {
  applyDashboardMutation,
  hasDashboardSnapshotData,
  loadDashboardSnapshot,
  syncDashboardSnapshot,
} from "../services/sync-service";
import {
  createEmptyHomeState,
  createEmptyWeatherState,
  fetchFavoritesPreview,
  fetchNewsPreviewFeed,
  fetchGitHubPreview,
  fetchStockWidget,
  fetchWeatherWidget,
  formatDisplayStockCode,
  normalizeSymbols,
} from "../services/home-api";
import { fetchContentSources, refreshContent } from "../services/content-api";
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

function getNewsTypeKey(item = {}) {
  const explicitType = String(item?.content_type || "").trim();
  if (explicitType) {
    return explicitType;
  }
  const firstTag = Array.isArray(item?.tags) ? String(item.tags[0] || "").trim() : "";
  return firstTag || "资讯";
}

function createChannelFeedMap() {
  return Object.fromEntries(contentTabs.map((tab) => [tab.id, []]));
}

function normalizeChannelFeedMap(value = {}) {
  const normalized = createChannelFeedMap();
  for (const tab of contentTabs) {
    normalized[tab.id] = Array.isArray(value?.[tab.id]) ? value[tab.id] : [];
  }
  return normalized;
}

function getNewsSortTime(item = {}) {
  return new Date(item?.published_at || item?.fetched_at || item?.created_at || 0).getTime();
}

function buildFreshNewsFeed(channelFeeds = {}, limit = 5) {
  const normalizedFeeds = normalizeChannelFeedMap(channelFeeds);
  const merged = contentTabs
    .flatMap((tab) =>
      normalizedFeeds[tab.id].map((item) => ({
        ...item,
        channel: item?.channel || tab.id,
      })),
    )
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

  const sorted = deduped.sort((left, right) => getNewsSortTime(right) - getNewsSortTime(left));
  const picked = [];
  const usedTypes = new Set();

  for (const item of sorted) {
    const typeKey = getNewsTypeKey(item);
    if (usedTypes.has(typeKey)) {
      continue;
    }
    usedTypes.add(typeKey);
    picked.push(item);
    if (picked.length >= limit) {
      return picked;
    }
  }

  for (const item of sorted) {
    if (picked.includes(item)) {
      continue;
    }
    picked.push(item);
    if (picked.length >= limit) {
      break;
    }
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
      const channelFeeds = normalizeChannelFeedMap(
        home.channelFeeds && typeof home.channelFeeds === "object"
          ? home.channelFeeds
          : {
              news: Array.isArray(home.freshNewsFeed)
                ? home.freshNewsFeed
                : Array.isArray(home.financeFeed)
                  ? home.financeFeed
                  : Array.isArray(home.scienceFeed)
                    ? home.scienceFeed
                    : [],
            },
      );
      this.channelFeeds = channelFeeds;
      this.financeFeed = [];
      this.scienceFeed = [];
      if (Array.isArray(home.freshNewsFeed)) {
        this.freshNewsFeed = home.freshNewsFeed;
      } else {
        this.rebuildFreshNewsFeed(false);
      }
      if (home.favorites && typeof home.favorites === "object") {
        this.favorites = home.favorites;
      }
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
      if (!sessionStore.user?.id) {
        this.loaded = false;
        this.weather = createEmptyWeatherState();
        return;
      }

      const cachedSnapshot = loadDashboardSnapshot(sessionStore.user.id);
      const cachedHome = cachedSnapshot?.home || {};
      this.applyCachedHome(cachedHome);
      const currentSessionId = loadSessionId();
      const lastSidebarRefreshSessionId = String(cachedHome.sidebarRefreshSessionId || "");
      const shouldAutoRefreshSidebar = Boolean(currentSessionId && currentSessionId !== lastSidebarRefreshSessionId);
      const shouldPrimeFreshNews = !shouldAutoRefreshSidebar && this.freshNewsFeed.length === 0;

      if (hasDashboardSnapshotData(cachedSnapshot)) {
        await this.loadCalendar(this.calendarSelectedDate, cachedSnapshot);
      }

      const remoteSnapshot = await syncDashboardSnapshot(sessionStore.user.id);
      this.applyCachedHome(remoteSnapshot?.home || {});

      const jobs = [this.loadCalendar(this.calendarSelectedDate, remoteSnapshot)];
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
    async refreshFeeds() {
      const results = await Promise.allSettled(contentTabs.map((tab) => this.refreshFeed(tab.id)));
      const nextChannelFeeds = normalizeChannelFeedMap(this.channelFeeds);
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          nextChannelFeeds[contentTabs[index].id] = [];
        }
      });
      this.channelFeeds = nextChannelFeeds;
      this.financeFeed = [];
      this.scienceFeed = [];
      if (results.every((result) => result.status === "rejected")) {
        this.freshNewsFeed = [];
        const sessionStore = useSessionStore();
        applyDashboardMutation(sessionStore.user?.id, {
          channelFeeds: this.channelFeeds,
          financeFeed: this.financeFeed,
          scienceFeed: this.scienceFeed,
          freshNewsFeed: this.freshNewsFeed,
        });
        return;
      }
      this.rebuildFreshNewsFeed();
    },
    async refreshFeed(channel) {
      const targetChannel = contentTabs.some((tab) => tab.id === channel) ? channel : (contentTabs[0]?.id || "news");
      const sourcePayload = await fetchContentSources(targetChannel).catch(() => ({ sources: [] }));
      const enabledSources = Array.isArray(sourcePayload?.sources)
        ? sourcePayload.sources.filter((source) => source?.enabled !== false)
        : [];
      if (!enabledSources.length) {
        this.channelFeeds = {
          ...normalizeChannelFeedMap(this.channelFeeds),
          [targetChannel]: [],
        };
        this.financeFeed = [];
        this.scienceFeed = [];
        return [];
      }

      await refreshContent(targetChannel, 18).catch(() => null);
      const previewItems = await fetchNewsPreviewFeed(targetChannel, 12).catch(() => []);
      const items = Array.isArray(previewItems)
        ? previewItems.map((item) => ({
            ...item,
            channel: item?.channel || targetChannel,
          }))
        : [];
      this.channelFeeds = {
        ...normalizeChannelFeedMap(this.channelFeeds),
        [targetChannel]: items,
      };
      this.financeFeed = [];
      this.scienceFeed = [];
      return items;
    },
    rebuildFreshNewsFeed(persist = true) {
      this.freshNewsFeed = buildFreshNewsFeed(this.channelFeeds);
      if (!persist) {
        return;
      }
      const sessionStore = useSessionStore();
      applyDashboardMutation(sessionStore.user?.id, {
        channelFeeds: this.channelFeeds,
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
      applyDashboardMutation(sessionStore.user?.id, {
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
      applyDashboardMutation(sessionStore.user?.id, {
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
      applyDashboardMutation(sessionStore.user?.id, {
        weather: this.weather,
      });
    },
    async refreshStocks() {
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
    contentTabs,
  },
});

import { defineStore } from "pinia";

import { contentTabs, LOCAL_CONTENT_CACHE_STORAGE_KEY } from "../app/constants";
import {
  addContentFavorite,
  createContentSource,
  deleteContentSource,
  fetchContentList,
  fetchContentSources,
  refreshContent,
  removeContentFavorite,
  updateContentSource,
} from "../services/content-api";
import { saveAccountPreferences } from "../services/today-api";
import { formatDateTime } from "../utils/date";
import { getUserFacingErrorMessage } from "../utils/error-message";
import {
  buildMockContent,
  deriveMockSourcesFromItems,
  getMockContentPayloadFromItems,
} from "../utils/content-mocks";
import { getContentMetaText } from "../utils/content";
import { useHomeStore } from "./home";
import { useSessionStore } from "./session";

function createDefaultChannelView(view = {}) {
  return {
    page: Math.max(1, Number(view?.page || 1)),
    search: String(view?.search || ""),
    tag: String(view?.tag || "all"),
    sourceId: String(view?.sourceId || "all"),
    favoriteFilter: String(view?.favoriteFilter || "all"),
    sort: String(view?.sort || "latest"),
  };
}

function createInitialChannelState(channel, initialView = {}) {
  const view = createDefaultChannelView(initialView);
  return {
    channel,
    items: [],
    tags: [],
    sources: [],
    page: view.page,
    total: 0,
    pageSize: 10,
    search: view.search,
    tag: view.tag,
    sourceId: view.sourceId,
    favoriteFilter: view.favoriteFilter,
    sort: view.sort,
    loading: false,
    refreshing: false,
    loaded: false,
    lastRefreshedAt: "",
    lastRefreshStats: null,
    error: "",
    mode: "remote",
  };
}

function normalizeSource(source = {}) {
  return {
    ...source,
    id: String(source.id || ""),
    linkedSourceIds: Array.isArray(source.linkedSourceIds)
      ? [...new Set(source.linkedSourceIds.map((item) => String(item || "").trim()).filter(Boolean))]
      : source.id
        ? [String(source.id)]
        : [],
    channel: String(source.channel || ""),
    name: String(source.name || "未命名信源"),
    url: String(source.url || ""),
    type: String(source.type || "rss"),
    parser_key: String(source.parser_key || ""),
    enabled: typeof source.enabled === "boolean" ? source.enabled : true,
  };
}

function getSourceIdentity(source = {}) {
  return [
    String(source.channel || "").trim().toLowerCase(),
    String(source.type || "").trim().toLowerCase(),
    String(source.url || "").trim().toLowerCase(),
    String(source.parser_key || source.parserKey || "").trim().toLowerCase(),
  ].join("::");
}

function normalizeSourceList(sources = []) {
  const merged = new Map();
  for (const rawSource of Array.isArray(sources) ? sources : []) {
    const source = normalizeSource(rawSource);
    const key = getSourceIdentity(source);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, source);
      continue;
    }
    existing.linkedSourceIds = [
      ...new Set([...(existing.linkedSourceIds || []), ...(source.linkedSourceIds || []), source.id].filter(Boolean)),
    ];
    if (!existing.id && source.id) {
      existing.id = source.id;
    }
  }
  return [...merged.values()];
}

function normalizeContentPreferences(content = {}) {
  return {
    ...(content || {}),
    readItems: {
      ...(content?.readItems || {}),
    },
    hiddenSources: {
      ...(content?.hiddenSources || {}),
    },
  };
}

function createInitialLocalContentCache() {
  return {
    channels: {},
    views: {},
    readItems: {},
    hiddenSources: {},
    favoriteItems: {},
  };
}

function createLocalRefreshStats(totalSources, refreshedAt) {
  return {
    totalSources,
    successCount: totalSources,
    failureCount: 0,
    failures: [],
    refreshedAt,
  };
}

function getItemKey(item = {}) {
  return String(item?.canonical_url || item?.id || "").trim();
}

function getChannelItemKeys(items = []) {
  return new Set(items.map((item) => getItemKey(item)).filter(Boolean));
}

function normalizeLocalContentCache(cache = {}) {
  const normalized = createInitialLocalContentCache();
  normalized.readItems = cache?.readItems && typeof cache.readItems === "object" ? { ...cache.readItems } : {};
  normalized.hiddenSources = cache?.hiddenSources && typeof cache.hiddenSources === "object" ? { ...cache.hiddenSources } : {};
  normalized.favoriteItems = cache?.favoriteItems && typeof cache.favoriteItems === "object" ? { ...cache.favoriteItems } : {};
  normalized.views = Object.fromEntries(
    contentTabs.map((tab) => [tab.id, createDefaultChannelView(cache?.views?.[tab.id] || {})]),
  );
  normalized.channels = Object.fromEntries(
    contentTabs.map((tab) => [
      tab.id,
      createLocalChannelData(tab.id, normalized.favoriteItems, cache?.channels?.[tab.id] || {}),
    ]),
  );
  return normalized;
}

function loadLocalContentCache() {
  try {
    const raw = localStorage.getItem(LOCAL_CONTENT_CACHE_STORAGE_KEY);
    if (!raw) {
      return normalizeLocalContentCache();
    }
    return normalizeLocalContentCache(JSON.parse(raw));
  } catch {
    return normalizeLocalContentCache();
  }
}

function createLocalChannelData(channel, favoriteItems = {}, existing = {}) {
  const sources = Array.isArray(existing?.sources) && existing.sources.length
    ? existing.sources.map((source) => normalizeSource(source))
    : Array.isArray(existing?.items) && existing.items.length
      ? deriveMockSourcesFromItems(channel, existing.items).map((source) => normalizeSource(source))
      : [];
  return {
    items: Array.isArray(existing?.items) && existing.items.length
      ? existing.items
      : buildMockContent(channel, favoriteItems, sources),
    sources,
    lastRefreshedAt: String(existing?.lastRefreshedAt || ""),
  };
}

function downloadJsonPayload(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const useContentStore = defineStore("content", {
  state: () => {
    const localCache = loadLocalContentCache();
    return {
      channels: Object.fromEntries(
        contentTabs.map((tab) => [tab.id, createInitialChannelState(tab.id, localCache.views?.[tab.id] || {})]),
      ),
      sourceModalChannel: "",
      sourceEditingId: "",
      sourceForm: {
        id: "",
        name: "",
        type: "rss",
        url: "",
        parserKey: "",
        enabled: true,
      },
      sourceFeedback: null,
      localModeFeedback: null,
      localCache,
    };
  },
  getters: {
    hiddenSources() {
      const sessionStore = useSessionStore();
      return sessionStore.user?.preferences?.content?.hiddenSources || this.localCache.hiddenSources || {};
    },
    readItems() {
      const sessionStore = useSessionStore();
      return sessionStore.user?.preferences?.content?.readItems || this.localCache.readItems || {};
    },
    currentSourceFailures(state) {
      return state.sourceModalChannel ? state.channels[state.sourceModalChannel]?.lastRefreshStats?.failures || [] : [];
    },
  },
  actions: {
    getChannelState(channel) {
      return this.channels[channel];
    },
    isItemRead(item) {
      const key = String(item?.canonical_url || item?.id || "").trim();
      return Boolean(key && this.readItems[key]);
    },
    isSourceHidden(channel, sourceId) {
      return Boolean(sourceId && this.hiddenSources[`${channel}:${sourceId}`]);
    },
    getVisibleSources(channel) {
      return (this.channels[channel]?.sources || []).filter((source) => !this.isSourceHidden(channel, source.id));
    },
    getHiddenSources(channel) {
      return (this.channels[channel]?.sources || []).filter((source) => this.isSourceHidden(channel, source.id));
    },
    setSourceForm(form) {
      this.sourceForm = {
        ...this.sourceForm,
        ...form,
      };
    },
    setSourceFeedback(message, tone = "default") {
      this.sourceFeedback = message
        ? {
            id: `content-source-feedback-${Date.now()}`,
            message,
            tone,
          }
        : null;
    },
    setLocalModeFeedback(message, tone = "default") {
      this.localModeFeedback = message
        ? {
            id: `content-local-feedback-${Date.now()}`,
            message,
            tone,
          }
        : null;
    },
    async syncHomeFreshNews(channel) {
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        return;
      }
      const homeStore = useHomeStore();
      try {
        await homeStore.refreshFeed(channel);
        homeStore.rebuildFreshNewsFeed();
      } catch {
        // Keep Content interactions responsive even if the sidebar preview refresh fails.
      }
    },
    persistLocalCache() {
      try {
        localStorage.setItem(LOCAL_CONTENT_CACHE_STORAGE_KEY, JSON.stringify(this.localCache));
      } catch {
        // Best-effort local mode cache for unauthenticated testing.
      }
    },
    ensureLocalChannelCache(channel) {
      const localChannel = createLocalChannelData(channel, this.localCache.favoriteItems, this.localCache.channels[channel] || {});
      if (!localChannel.lastRefreshedAt) {
        localChannel.lastRefreshedAt = new Date().toISOString();
      }
      this.localCache.channels[channel] = localChannel;
      this.persistLocalCache();
      return localChannel;
    },
    syncLocalViewsToStates() {
      for (const tab of contentTabs) {
        const view = createDefaultChannelView(this.localCache.views?.[tab.id] || {});
        Object.assign(this.channels[tab.id], view);
      }
    },
    saveChannelView(channel) {
      const channelState = this.channels[channel];
      if (!channelState) {
        return;
      }
      this.localCache.views[channel] = createDefaultChannelView(channelState);
      this.persistLocalCache();
    },
    async resetLocalChannelCache(channel) {
      const refreshedAt = new Date().toISOString();
      const sources = [];
      this.localCache.channels[channel] = {
        items: buildMockContent(channel, this.localCache.favoriteItems, sources),
        sources,
        lastRefreshedAt: refreshedAt,
      };
      this.persistLocalCache();
      await this.loadChannel(channel, {
        page: 1,
        search: "",
        tag: "all",
        sourceId: "all",
        favoriteFilter: "all",
        sort: "latest",
      });
    },
    async clearLocalChannelMarks(channel) {
      const localChannel = this.ensureLocalChannelCache(channel);
      const itemKeys = getChannelItemKeys(localChannel.items);
      for (const key of itemKeys) {
        delete this.localCache.favoriteItems[key];
        delete this.localCache.readItems[key];
      }
      localChannel.items = localChannel.items.map((item) => ({
        ...item,
        is_favorite: false,
      }));
      this.localCache.channels[channel] = localChannel;
      this.persistLocalCache();
      await this.loadChannel(channel, {
        page: 1,
        favoriteFilter: "all",
      });
    },
    async markCurrentPageAsRead(channel) {
      const channelState = this.channels[channel];
      if (!channelState?.items?.length) {
        return;
      }
      const sessionStore = useSessionStore();
      const keys = channelState.items.map((item) => getItemKey(item)).filter(Boolean);
      if (!keys.length) {
        return;
      }

      if (!sessionStore.user?.id) {
        const timestamp = new Date().toISOString();
        keys.forEach((key) => {
          this.localCache.readItems[key] = timestamp;
        });
        this.persistLocalCache();
        if (channelState.favoriteFilter === "unread" || channelState.favoriteFilter === "read") {
          await this.loadChannel(channel);
        }
        return;
      }

      await this.persistContentPreferences((preferences) => {
        keys.forEach((key) => {
          preferences.content.readItems[key] = new Date().toISOString();
        });
      });
      if (channelState.favoriteFilter === "unread" || channelState.favoriteFilter === "read") {
        await this.loadChannel(channel);
      }
    },
    exportLocalCache() {
      downloadJsonPayload(`lifeflow-local-content-cache-${new Date().toISOString().slice(0, 10)}.json`, {
        exportedAt: new Date().toISOString(),
        localCache: this.localCache,
      });
      this.setLocalModeFeedback("本地缓存已导出", "success");
    },
    async importLocalCache(file, activeChannel = "") {
      if (!(file instanceof File)) {
        this.setLocalModeFeedback("请选择要导入的本地缓存文件。", "error");
        return;
      }
      try {
        const raw = JSON.parse(await file.text());
        this.localCache = normalizeLocalContentCache(raw?.localCache || raw);
        this.persistLocalCache();
        this.syncLocalViewsToStates();
        const channelToReload = contentTabs.some((tab) => tab.id === activeChannel)
          ? activeChannel
          : contentTabs[0]?.id || "";
        if (channelToReload) {
          await this.loadChannel(channelToReload);
        }
        this.setLocalModeFeedback("本地缓存已导入", "success");
      } catch (error) {
        this.setLocalModeFeedback(getUserFacingErrorMessage(error, "导入本地缓存失败"), "error");
      }
    },
    resetSourceForm() {
      this.sourceForm = {
        id: "",
        name: "",
        type: "rss",
        url: "",
        parserKey: "",
        enabled: true,
      };
    },
    async persistContentPreferences(mutator) {
      const sessionStore = useSessionStore();
      if (!sessionStore.user) {
        return;
      }
      const current = sessionStore.user.preferences || {};
      const nextPreferences = {
        ...current,
        content: normalizeContentPreferences(current.content || {}),
      };
      mutator(nextPreferences);
      const response = await saveAccountPreferences(nextPreferences);
      sessionStore.setPreferences(response?.preferences || nextPreferences);
    },
    async loadChannel(channel, overrides = {}) {
      const sessionStore = useSessionStore();
      const contentState = this.channels[channel];
      if (!contentState) {
        return;
      }

      Object.assign(contentState, overrides);
      this.saveChannelView(channel);
      contentState.loading = true;
      contentState.error = "";

      try {
        if (!sessionStore.user?.id) {
          const localChannel = this.ensureLocalChannelCache(channel);
          const payload = getMockContentPayloadFromItems(localChannel.items, contentState);
          contentState.items = payload.items;
          contentState.total = Number(payload.total || 0);
          contentState.tags = Array.isArray(payload.tags) ? payload.tags : [];
          contentState.sources = Array.isArray(localChannel.sources) ? localChannel.sources.map(normalizeSource) : [];
          contentState.lastRefreshedAt = localChannel.lastRefreshedAt || new Date().toISOString();
          contentState.lastRefreshStats = createLocalRefreshStats(contentState.sources.length, contentState.lastRefreshedAt);
          contentState.loaded = true;
          contentState.mode = "local";
          return;
        }

        const usesRemoteFavoriteFilter = contentState.favoriteFilter === "favorites";
        const requestedPageSize = usesRemoteFavoriteFilter
          ? Math.max(1, Math.min(Number(contentState.pageSize) || 10, 40))
          : 40;

        const payload = await fetchContentList({
          channel,
          page: usesRemoteFavoriteFilter ? contentState.page : 1,
          pageSize: requestedPageSize,
          sort: contentState.sort,
          q: contentState.search || "",
          tag: contentState.tag !== "all" ? contentState.tag : "",
          sourceId: contentState.sourceId !== "all" ? contentState.sourceId : "",
          favorite: usesRemoteFavoriteFilter ? contentState.favoriteFilter : "",
        });

        const remoteItems = Array.isArray(payload?.items) ? payload.items : [];
        const filteredItems = usesRemoteFavoriteFilter
          ? remoteItems
          : remoteItems.filter((item) => {
              if (this.isSourceHidden(channel, item.source_id || "")) {
                return false;
              }
              if (contentState.favoriteFilter === "read" && !this.isItemRead(item)) {
                return false;
              }
              if (contentState.favoriteFilter === "unread" && this.isItemRead(item)) {
                return false;
              }
              return true;
            });

        const total = usesRemoteFavoriteFilter ? Number(payload?.total || 0) : filteredItems.length;
        const maxPage = Math.max(1, Math.ceil(total / contentState.pageSize));
        contentState.page = Math.min(Math.max(1, Number(contentState.page || 1)), maxPage);
        const startIndex = (contentState.page - 1) * contentState.pageSize;
        contentState.items = usesRemoteFavoriteFilter
          ? filteredItems
          : filteredItems.slice(startIndex, startIndex + contentState.pageSize);
        contentState.total = total;
        contentState.tags = Array.isArray(payload?.tags) ? payload.tags : [];
        contentState.sources = normalizeSourceList(payload?.sources || []);
        contentState.lastRefreshedAt = payload?.cache?.refreshedAt || contentState.lastRefreshedAt || "";
        contentState.lastRefreshStats = payload?.cache?.lastRefreshStats || contentState.lastRefreshStats || null;
        contentState.loaded = true;
        contentState.mode = "remote";
      } catch (error) {
        contentState.error = getUserFacingErrorMessage(error, "资讯加载失败");
      } finally {
        contentState.loading = false;
        this.saveChannelView(channel);
      }
    },
    async refreshChannel(channel) {
      const contentState = this.channels[channel];
      if (!contentState || contentState.refreshing) {
        return;
      }
      const sessionStore = useSessionStore();
      contentState.refreshing = true;
      contentState.error = "";
      try {
        if (!sessionStore.user?.id) {
          const refreshedAt = new Date().toISOString();
          const localChannel = this.ensureLocalChannelCache(channel);
          this.localCache.channels[channel] = {
            items: buildMockContent(channel, this.localCache.favoriteItems, localChannel.sources),
            sources: localChannel.sources,
            lastRefreshedAt: refreshedAt,
          };
          this.persistLocalCache();
          contentState.lastRefreshedAt = refreshedAt;
          contentState.lastRefreshStats = createLocalRefreshStats(
            this.localCache.channels[channel].items.length,
            refreshedAt,
          );
          await this.loadChannel(channel);
          return;
        }
        const payload = await refreshContent(channel, 30);
        contentState.lastRefreshedAt = payload?.cache?.refreshedAt || payload?.refresh?.refreshedAt || "";
        contentState.lastRefreshStats = payload?.refresh || payload?.cache?.lastRefreshStats || null;
        await this.loadChannel(channel);
        await this.syncHomeFreshNews(channel);
      } catch (error) {
        contentState.error = getUserFacingErrorMessage(error, "资讯刷新失败");
      } finally {
        contentState.refreshing = false;
      }
    },
    async toggleFavorite(item) {
      if (!item?.id) {
        return;
      }
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        const key = getItemKey(item);
        if (!key) {
          return;
        }
        const channelState = this.channels[item.channel];
        if (this.localCache.favoriteItems[key]) {
          delete this.localCache.favoriteItems[key];
          item.is_favorite = false;
        } else {
          this.localCache.favoriteItems[key] = new Date().toISOString();
          item.is_favorite = true;
        }
        for (const channelState of Object.values(this.localCache.channels)) {
          if (!Array.isArray(channelState.items)) {
            continue;
          }
          channelState.items = channelState.items.map((entry) =>
            getItemKey(entry) === key ? { ...entry, is_favorite: Boolean(this.localCache.favoriteItems[key]) } : entry,
          );
        }
        this.persistLocalCache();
        if (channelState?.favoriteFilter === "favorites") {
          await this.loadChannel(item.channel);
        }
        return;
      }
      try {
        const channelState = this.channels[item.channel];
        if (item.is_favorite) {
          await removeContentFavorite(item.channel, item.canonical_url);
          item.is_favorite = false;
        } else {
          await addContentFavorite({
            id: item.id,
            channel: item.channel,
            source_id: item.source_id || "",
            title: item.title,
            summary_zh: item.summary_zh || "",
            summary_raw: item.summary_raw || "",
            body_zh: item.body_zh || "",
            body_raw: item.body_raw || "",
            author: item.author || "",
            published_at: item.published_at || item.fetched_at || "",
            content_type: item.content_type || "article",
            source_name: item.source_name || "",
            source_url: item.source_url || "",
            canonical_url: item.canonical_url || item.source_url || "",
            tags: Array.isArray(item.tags) ? item.tags : [],
            lang: item.lang || "",
            image_url: item.image_url || "",
          });
          item.is_favorite = true;
        }
        if (channelState?.favoriteFilter === "favorites") {
          await this.loadChannel(item.channel);
        }
      } catch (error) {
        const channelState = this.channels[item.channel];
        if (channelState) {
          channelState.error = getUserFacingErrorMessage(error, "收藏操作失败");
        }
      }
    },
    async markAsRead(item) {
      const key = String(item?.canonical_url || item?.id || "").trim();
      if (!key) {
        return;
      }
      const sessionStore = useSessionStore();
      const timestamp = new Date().toISOString();
      if (!sessionStore.user?.id) {
        this.localCache.readItems[key] = timestamp;
        this.persistLocalCache();
        if (this.channels[item.channel]?.favoriteFilter === "read" || this.channels[item.channel]?.favoriteFilter === "unread") {
          await this.loadChannel(item.channel);
        }
        return;
      }

      const currentPreferences = sessionStore.user.preferences || {};
      const nextPreferences = {
        ...currentPreferences,
        content: normalizeContentPreferences(currentPreferences.content || {}),
      };
      nextPreferences.content.readItems[key] = timestamp;
      sessionStore.setPreferences(nextPreferences);

      try {
        const response = await saveAccountPreferences(nextPreferences);
        sessionStore.setPreferences(response?.preferences || nextPreferences);
      } catch (error) {
        throw error;
      }

      if (this.channels[item.channel]?.favoriteFilter === "read" || this.channels[item.channel]?.favoriteFilter === "unread") {
        await this.loadChannel(item.channel);
      }
    },
    async toggleReadStatus(item) {
      const key = getItemKey(item);
      if (!key) {
        return;
      }
      const sessionStore = useSessionStore();
      const channelState = this.channels[item.channel];
      const isRead = this.isItemRead(item);

      if (!sessionStore.user?.id) {
        if (isRead) {
          delete this.localCache.readItems[key];
        } else {
          this.localCache.readItems[key] = new Date().toISOString();
        }
        this.persistLocalCache();
        if (channelState?.favoriteFilter === "read" || channelState?.favoriteFilter === "unread") {
          await this.loadChannel(item.channel);
        }
        return;
      }

      await this.persistContentPreferences((preferences) => {
        if (isRead) {
          delete preferences.content.readItems[key];
        } else {
          preferences.content.readItems[key] = new Date().toISOString();
        }
      });
      if (channelState?.favoriteFilter === "read" || channelState?.favoriteFilter === "unread") {
        await this.loadChannel(item.channel);
      }
    },
    async openSourceModal(channel) {
      const sessionStore = useSessionStore();
      this.sourceModalChannel = channel;
      this.sourceEditingId = "";
      this.setSourceFeedback("");
      this.resetSourceForm();
      if (!sessionStore.user?.id) {
        const localChannel = this.ensureLocalChannelCache(channel);
        this.channels[channel].sources = Array.isArray(localChannel.sources) ? localChannel.sources.map(normalizeSource) : [];
        return;
      }
      try {
        const payload = await fetchContentSources(channel);
        this.channels[channel].sources = normalizeSourceList(payload?.sources || []);
      } catch (error) {
        this.channels[channel].error = getUserFacingErrorMessage(error, "信源加载失败");
        this.setSourceFeedback(getUserFacingErrorMessage(error, "信源加载失败"), "error");
      }
    },
    closeSourceModal() {
      this.sourceModalChannel = "";
      this.sourceEditingId = "";
      this.setSourceFeedback("");
      this.resetSourceForm();
    },
    startEditSource(sourceId) {
      const channel = this.sourceModalChannel;
      const source = this.channels[channel]?.sources?.find((item) => item.id === sourceId);
      if (!source) {
        return;
      }
      this.sourceEditingId = sourceId;
      this.sourceForm = {
        id: source.id,
        name: source.name,
        type: source.type,
        url: source.url,
        parserKey: source.parser_key || "",
        enabled: source.enabled,
      };
    },
    async saveSource() {
      const channel = this.sourceModalChannel;
      const sessionStore = useSessionStore();
      if (!channel) {
        return;
      }
      const payload = {
        channel,
        name: this.sourceForm.name.trim(),
        type: this.sourceForm.type,
        url: this.sourceForm.url.trim(),
        parserKey: this.sourceForm.parserKey.trim(),
        enabled: Boolean(this.sourceForm.enabled),
      };
      if (!payload.name || !payload.url) {
        this.setSourceFeedback("请先填写完整的名称和链接。", "error");
        return;
      }

      try {
        if (!sessionStore.user?.id) {
          const localChannel = this.ensureLocalChannelCache(channel);
          const nextSource = normalizeSource({
            id: this.sourceEditingId || `local-source-${channel}-${Date.now()}`,
            name: payload.name,
            type: payload.type,
            url: payload.url,
            parser_key: payload.parserKey,
            enabled: payload.enabled,
          });
          const nextSources = this.sourceEditingId
            ? localChannel.sources.map((source) => (source.id === this.sourceEditingId ? { ...source, ...nextSource } : source))
            : [...localChannel.sources, nextSource];
          this.localCache.channels[channel] = {
            ...localChannel,
            sources: nextSources,
            items: buildMockContent(channel, this.localCache.favoriteItems, nextSources),
            lastRefreshedAt: new Date().toISOString(),
          };
          this.persistLocalCache();
          this.channels[channel].sources = nextSources.map(normalizeSource);
          this.sourceEditingId = "";
          this.resetSourceForm();
          this.setSourceFeedback("本地信源已保存", "success");
          await this.loadChannel(channel, { page: 1, sourceId: "all" });
          return;
        }
        if (this.sourceEditingId) {
          await updateContentSource(this.sourceEditingId, payload);
        } else {
          await createContentSource(payload);
        }
        const response = await fetchContentSources(channel);
        this.channels[channel].sources = normalizeSourceList(response?.sources || []);
        this.sourceEditingId = "";
        this.resetSourceForm();
        this.setSourceFeedback("信源已保存", "success");
        await this.refreshChannel(channel);
      } catch (error) {
        this.channels[channel].error = getUserFacingErrorMessage(error, "保存信源失败");
        this.setSourceFeedback(getUserFacingErrorMessage(error, "保存信源失败"), "error");
      }
    },
    async deleteSource(sourceId) {
      const channel = this.sourceModalChannel;
      const sessionStore = useSessionStore();
      try {
        if (!sessionStore.user?.id) {
          const localChannel = this.ensureLocalChannelCache(channel);
          const nextSources = localChannel.sources.filter((source) => source.id !== sourceId);
          this.localCache.channels[channel] = {
            ...localChannel,
            sources: nextSources,
            items: buildMockContent(channel, this.localCache.favoriteItems, nextSources),
            lastRefreshedAt: new Date().toISOString(),
          };
          delete this.localCache.hiddenSources[`${channel}:${sourceId}`];
          this.persistLocalCache();
          this.channels[channel].sources = nextSources.map(normalizeSource);
          if (this.sourceEditingId === sourceId) {
            this.sourceEditingId = "";
            this.resetSourceForm();
          }
          this.setSourceFeedback("本地信源已删除", "success");
          await this.loadChannel(channel, { page: 1, sourceId: "all" });
          return;
        }
        const targetSource = (this.channels[channel]?.sources || []).find((source) => source.id === sourceId);
        const sourceIdsToDelete = targetSource?.linkedSourceIds?.length
          ? targetSource.linkedSourceIds
          : [sourceId];
        await Promise.all(sourceIdsToDelete.map((id) => deleteContentSource(id)));
        const nextSources = (this.channels[channel]?.sources || []).filter((source) => !sourceIdsToDelete.includes(source.id));
        this.channels[channel].sources = nextSources.map(normalizeSource);
        if (this.sourceEditingId === sourceId) {
          this.sourceEditingId = "";
          this.resetSourceForm();
        }
        const nextOverrides = {
          page: 1,
          sourceId: this.channels[channel]?.sourceId === sourceId ? "all" : this.channels[channel]?.sourceId || "all",
        };
        this.setSourceFeedback("信源已删除，正在后台刷新资讯...", "success");
        Promise.allSettled([
          this.loadChannel(channel, nextOverrides),
          this.syncHomeFreshNews(channel),
        ]).then(([contentResult, homeResult]) => {
          if (contentResult.status === "rejected") {
            this.channels[channel].error = getUserFacingErrorMessage(contentResult.reason, "资讯刷新失败");
          }
          if (homeResult.status === "rejected" && !this.channels[channel].error) {
            this.channels[channel].error = getUserFacingErrorMessage(homeResult.reason, "News 预览刷新失败");
          }
          this.setSourceFeedback("信源已删除", "success");
        });
      } catch (error) {
        this.channels[channel].error = getUserFacingErrorMessage(error, "删除信源失败");
        this.setSourceFeedback(getUserFacingErrorMessage(error, "删除信源失败"), "error");
      }
    },
    async hideSource(sourceId) {
      const channel = this.sourceModalChannel;
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        this.localCache.hiddenSources[`${channel}:${sourceId}`] = true;
        this.persistLocalCache();
        this.channels[channel].sources = this.ensureLocalChannelCache(channel).sources.map(normalizeSource);
        await this.loadChannel(channel);
        this.setSourceFeedback("该来源已隐藏", "success");
        return;
      }
      await this.persistContentPreferences((preferences) => {
        preferences.content = normalizeContentPreferences(preferences.content || {});
        preferences.content.hiddenSources[`${channel}:${sourceId}`] = true;
      });
      await this.loadChannel(channel);
      const response = await fetchContentSources(channel);
      this.channels[channel].sources = normalizeSourceList(response?.sources || []);
      this.setSourceFeedback("该来源已隐藏", "success");
    },
    async unhideSource(sourceId) {
      const channel = this.sourceModalChannel;
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        delete this.localCache.hiddenSources[`${channel}:${sourceId}`];
        this.persistLocalCache();
        this.channels[channel].sources = this.ensureLocalChannelCache(channel).sources.map(normalizeSource);
        await this.loadChannel(channel);
        this.setSourceFeedback("该来源已恢复显示", "success");
        return;
      }
      await this.persistContentPreferences((preferences) => {
        preferences.content = normalizeContentPreferences(preferences.content || {});
        delete preferences.content.hiddenSources[`${channel}:${sourceId}`];
      });
      await this.loadChannel(channel);
      const response = await fetchContentSources(channel);
      this.channels[channel].sources = normalizeSourceList(response?.sources || []);
      this.setSourceFeedback("该来源已恢复显示", "success");
    },
    async toggleSourceEnabled(sourceId) {
      const channel = this.sourceModalChannel;
      const sessionStore = useSessionStore();
      const source = this.channels[channel]?.sources?.find((item) => item.id === sourceId);
      if (!channel || !source) {
        return;
      }
      try {
        if (!sessionStore.user?.id) {
          const localChannel = this.ensureLocalChannelCache(channel);
          const nextSources = localChannel.sources.map((item) =>
            item.id === sourceId ? { ...item, enabled: !item.enabled } : item,
          );
          this.localCache.channels[channel] = {
            ...localChannel,
            sources: nextSources,
            items: buildMockContent(channel, this.localCache.favoriteItems, nextSources),
            lastRefreshedAt: new Date().toISOString(),
          };
          this.persistLocalCache();
          this.channels[channel].sources = nextSources.map(normalizeSource);
          this.setSourceFeedback(source.enabled ? "本地来源已停用" : "本地来源已启用", "success");
          await this.loadChannel(channel, { page: 1, sourceId: "all" });
          return;
        }
        await updateContentSource(sourceId, { enabled: !source.enabled });
        const response = await fetchContentSources(channel);
        this.channels[channel].sources = normalizeSourceList(response?.sources || []);
        this.setSourceFeedback(source.enabled ? "来源已停用" : "来源已启用", "success");
        await this.refreshChannel(channel);
      } catch (error) {
        this.channels[channel].error = getUserFacingErrorMessage(error, "更新来源状态失败");
        this.setSourceFeedback(getUserFacingErrorMessage(error, "更新来源状态失败"), "error");
      }
    },
    getMetaText(channel) {
      return getContentMetaText(this.channels[channel]);
    },
    getPublishedAt(item) {
      return formatDateTime(item.published_at || item.fetched_at);
    },
  },
});

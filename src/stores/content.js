import { defineStore } from "pinia";

import { attachInformationInput } from "../services/information-input.js";
import { alphaAnalytics } from "../services/alpha-analytics.js";
import { stateContinuity } from "../services/state-continuity.js";
import { getUserFacingErrorMessage } from "../utils/error-message";
import { formatDateTime } from "../utils/date";
import { useSessionStore } from "./session";

let inputScope = null;
let activeInput = null;

function createChannelState() {
  return {
    refreshing: false,
    error: "",
    lastRefreshStats: null,
  };
}

function createSourceForm() {
  return { id: "", name: "", type: "rss", url: "", parserKey: "", enabled: true };
}

export const useContentStore = defineStore("content", {
  state: () => ({
    channels: { news: createChannelState() },
    sourceModalChannel: "",
    sourceEditingId: "",
    sourceForm: createSourceForm(),
    sourceFeedback: null,
  }),
  getters: {
    currentSourceFailures(state) {
      return state.sourceModalChannel ? state.channels[state.sourceModalChannel]?.lastRefreshStats?.failures || [] : [];
    },
  },
  actions: {
    input() {
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id && !sessionStore.previewMode) {
        inputScope = null;
        activeInput = null;
        return null;
      }
      const scope = stateContinuity.open(
        sessionStore.previewMode
          ? { mode: "demo" }
          : { id: sessionStore.user.id },
      );
      if (scope !== inputScope) {
        inputScope = scope;
        activeInput = attachInformationInput(scope);
      }
      return activeInput;
    },
    getChannelState(channel) {
      const state = this.channels[channel] || createChannelState();
      const input = this.input();
      const projection = input?.news().projection;
      return {
        ...(projection || {
          items: [], sources: [], hiddenSources: [], tags: [], page: 1, pageSize: 10, total: 0,
          freshness: "empty", activity: "idle", issue: null, mode: "remote",
        }),
        loading: false,
        refreshing: state.refreshing,
        error: state.error,
        lastRefreshStats: state.lastRefreshStats,
      };
    },
    getVisibleSources(channel) {
      return this.getChannelState(channel).sources || [];
    },
    getHiddenSources(channel) {
      return this.getChannelState(channel).hiddenSources || [];
    },
    isItemRead(item) {
      return Boolean(item?.is_read);
    },
    getPublishedAt(item) {
      return formatDateTime(item?.published_at || item?.fetched_at || item?.created_at || "");
    },
    getMetaText(channel) {
      const state = this.getChannelState(channel);
      if (state.refreshing) return "正在刷新资讯…";
      if (state.issue === "offline") return "当前离线，显示最近一次确认资讯";
      if (state.mode === "demo") return "安全 Demo 合成资讯";
      return state.total ? `共 ${state.total} 条资讯` : "暂无资讯";
    },
    async loadChannel(channel, filters = {}) {
      const input = this.input();
      if (!input) return;
      input.news().browse(filters);
    },
    async refreshChannel(channel) {
      const state = this.channels[channel];
      const input = this.input();
      if (!state || !input || state.refreshing) return;
      state.refreshing = true;
      state.error = "";
      try {
        state.lastRefreshStats = await input.refresh();
      } catch (error) {
        state.error = getUserFacingErrorMessage(error, "资讯刷新失败");
      } finally {
        state.refreshing = false;
      }
    },
    async toggleFavorite(item) {
      const input = this.input();
      if (!input) return;
      const wasFavorited = Boolean(item?.is_favorite);
      try {
        await input.change((catalog) => catalog.toggleFavorite(item.ref || { id: item.id }));
        if (useSessionStore().previewMode && !wasFavorited) {
          alphaAnalytics.record("first_synthetic_news_favorited", { mode: "demo" });
        }
      } catch (error) {
        this.channels.news.error = getUserFacingErrorMessage(error, "收藏操作失败");
      }
    },
    async toggleReadStatus(item) {
      const input = this.input();
      if (!input) return;
      try {
        await input.change((catalog) => catalog.toggleRead(item.ref || { id: item.id }));
      } catch (error) {
        this.channels.news.error = getUserFacingErrorMessage(error, "已读状态更新失败");
      }
    },
    markAsRead(item) {
      const input = this.input();
      if (!input) return null;
      return input.open(item.ref || { id: item.id });
    },
    resetSourceForm() {
      this.sourceForm = createSourceForm();
    },
    setSourceForm(form) {
      this.sourceForm = { ...this.sourceForm, ...form };
    },
    setSourceFeedback(message, tone = "default") {
      this.sourceFeedback = message ? { id: `content-source-feedback-${Date.now()}`, message, tone } : null;
    },
    openSourceModal(channel) {
      this.sourceModalChannel = channel;
      this.sourceEditingId = "";
      this.resetSourceForm();
      this.setSourceFeedback("");
    },
    closeSourceModal() {
      this.sourceModalChannel = "";
      this.sourceEditingId = "";
      this.resetSourceForm();
      this.setSourceFeedback("");
    },
    startEditSource(sourceId) {
      const source = [...this.getVisibleSources("news"), ...this.getHiddenSources("news")].find((item) => item.ref.id === sourceId);
      if (!source) return;
      this.sourceEditingId = sourceId;
      this.sourceForm = {
        id: sourceId, name: source.name, type: source.type, url: source.url,
        parserKey: source.parser_key || "", enabled: source.enabled !== false,
      };
    },
    async saveSource() {
      const input = this.input();
      const source = {
        name: this.sourceForm.name.trim(), type: this.sourceForm.type, url: this.sourceForm.url.trim(),
        parserKey: this.sourceForm.parserKey.trim(), enabled: Boolean(this.sourceForm.enabled),
      };
      if (!source.name || !source.url) {
        this.setSourceFeedback("请先填写完整的名称和链接。", "error");
        return;
      }
      try {
        await input.change((catalog) => (
          this.sourceEditingId
            ? catalog.updateSource({ id: this.sourceEditingId }, source)
            : catalog.createSource(source)
        ));
        this.sourceEditingId = "";
        this.resetSourceForm();
        this.setSourceFeedback("信源已保存", "success");
      } catch (error) {
        this.setSourceFeedback(getUserFacingErrorMessage(error, "信源保存失败"), "error");
      }
    },
    async deleteSource(sourceId) {
      const input = this.input();
      try {
        await input.change((catalog) => catalog.deleteSource({ id: sourceId }));
        this.setSourceFeedback("信源已删除；已收藏资讯会继续保留。", "success");
      } catch (error) {
        this.setSourceFeedback(getUserFacingErrorMessage(error, "信源删除失败"), "error");
      }
    },
    async hideSource(sourceId) {
      const input = this.input();
      try {
        await input.change((catalog) => catalog.setSourceHidden({ id: sourceId }, true));
      } catch (error) {
        this.setSourceFeedback(getUserFacingErrorMessage(error, "隐藏信源失败"), "error");
      }
    },
    async unhideSource(sourceId) {
      const input = this.input();
      try {
        await input.change((catalog) => catalog.setSourceHidden({ id: sourceId }, false));
      } catch (error) {
        this.setSourceFeedback(getUserFacingErrorMessage(error, "恢复信源失败"), "error");
      }
    },
    async toggleSourceEnabled(sourceId) {
      const source = this.getVisibleSources("news").find((item) => item.ref.id === sourceId);
      const input = this.input();
      if (!source || !input) return;
      try {
        await input.change((catalog) => catalog.setSourceEnabled(source.ref, source.enabled === false));
      } catch (error) {
        this.setSourceFeedback(getUserFacingErrorMessage(error, "更新信源失败"), "error");
      }
    },
  },
});

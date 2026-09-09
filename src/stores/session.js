import { defineStore } from "pinia";

import { signOutAccount } from "../services/account-api";
import { fetchSession, probeHealth } from "../services/api-client";
import {
  clearOfflineSession,
  loadOfflineSession,
  loadPreviewMode,
  saveOfflineSession,
  savePreviewMode,
  saveSessionId,
} from "../services/config";
import { stateContinuity, views } from "../services/state-continuity";
import { getUserFacingErrorMessage } from "../utils/error-message";

export const useSessionStore = defineStore("session", {
  state: () => ({
    status: "idle",
    apiStatus: "unknown",
    user: null,
    previewMode: loadPreviewMode(),
    lastCheckedAt: "",
    feedback: "",
  }),
  getters: {
    preferences(state) {
      if (state.previewMode) {
        return stateContinuity.open({ mode: "demo" }).view(views.information()).data.preferences;
      }
      if (!state.user?.id) {
        return {};
      }
      return stateContinuity.open({ id: state.user.id }).view(views.information()).data.preferences;
    },
  },
  actions: {
    applySession(payload, feedback = "", options = {}) {
      const previousUserId = this.user?.id || "";
      const nextUser = payload?.user || null;
      const nextUserId = nextUser?.id || "";
      const identityChanged = Boolean(previousUserId && previousUserId !== nextUserId);
      const identityLost = Boolean(previousUserId && !nextUserId);
      const scope = stateContinuity.transition(
        nextUserId ? { id: nextUserId, preferences: nextUser.preferences || {} } : null,
        { purgePrevious: options.purgePrevious ?? (identityChanged || identityLost) },
      );
      this.user = nextUser;
      this.previewMode = false;
      savePreviewMode(false);
      saveSessionId(payload?.session?.id || "");
      saveOfflineSession(this.user);
      this.status = this.user ? "ready" : "guest";
      if (this.user) {
        this.apiStatus = "ready";
      }
      if (scope) {
        scope.control.sync().catch(() => {});
      }
      this.feedback = feedback || (this.user ? `已识别 ${this.user.username}` : "当前未登录");
    },
    restoreOfflineSession(payload, feedback = "当前离线，已显示最近一次同步内容") {
      const restoredUser = payload?.user || null;
      if (!restoredUser?.id) {
        stateContinuity.transition(null);
        this.user = null;
        this.status = "offline";
        this.apiStatus = "offline";
        this.feedback = feedback;
        return false;
      }

      this.user = restoredUser;
      this.previewMode = false;
      this.status = "ready";
      this.apiStatus = "offline";
      const scope = stateContinuity.transition({ id: restoredUser.id, preferences: restoredUser.preferences || {} });
      const hasOfflineSnapshot = scope.view(views.today()).freshness === "cached";
      this.feedback = hasOfflineSnapshot ? feedback : "当前离线，会话已保留，待服务恢复后继续同步";
      return true;
    },
    startPreviewSession() {
      stateContinuity.transition({ mode: "demo" }, { purgePrevious: Boolean(this.user?.id) }).control.sync();
      this.user = null;
      this.previewMode = true;
      this.status = "ready";
      this.apiStatus = "offline";
      this.feedback = "已进入安全 Demo";
      saveSessionId("");
      savePreviewMode(true);
      clearOfflineSession();
    },
    async bootstrap() {
      if (this.previewMode) {
        this.status = "ready";
        this.apiStatus = "offline";
        this.feedback = "已进入安全 Demo";
        return;
      }
      this.status = "bootstrapping";
      try {
        const [healthResult, sessionResult] = await Promise.allSettled([
          this.refreshHealth(),
          this.refreshSession(),
        ]);

        if (sessionResult.status === "rejected") {
          throw sessionResult.reason;
        }

        if (healthResult.status === "rejected" && !this.user?.id) {
          throw healthResult.reason;
        }
      } catch (error) {
        const restored = this.restoreOfflineSession(loadOfflineSession());
        if (!restored) {
          this.status = "offline";
          this.feedback = getUserFacingErrorMessage(error, "当前未连接到后端");
        }
      }
    },
    async refreshHealth() {
      try {
        const payload = await probeHealth();
        this.apiStatus = payload?.ok ? "ready" : "offline";
        this.lastCheckedAt = new Date().toISOString();
      } catch (error) {
        this.apiStatus = "offline";
        this.lastCheckedAt = new Date().toISOString();
        throw error;
      }
    },
    async refreshSession() {
      try {
        const payload = await fetchSession();
        this.applySession(payload);
        return payload;
      } catch (error) {
        const status = Number(error?.status || 0);
        if (status === 401 || status === 403) {
          this.applySession(null, "当前未登录或会话不可用");
          return null;
        }
        throw error;
      }
    },
    setPreferences(preferences) {
      if (!this.user) {
        return;
      }
      this.user = {
        ...this.user,
        preferences: preferences && typeof preferences === "object" ? preferences : {},
      };
      stateContinuity.transition({ id: this.user.id, preferences: this.user.preferences });
      saveOfflineSession(this.user);
    },
    async signOut() {
      const previousUserId = this.user?.id || "";
      const wasPreviewMode = this.previewMode;
      if (!wasPreviewMode) {
        try {
          await signOutAccount();
        } catch {
          // Best-effort signout; still clear local session state.
        }
      }
      saveSessionId("");
      savePreviewMode(false);
      clearOfflineSession();
      this.user = null;
      this.previewMode = false;
      this.status = "guest";
      this.feedback = wasPreviewMode ? "已退出安全 Demo" : "已退出登录";
      if (wasPreviewMode || previousUserId) {
        stateContinuity.transition(null, { purgePrevious: true });
      }
    },
  },
});

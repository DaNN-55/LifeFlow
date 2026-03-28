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
import { hasDashboardSnapshotData, loadDashboardSnapshot, resetDashboardSyncState } from "../services/sync-service";
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
  actions: {
    applySession(payload, feedback = "") {
      const previousUserId = this.user?.id || "";
      this.user = payload?.user || null;
      this.previewMode = false;
      savePreviewMode(false);
      saveSessionId(payload?.session?.id || "");
      saveOfflineSession(this.user);
      this.status = this.user ? "ready" : "guest";
      if (this.user) {
        this.apiStatus = "ready";
      }
      if (previousUserId) {
        resetDashboardSyncState(previousUserId);
      }
      if (this.user?.id) {
        resetDashboardSyncState(this.user.id);
      }
      this.feedback = feedback || (this.user ? `已识别 ${this.user.username}` : "当前未登录");
    },
    restoreOfflineSession(payload, feedback = "当前离线，已显示最近一次同步内容") {
      const restoredUser = payload?.user || null;
      const hasOfflineSnapshot = restoredUser?.id && hasDashboardSnapshotData(loadDashboardSnapshot(restoredUser.id));
      if (!restoredUser?.id || !hasOfflineSnapshot) {
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
      this.feedback = feedback;
      return true;
    },
    startPreviewSession() {
      this.user = null;
      this.previewMode = true;
      this.status = "ready";
      this.apiStatus = "offline";
      this.feedback = "已进入本地预览模式";
      saveSessionId("");
      savePreviewMode(true);
      clearOfflineSession();
    },
    async bootstrap() {
      if (this.previewMode) {
        this.status = "ready";
        this.apiStatus = "offline";
        this.feedback = "已进入本地预览模式";
        return;
      }
      this.status = "bootstrapping";
      try {
        await this.refreshHealth();
        await this.refreshSession();
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
      } catch (error) {
        this.applySession(null, "当前未登录或会话不可用");
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
      saveOfflineSession(this.user);
    },
    async signOut() {
      const previousUserId = this.user?.id || "";
      try {
        await signOutAccount();
      } catch {
        // Best-effort signout; still clear local session state.
      }
      saveSessionId("");
      savePreviewMode(false);
      clearOfflineSession();
      this.user = null;
      this.previewMode = false;
      this.status = "guest";
      this.feedback = "已退出登录";
      if (previousUserId) {
        resetDashboardSyncState(previousUserId);
      }
    },
  },
});

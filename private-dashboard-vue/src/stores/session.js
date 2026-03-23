import { defineStore } from "pinia";

import { signOutAccount } from "../services/account-api";
import { fetchSession, probeHealth } from "../services/api-client";
import { saveSessionId } from "../services/config";

export const useSessionStore = defineStore("session", {
  state: () => ({
    status: "idle",
    apiStatus: "unknown",
    user: null,
    lastCheckedAt: "",
    feedback: "",
  }),
  actions: {
    applySession(payload, feedback = "") {
      this.user = payload?.user || null;
      saveSessionId(payload?.session?.id || "");
      this.status = this.user ? "ready" : "guest";
      if (this.user) {
        this.apiStatus = "ready";
      }
      this.feedback = feedback || (this.user ? `已识别 ${this.user.username}` : "当前未登录");
    },
    async bootstrap() {
      this.status = "bootstrapping";
      try {
        await this.refreshHealth();
        await this.refreshSession();
      } catch (error) {
        this.status = "offline";
        this.feedback = error?.message || "当前未连接到后端";
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
    },
    async signOut() {
      try {
        await signOutAccount();
      } catch {
        // Best-effort signout; still clear local session state.
      }
      saveSessionId("");
      this.user = null;
      this.status = "guest";
      this.feedback = "已退出登录";
    },
  },
});

import { defineStore } from "pinia";

import { APP_THEME_STORAGE_KEY } from "../app/constants";
import { saveAccountPreferences } from "../services/today-api";
import { getUserFacingErrorMessage } from "../utils/error-message";
import { useSessionStore } from "./session";

function normalizeTheme(theme) {
  return theme === "dark" ? "dark" : "light";
}

function loadStoredTheme() {
  try {
    return normalizeTheme(localStorage.getItem(APP_THEME_STORAGE_KEY) || "light");
  } catch {
    return "light";
  }
}

export const useAppStore = defineStore("app", {
  state: () => ({
    theme: loadStoredTheme(),
    themeBusy: false,
    themeFeedback: "",
    pwaFeedback: "",
    pwaInstallReady: false,
    pwaInstallBusy: false,
    pwaUpdateReady: false,
    deferredInstallPrompt: null,
    pwaUpdateHandler: null,
  }),
  actions: {
    setTheme(theme) {
      this.theme = normalizeTheme(theme);
      localStorage.setItem(APP_THEME_STORAGE_KEY, this.theme);
      document.body.dataset.theme = this.theme;
    },
    async persistTheme(theme) {
      const nextTheme = normalizeTheme(theme);
      const previousTheme = this.theme;
      const sessionStore = useSessionStore();

      this.setTheme(nextTheme);
      this.themeFeedback = `已切换到 ${nextTheme === "light" ? "Light 模式" : "Dark 模式"}`;

      if (!sessionStore.user?.id) {
        return;
      }

      this.themeBusy = true;
      try {
        const nextPreferences = {
          ...(sessionStore.user.preferences || {}),
          theme: nextTheme,
        };
        const response = await saveAccountPreferences(nextPreferences);
        sessionStore.setPreferences(response?.preferences || nextPreferences);
        this.themeFeedback = "主题已保存到账号偏好";
      } catch (error) {
        this.setTheme(previousTheme);
        this.themeFeedback = getUserFacingErrorMessage(error, "主题保存失败");
      } finally {
        this.themeBusy = false;
      }
    },
    toggleTheme() {
      this.setTheme(this.theme === "dark" ? "light" : "dark");
    },
    setPwaFeedback(message = "") {
      this.pwaFeedback = String(message || "");
    },
    setInstallPrompt(promptEvent) {
      this.deferredInstallPrompt = promptEvent || null;
      this.pwaInstallReady = Boolean(promptEvent);
    },
    setPwaUpdateHandler(handler) {
      this.pwaUpdateHandler = typeof handler === "function" ? handler : null;
    },
    notifyOfflineReady() {
      this.setPwaFeedback("PWA 已就绪，可离线打开最近访问页面。");
    },
    notifyUpdateReady(handler) {
      this.setPwaUpdateHandler(handler);
      this.pwaUpdateReady = true;
      this.setPwaFeedback("检测到新版本，可立即更新。");
    },
    async promptPwaInstall() {
      if (!this.deferredInstallPrompt) {
        return false;
      }

      this.pwaInstallBusy = true;
      try {
        await this.deferredInstallPrompt.prompt();
        const choice = await this.deferredInstallPrompt.userChoice;
        const accepted = choice?.outcome === "accepted";
        this.setPwaFeedback(accepted ? "LifeFlow 已加入桌面或主屏幕。" : "已取消安装。");
        this.setInstallPrompt(null);
        return accepted;
      } finally {
        this.pwaInstallBusy = false;
      }
    },
    async applyPwaUpdate() {
      if (!this.pwaUpdateHandler) {
        return;
      }

      this.setPwaFeedback("正在更新应用...");
      await this.pwaUpdateHandler();
      this.pwaUpdateReady = false;
      this.setPwaUpdateHandler(null);
    },
  },
});

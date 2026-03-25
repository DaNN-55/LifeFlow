import { createApp } from "vue";
import { createPinia } from "pinia";
import { registerSW } from "virtual:pwa-register";

import App from "./App.vue";
import { AUTH_GATE_ENABLED } from "./app/constants";
import { router } from "./router";
import { useAppStore } from "./stores/app";
import { useSessionStore } from "./stores/session";
import { getUserFacingErrorMessage } from "./utils/error-message";
import "./styles/base.css";

const pinia = createPinia();
const app = createApp(App);
const appStore = useAppStore(pinia);

let sessionBootstrapPromise = null;
const updateSW = registerSW({
  onOfflineReady() {
    appStore.notifyOfflineReady();
  },
  onNeedRefresh() {
    appStore.notifyUpdateReady(updateSW);
    appStore.setPwaFeedback("检测到新版本，正在刷新应用...");
    window.setTimeout(() => {
      updateSW(true).catch((error) => {
        appStore.setPwaFeedback(getUserFacingErrorMessage(error, "应用更新失败，请手动刷新页面。"));
      });
    }, 900);
  },
  onRegisterError(error) {
    appStore.setPwaFeedback(getUserFacingErrorMessage(error, "PWA 注册失败。"));
  },
});

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    appStore.setInstallPrompt(event);
    appStore.setPwaFeedback("可将 LifeFlow 安装到桌面或主屏幕。");
  });

  window.addEventListener("appinstalled", () => {
    appStore.setInstallPrompt(null);
    appStore.setPwaFeedback("LifeFlow 已安装到设备。");
  });
}

async function ensureSessionBootstrapped() {
  const sessionStore = useSessionStore(pinia);
  if (sessionStore.status !== "idle") {
    return sessionStore;
  }
  if (!sessionBootstrapPromise) {
    sessionBootstrapPromise = sessionStore.bootstrap().finally(() => {
      sessionBootstrapPromise = null;
    });
  }
  await sessionBootstrapPromise;
  return sessionStore;
}

router.beforeEach(async (to) => {
  const sessionStore = await ensureSessionBootstrapped();
  const isAuthenticated = Boolean(sessionStore.user?.id) || sessionStore.previewMode;
  const requiresAuth = to.meta.requiresAuth !== false;
  const redirectTarget =
    typeof to.query.redirect === "string" && to.query.redirect.startsWith("/") && !to.query.redirect.startsWith("//")
      ? to.query.redirect
      : "/";

  if (!AUTH_GATE_ENABLED) {
    if (to.name === "auth" && isAuthenticated) {
      return redirectTarget;
    }
    return true;
  }

  if (requiresAuth && !isAuthenticated) {
    return {
      name: "auth",
      query: {
        redirect: to.fullPath,
      },
    };
  }

  if (to.name === "auth" && isAuthenticated) {
    return redirectTarget;
  }

  return true;
});

app.use(pinia);
app.use(router);

app.mount("#app");

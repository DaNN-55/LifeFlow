import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import { AUTH_GATE_ENABLED } from "./app/constants";
import { router } from "./router";
import { useAppStore } from "./stores/app";
import { useSessionStore } from "./stores/session";
import "./styles/base.css";

const pinia = createPinia();
const app = createApp(App);
const appStore = useAppStore(pinia);

let sessionBootstrapPromise = null;

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

function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  }, { once: true });
}

function syncNetworkStatus() {
  if (typeof navigator === "undefined") {
    return;
  }
  appStore.setNetworkStatus(navigator.onLine ? "online" : "offline");
}

router.beforeEach(async (to) => {
  const existingSessionStore = useSessionStore(pinia);
  const shouldDeferSessionProbe = to.name === "auth"
    && existingSessionStore.status === "idle"
    && !existingSessionStore.previewMode;
  const sessionStore = shouldDeferSessionProbe
    ? existingSessionStore
    : await ensureSessionBootstrapped();
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
syncNetworkStatus();
if (typeof window !== "undefined") {
  window.addEventListener("online", syncNetworkStatus);
  window.addEventListener("offline", syncNetworkStatus);
}
registerServiceWorker();

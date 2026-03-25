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

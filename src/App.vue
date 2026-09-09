<script setup>
import { computed, defineAsyncComponent, onMounted, watch } from "vue";
import { RouterView, useRoute } from "vue-router";

import { useAppStore } from "./stores/app";
import { useSessionStore } from "./stores/session";

const AppShell = defineAsyncComponent(() => import("./components/layout/AppShell.vue"));

const route = useRoute();
const appStore = useAppStore();
const sessionStore = useSessionStore();
const useShellLayout = computed(() => route.meta.layout === "workspace");
const workspaceFontStylesheetId = "lifeflow-workspace-fonts";

function ensureWorkspaceFonts() {
  if (typeof document === "undefined" || document.getElementById(workspaceFontStylesheetId)) {
    return;
  }
  const stylesheet = document.createElement("link");
  stylesheet.id = workspaceFontStylesheetId;
  stylesheet.rel = "stylesheet";
  stylesheet.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Material+Symbols+Outlined:wght@300;400;500;600&family=Public+Sans:wght@300;400;500;600;700;800&display=swap";
  document.head.append(stylesheet);
}

onMounted(() => {
  appStore.setTheme(appStore.theme);
});

watch(
  () => sessionStore.preferences?.theme,
  (theme) => {
    if (theme) {
      appStore.setTheme(theme);
    }
  },
);

watch(
  useShellLayout,
  (usesWorkspace) => {
    if (usesWorkspace) {
      ensureWorkspaceFonts();
    }
  },
  { immediate: true },
);

</script>

<template>
  <AppShell v-if="useShellLayout" />
  <RouterView v-else />
</template>

<script setup>
import { computed, onMounted, watch } from "vue";
import { RouterView, useRoute } from "vue-router";

import AppShell from "./components/layout/AppShell.vue";
import { useAppStore } from "./stores/app";
import { useSessionStore } from "./stores/session";

const route = useRoute();
const appStore = useAppStore();
const sessionStore = useSessionStore();
const useShellLayout = computed(() => route.meta.layout !== "auth");

onMounted(() => {
  appStore.setTheme(appStore.theme);
});

watch(
  () => sessionStore.user?.preferences?.theme,
  (theme) => {
    if (theme) {
      appStore.setTheme(theme);
    }
  },
);
</script>

<template>
  <AppShell v-if="useShellLayout" />
  <RouterView v-else />
</template>

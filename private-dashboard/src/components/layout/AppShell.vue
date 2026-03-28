<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";

import { ACCOUNT_CONTROLS_ENABLED, topTabs } from "../../app/constants";
import AccountProfileModal from "../account/AccountProfileModal.vue";
import ChangePasswordModal from "../account/ChangePasswordModal.vue";
import SyncCenterModal from "../account/SyncCenterModal.vue";
import WidgetSettingsModal from "../account/WidgetSettingsModal.vue";
import CalendarHeatmap from "../home/CalendarHeatmap.vue";
import FavoritesWidget from "../home/FavoritesWidget.vue";
import FeedPreviewCard from "../home/FeedPreviewCard.vue";
import GitHubWidget from "../home/GitHubWidget.vue";
import StockWidget from "../home/StockWidget.vue";
import WeatherWidget from "../home/WeatherWidget.vue";
import { useAppStore } from "../../stores/app";
import { useAccountStore } from "../../stores/account";
import { useHomeStore } from "../../stores/home";
import { useSessionStore } from "../../stores/session";
import { useTodayStore } from "../../stores/today";
import { buildWeatherAxis, buildWeatherHotspots, buildWeatherPolyline, sparklinePoints } from "../../utils/home";

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const accountStore = useAccountStore();
const homeStore = useHomeStore();
const sessionStore = useSessionStore();
const todayStore = useTodayStore();
const accountMenuRef = ref(null);
const topTabsRef = ref(null);
const centerStageRef = ref(null);
const topTabNodes = new Map();
const routeScrollTopByPath = new Map();
const hoveredTopTabId = ref("");
const topTabIndicatorStyle = ref({
  width: "0px",
  transform: "translateX(0px)",
  opacity: "0",
});
const isPwaPhoneShell = ref(false);

const PWA_PHONE_MIN_WIDTH = 380;
const PWA_PHONE_MAX_WIDTH = 430;
const PWA_PHONE_MIN_HEIGHT = 780;
const PWA_PHONE_MAX_HEIGHT = 980;

const statusLabel = computed(() => {
  if (sessionStore.previewMode) {
    return "预览";
  }
  return sessionStore.user?.username ? sessionStore.user.username : "登录";
});

const compactStatusLabel = computed(() => {
  const raw = String(statusLabel.value || "").trim();
  if (!isPwaPhoneShell.value || !raw || raw === "登录" || raw === "预览") {
    return raw;
  }
  if (raw.includes("@")) {
    const [localPart = ""] = raw.split("@");
    return localPart.length > 6 ? `${localPart.slice(0, 6)}...` : localPart;
  }
  return raw.length > 12 ? `${raw.slice(0, 12)}...` : raw;
});

const yearProgress = computed(() => {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1).getTime();
  const total = yearEnd - yearStart;
  const elapsed = Math.min(Math.max(now.getTime() - yearStart, 0), total);
  return total ? (elapsed / total) * 100 : 0;
});

const lifeProgress = computed(() => {
  const profile = sessionStore.user?.preferences?.profile || {};
  const birthDate = String(profile.birthDate || "1996-11-05");
  const expectancy = Number(profile.lifeExpectancyYears || 80) || 80;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) {
    return 0;
  }
  const now = Date.now();
  const end = new Date(birth);
  end.setFullYear(end.getFullYear() + expectancy);
  const total = end.getTime() - birth.getTime();
  const elapsed = Math.min(Math.max(now - birth.getTime(), 0), total);
  return total ? (elapsed / total) * 100 : 0;
});

const sidebarPreferences = computed(() => ({
  freshNews: sessionStore.user?.preferences?.sidebar?.freshNews !== false,
  calendar: sessionStore.user?.preferences?.sidebar?.calendar !== false,
  github: sessionStore.user?.preferences?.sidebar?.github !== false,
  favorites: sessionStore.user?.preferences?.sidebar?.favorites !== false,
  weather: sessionStore.user?.preferences?.sidebar?.weather !== false,
  stock: sessionStore.user?.preferences?.sidebar?.stock !== false,
}));

const visibleTopTabs = computed(() => (
  isPwaPhoneShell.value
    ? topTabs.filter((tab) => ["pulse", "today", "content"].includes(tab.id))
    : topTabs
));

const showShellSidebars = computed(() => !isPwaPhoneShell.value);
const shellFeedback = computed(() => {
  if ((appStore.networkStatus === "offline" || sessionStore.apiStatus === "offline") && sessionStore.user?.id) {
    return "当前离线，已显示最近一次同步内容。";
  }
  return appStore.pwaFeedback;
});

function getPwaTabIcon(tabId) {
  if (tabId === "pulse") {
    return "space_dashboard";
  }
  if (tabId === "today") {
    return "today";
  }
  if (tabId === "content") {
    return "newspaper";
  }
  return "radio_button_checked";
}

function isActive(tab) {
  return route.path === tab.to || route.path.startsWith(`${tab.to}/`);
}

function resolveElement(target) {
  if (target instanceof HTMLElement) {
    return target;
  }
  if (target && target.$el instanceof HTMLElement) {
    return target.$el;
  }
  return null;
}

function setTopTabRef(tabId, element) {
  const resolved = resolveElement(element);
  if (resolved) {
    topTabNodes.set(tabId, resolved);
    return;
  }
  topTabNodes.delete(tabId);
}

function syncTopTabIndicator() {
  const targetId = hoveredTopTabId.value || visibleTopTabs.value.find((tab) => isActive(tab))?.id || visibleTopTabs.value[0]?.id;
  const navElement = topTabsRef.value;
  const tabElement = targetId ? topTabNodes.get(targetId) : null;

  if (!navElement || !tabElement) {
    topTabIndicatorStyle.value = {
      width: "0px",
      transform: "translateX(0px)",
      opacity: "0",
    };
    return;
  }

  const navRect = navElement.getBoundingClientRect();
  const tabRect = tabElement.getBoundingClientRect();
  const inset = 8;
  const width = Math.max(tabRect.width - inset * 2, 18);
  topTabIndicatorStyle.value = {
    width: `${width}px`,
    transform: `translateX(${tabRect.left - navRect.left + (tabRect.width - width) / 2}px)`,
    opacity: "1",
  };
}

async function refreshTopTabIndicator() {
  await nextTick();
  syncTopTabIndicator();
}

function formatPercent(value) {
  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
}

function saveCurrentRouteScroll() {
  if (!(centerStageRef.value instanceof HTMLElement)) {
    return;
  }
  routeScrollTopByPath.set(route.fullPath, centerStageRef.value.scrollTop);
}

async function restoreRouteScroll() {
  await nextTick();
  if (!(centerStageRef.value instanceof HTMLElement)) {
    return;
  }
  if (route.path === "/content" || route.path.startsWith("/content/")) {
    centerStageRef.value.scrollTo({ top: 0, left: 0, behavior: "auto" });
    centerStageRef.value.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    if (document.scrollingElement) {
      document.scrollingElement.scrollTop = 0;
    }
    return;
  }
  const savedScrollTop = routeScrollTopByPath.get(route.fullPath);
  centerStageRef.value.scrollTop = Number.isFinite(savedScrollTop) ? savedScrollTop : 0;
}

async function bootstrapHome() {
  if (!sessionStore.user?.id || sessionStore.previewMode) {
    return;
  }
  await homeStore.bootstrap();
}

function detectPwaPhoneShell() {
  if (typeof window === "undefined") {
    return false;
  }
  const standaloneMatcher = window.matchMedia?.("(display-mode: standalone)");
  const isStandalone = Boolean(standaloneMatcher?.matches || window.navigator.standalone);
  if (!isStandalone) {
    return false;
  }
  const width = Math.min(window.innerWidth, window.innerHeight);
  const height = Math.max(window.innerWidth, window.innerHeight);
  return (
    width >= PWA_PHONE_MIN_WIDTH &&
    width <= PWA_PHONE_MAX_WIDTH &&
    height >= PWA_PHONE_MIN_HEIGHT &&
    height <= PWA_PHONE_MAX_HEIGHT
  );
}

async function refreshShellMode() {
  isPwaPhoneShell.value = detectPwaPhoneShell();
  await refreshTopTabIndicator();
}

async function ensureAllowedPwaRoute() {
  if (!isPwaPhoneShell.value) {
    return;
  }
  if (route.path === "/fretflow" || route.path.startsWith("/fretflow/")) {
    await router.replace("/today");
  }
}

async function openCalendarDate(date) {
  await Promise.all([
    homeStore.selectCalendarDate(date),
    todayStore.selectDate(date),
  ]);
  if (route.path !== "/today" || route.query.date !== date) {
    await router.push({
      path: "/today",
      query: {
        ...route.query,
        date,
      },
    });
  }
}

function openFavoritesChannel(channel) {
  router.push("/content");
}

function handleDocumentPointerDown(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if (!sessionStore.user?.id) {
    return;
  }
  if (!accountMenuRef.value?.contains(target)) {
    accountStore.closeMenu();
  }
}

function handleTopTabEnter(tab) {
  hoveredTopTabId.value = tab.id;
  refreshTopTabIndicator();
}

function handleTopTabLeave() {}

function handleTopTabFocus(tab) {
  hoveredTopTabId.value = tab.id;
  refreshTopTabIndicator();
}

function handleTopTabBlur() {
  hoveredTopTabId.value = "";
  refreshTopTabIndicator();
}

async function handleAccountChipClick() {
  if (!ACCOUNT_CONTROLS_ENABLED) {
    return;
  }
  if (sessionStore.previewMode) {
    await sessionStore.signOut();
    await router.push({
      name: "auth",
      query: {
        redirect: route.fullPath,
      },
    });
    return;
  }
  if (!sessionStore.user?.id) {
    await router.push({
      name: "auth",
      query: {
        redirect: route.fullPath,
      },
    });
    return;
  }
  accountStore.toggleMenu();
}

async function handleAccountAction(action) {
  if (action === "profile") {
    await accountStore.openProfile();
    return;
  }
  if (action === "sync-center") {
    accountStore.openSyncCenter();
    return;
  }
  if (action === "password") {
    accountStore.openPasswordModal();
    return;
  }
  if (action === "logout") {
    accountStore.closeMenu();
    await sessionStore.signOut();
    router.push("/");
  }
}

watch(
  () => sessionStore.user?.id,
  async (userId) => {
    if (userId) {
      await bootstrapHome();
    }
  },
  { immediate: true },
);

watch(
  () => sessionStore.user?.preferences?.theme,
  (theme) => {
    if (theme) {
      appStore.setTheme(theme);
    }
  },
);

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  window.addEventListener("resize", refreshShellMode);
  centerStageRef.value?.addEventListener("scroll", saveCurrentRouteScroll, { passive: true });
  refreshShellMode();
  refreshTopTabIndicator();
  restoreRouteScroll();
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  window.removeEventListener("resize", refreshShellMode);
  centerStageRef.value?.removeEventListener("scroll", saveCurrentRouteScroll);
});

watch(
  () => route.fullPath,
  async (_nextPath, previousPath) => {
    if (previousPath && centerStageRef.value instanceof HTMLElement) {
      routeScrollTopByPath.set(previousPath, centerStageRef.value.scrollTop);
    }
    refreshTopTabIndicator();
    await restoreRouteScroll();
  },
);

watch(
  () => isPwaPhoneShell.value,
  async () => {
    await ensureAllowedPwaRoute();
  },
);

watch(
  () => route.path,
  async () => {
    await ensureAllowedPwaRoute();
  },
);
</script>

<template>
  <div class="app-frame" :class="{ 'is-pwa-phone-shell': isPwaPhoneShell }">
    <header class="main-nav">
      <div class="nav-brand">
        <div class="brand-mark" aria-label="LifeFlow 标志">
          <img src="/logo.png" alt="LifeFlow" />
        </div>
        <div class="brand-copy">
          <strong>LifeFlow</strong>
          <span>Personal execution system</span>
        </div>
      </div>

      <nav
        v-if="!isPwaPhoneShell"
        ref="topTabsRef"
        class="top-tabs"
        aria-label="主导航"
        @mouseleave="hoveredTopTabId = ''; refreshTopTabIndicator()"
      >
        <div
          v-for="tab in visibleTopTabs"
          :key="tab.id"
          class="top-tab-shell"
          :class="{ 'has-inline-actions': Array.isArray(tab.actions) && tab.actions.length }"
          @mouseenter="handleTopTabEnter(tab)"
          @mouseleave="handleTopTabLeave(tab)"
          @focusin="handleTopTabFocus(tab)"
          @focusout="handleTopTabBlur(tab)"
        >
          <RouterLink
            :to="tab.to"
            :ref="(element) => setTopTabRef(tab.id, element)"
            class="top-tab"
            :class="{ 'is-active': isActive(tab) }"
            @blur="hoveredTopTabId = ''; refreshTopTabIndicator()"
          >
            {{ tab.label }}
          </RouterLink>
          <div v-if="Array.isArray(tab.actions) && tab.actions.length" class="top-tab-inline-actions">
            <a
              v-for="action in tab.actions"
              :key="action.id"
              class="top-tab-inline-action"
              :href="action.href"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ action.label }}
            </a>
          </div>
        </div>
        <span class="top-tab-indicator" :style="topTabIndicatorStyle" aria-hidden="true"></span>
      </nav>

      <div class="nav-progress-inline" aria-label="年度与人生进度">
        <span class="nav-progress-item">Year <strong class="nav-progress-value">{{ formatPercent(yearProgress) }}</strong></span>
        <span class="nav-progress-divider" aria-hidden="true">|</span>
        <span class="nav-progress-item">Life <strong class="nav-progress-value">{{ formatPercent(lifeProgress) }}</strong></span>
      </div>

      <div class="nav-actions">
        <div v-if="appStore.pwaInstallReady || appStore.pwaUpdateReady" class="nav-pwa-actions">
          <button
            v-if="appStore.pwaInstallReady"
            type="button"
            class="task-cancel-action nav-pwa-button"
            :disabled="appStore.pwaInstallBusy"
            @click="appStore.promptPwaInstall"
          >
            {{ appStore.pwaInstallBusy ? "Installing..." : "Install App" }}
          </button>
          <button
            v-if="appStore.pwaUpdateReady"
            type="button"
            class="settings-save nav-pwa-button"
            @click="appStore.applyPwaUpdate"
          >
            Update App
          </button>
        </div>
        <div v-if="ACCOUNT_CONTROLS_ENABLED" ref="accountMenuRef" class="account-menu-wrap">
          <button class="account-chip" type="button" :title="statusLabel" @click="handleAccountChipClick">
            <span v-if="isPwaPhoneShell" class="material-symbols-outlined account-chip-icon" aria-hidden="true">person</span>
            <span v-else>{{ compactStatusLabel }}</span>
          </button>
          <div class="account-menu" :hidden="!sessionStore.user?.id || !accountStore.menuOpen">
            <button type="button" class="account-menu-item" @click="handleAccountAction('profile')">当前账号资料</button>
            <button type="button" class="account-menu-item" @click="handleAccountAction('sync-center')">同步中心</button>
            <button type="button" class="account-menu-item" @click="handleAccountAction('password')">修改密码</button>
            <button type="button" class="account-menu-item is-danger" @click="handleAccountAction('logout')">退出登录</button>
          </div>
        </div>
        <div class="theme-switcher" :data-active-theme="appStore.theme" aria-label="主题模式切换">
          <button
            type="button"
            class="theme-option"
            :class="{ 'is-active': appStore.theme === 'light' }"
            :aria-label="isPwaPhoneShell ? '浅色模式' : undefined"
            :disabled="appStore.themeBusy"
            @click="appStore.persistTheme('light')"
          >
            <span v-if="isPwaPhoneShell" class="material-symbols-outlined" aria-hidden="true">light_mode</span>
            <span v-else>Light</span>
          </button>
          <button
            type="button"
            class="theme-option"
            :class="{ 'is-active': appStore.theme === 'dark' }"
            :aria-label="isPwaPhoneShell ? '深色模式' : undefined"
            :disabled="appStore.themeBusy"
            @click="appStore.persistTheme('dark')"
          >
            <span v-if="isPwaPhoneShell" class="material-symbols-outlined" aria-hidden="true">dark_mode</span>
            <span v-else>Dark</span>
          </button>
        </div>
      </div>

      <span class="nav-year-progress-line" :style="{ width: `${yearProgress}%` }" aria-hidden="true"></span>
    </header>

    <main class="dashboard-grid">
      <aside v-if="showShellSidebars" class="left-rail">
        <CalendarHeatmap v-if="sidebarPreferences.calendar" :label="homeStore.calendarLabel" :days="homeStore.calendarDays" @select-date="openCalendarDate" />
        <GitHubWidget
          v-if="sidebarPreferences.github"
          :github="homeStore.github"
          :profile-url="homeStore.githubProfileUrl"
          :format-date-time="homeStore.formatDateTime"
        />
        <FeedPreviewCard
          v-if="sidebarPreferences.freshNews"
          title="News"
          kicker="Latest feed"
          icon="newspaper"
          channel="news"
          link-to="/content"
          :items="homeStore.freshNewsFeed"
          :format-date-time="homeStore.formatDateTime"
        />
      </aside>

      <section ref="centerStageRef" class="center-stage">
        <div v-if="shellFeedback" class="theme-feedback-banner">
          {{ shellFeedback }}
        </div>
        <RouterView />
      </section>

      <aside v-if="showShellSidebars" class="right-rail">
        <WeatherWidget
          v-if="sidebarPreferences.weather"
          :weather="homeStore.weather"
          :build-polyline="buildWeatherPolyline"
          :build-axis="buildWeatherAxis"
          :build-hotspots="buildWeatherHotspots"
          @refresh="homeStore.refreshWeather"
          @configure="accountStore.openWidgetSettings('weather')"
        />
        <StockWidget
          v-if="sidebarPreferences.stock"
          :stock="homeStore.stock"
          :title="sessionStore.user?.preferences?.widgets?.stock?.title || 'A股概览'"
          :format-code="homeStore.formatDisplayStockCode"
          :sparkline-points="sparklinePoints"
          :format-date-time="homeStore.formatDateTime"
          @refresh="homeStore.refreshStocks"
          @configure="accountStore.openWidgetSettings('stock')"
        />
        <FavoritesWidget
          v-if="sidebarPreferences.favorites"
          :favorites="homeStore.favorites"
          :format-date-time="homeStore.formatDateTime"
          @jump="openFavoritesChannel"
          @configure="accountStore.openWidgetSettings('favorites')"
        />
      </aside>
    </main>

    <nav v-if="isPwaPhoneShell" class="bottom-tabs" aria-label="PWA 主导航">
      <RouterLink
        v-for="tab in visibleTopTabs"
        :key="tab.id"
        :to="tab.to"
        class="bottom-tab"
        :class="{ 'is-active': isActive(tab) }"
      >
        <span class="material-symbols-outlined bottom-tab-icon" aria-hidden="true">{{ getPwaTabIcon(tab.id) }}</span>
        <span class="bottom-tab-label">{{ tab.label }}</span>
      </RouterLink>
    </nav>

    <AccountProfileModal
      v-if="ACCOUNT_CONTROLS_ENABLED"
      :open="accountStore.profileOpen"
      :loading="accountStore.profileLoading"
      :profile-data="accountStore.profileData"
      :profile-feedback="accountStore.profileFeedback"
      :security-feedback="accountStore.securityFeedback"
      :danger-feedback="accountStore.dangerFeedback"
      :recovery-code="accountStore.recoveryCode"
      :recovery-busy="accountStore.recoveryBusy"
      :username-busy="accountStore.usernameBusy"
      :sign-out-all-busy="accountStore.signOutAllBusy"
      :clear-data-busy="accountStore.clearDataBusy"
      :delete-account-busy="accountStore.deleteAccountBusy"
      :profile-form="accountStore.forms.profile"
      :account-form="accountStore.forms.account"
      @close="accountStore.closeProfile"
      @save="accountStore.saveProfile"
      @regenerate-recovery="accountStore.regenerateRecoveryCode"
      @change-username="accountStore.saveUsername"
      @signout-all="accountStore.signOutAllSessions"
      @clear-data="accountStore.clearAllAccountData"
      @delete-account="accountStore.removeAccount"
      @update:profile-form="accountStore.forms.profile = $event"
      @update:account-form="accountStore.forms.account = $event"
    />

    <SyncCenterModal
      v-if="ACCOUNT_CONTROLS_ENABLED"
      :open="accountStore.syncOpen"
      :api-status="sessionStore.apiStatus"
      :authenticated="Boolean(sessionStore.user?.id)"
      :profile-loading="accountStore.syncProfileLoading"
      :profile-counts="accountStore.syncCounts"
      :notices="accountStore.syncNotices"
      :safety-backup="accountStore.safetyBackup"
      :transfer-busy="accountStore.transferBusy"
      :transfer-mode="accountStore.transferMode"
      :replace-import-confirmed="accountStore.replaceImportConfirmed"
      :format-date-time="accountStore.formatDateTime"
      @close="accountStore.syncOpen = false"
      @export-data="accountStore.exportSnapshot"
      @import-data="accountStore.startImportFromFile"
      @download-backup="accountStore.downloadLatestSafetyBackup"
      @restore-backup="accountStore.restoreSafetyBackup"
      @update:transfer-mode="accountStore.setTransferMode"
      @update:replace-import-confirmed="accountStore.setReplaceImportConfirmed"
    />

    <ChangePasswordModal
      v-if="ACCOUNT_CONTROLS_ENABLED"
      :open="accountStore.passwordOpen"
      :busy="accountStore.passwordBusy"
      :feedback="accountStore.passwordFeedback"
      :form="accountStore.forms.password"
      @close="accountStore.passwordOpen = false"
      @save="accountStore.savePassword"
      @update:form="accountStore.forms.password = $event"
    />

    <WidgetSettingsModal
      v-if="ACCOUNT_CONTROLS_ENABLED"
      :open="accountStore.widgetSettingsOpen"
      :widget="accountStore.widgetSettingsKey"
      :profile-form="accountStore.forms.profile"
      :feedback="accountStore.widgetSettingsFeedback"
      :busy="accountStore.widgetSettingsBusy"
      @close="accountStore.closeWidgetSettings"
      @save="accountStore.saveWidgetSettings"
      @update:profile-form="accountStore.forms.profile = $event"
    />
  </div>
</template>

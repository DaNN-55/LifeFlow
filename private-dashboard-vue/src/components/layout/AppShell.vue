<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
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

const statusLabel = computed(() => (sessionStore.user?.username ? sessionStore.user.username : "登录"));

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
  calendar: sessionStore.user?.preferences?.sidebar?.calendar !== false,
  github: sessionStore.user?.preferences?.sidebar?.github !== false,
  financeFeed: sessionStore.user?.preferences?.sidebar?.financeFeed !== false,
  scienceFeed: sessionStore.user?.preferences?.sidebar?.scienceFeed !== false,
  favorites: sessionStore.user?.preferences?.sidebar?.favorites !== false,
  weather: sessionStore.user?.preferences?.sidebar?.weather !== false,
  stock: sessionStore.user?.preferences?.sidebar?.stock !== false,
}));

function isActive(tab) {
  if (tab.to === "/") {
    return route.path === "/";
  }
  return route.path === tab.to || route.path.startsWith(`${tab.to}/`);
}

function formatPercent(value) {
  return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;
}

async function bootstrapHome() {
  if (!sessionStore.user?.id) {
    return;
  }
  await homeStore.bootstrap();
}

async function openCalendarDate(date) {
  await Promise.all([
    homeStore.selectCalendarDate(date),
    todayStore.selectDate(date),
  ]);
  if (route.path !== "/") {
    await router.push("/");
  }
}

function openFavoritesChannel(channel) {
  if (!channel) {
    return;
  }
  router.push(`/content/${channel}`);
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

async function handleAccountChipClick() {
  if (!ACCOUNT_CONTROLS_ENABLED) {
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
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
});
</script>

<template>
  <div class="app-frame">
    <header class="main-nav">
      <div class="nav-brand">
        <div class="brand-mark" aria-label="LifeFlow 标志">
          <img src="/logo.png" alt="LifeFlow" />
        </div>
        <div class="brand-copy">
          <strong>Dashboard</strong>
          <span>Personal execution console</span>
        </div>
      </div>

      <nav class="top-tabs" aria-label="主导航">
        <RouterLink
          v-for="tab in topTabs"
          :key="tab.id"
          :to="tab.to"
          class="top-tab"
          :class="{ 'is-active': isActive(tab) }"
        >
          {{ tab.label }}
        </RouterLink>
      </nav>

      <div class="nav-actions">
        <div class="nav-progress-inline" aria-label="年度与人生进度">
          <span class="nav-progress-item">Year <strong class="nav-progress-value">{{ formatPercent(yearProgress) }}</strong></span>
          <span class="nav-progress-divider" aria-hidden="true">|</span>
          <span class="nav-progress-item">Life <strong class="nav-progress-value">{{ formatPercent(lifeProgress) }}</strong></span>
        </div>
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
          <button class="account-chip" type="button" @click="handleAccountChipClick">
            {{ statusLabel }}
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
            :disabled="appStore.themeBusy"
            @click="appStore.persistTheme('light')"
          >
            Light
          </button>
          <button
            type="button"
            class="theme-option"
            :class="{ 'is-active': appStore.theme === 'dark' }"
            :disabled="appStore.themeBusy"
            @click="appStore.persistTheme('dark')"
          >
            Dark
          </button>
        </div>
      </div>

      <span class="nav-year-progress-line" :style="{ width: `${yearProgress}%` }" aria-hidden="true"></span>
    </header>

    <main class="dashboard-grid">
      <aside class="left-rail">
        <CalendarHeatmap v-if="sidebarPreferences.calendar" :label="homeStore.calendarLabel" :days="homeStore.calendarDays" @select-date="openCalendarDate" />
        <GitHubWidget
          v-if="sidebarPreferences.github"
          :github="homeStore.github"
          :profile-url="homeStore.githubProfileUrl"
          :format-date-time="homeStore.formatDateTime"
        />
        <FeedPreviewCard
          v-if="sidebarPreferences.financeFeed"
          title="Finance"
          kicker="Curated feed"
          icon="trending_up"
          channel="finance"
          :items="homeStore.financeFeed"
          :format-date-time="homeStore.formatDateTime"
        />
        <FeedPreviewCard
          v-if="sidebarPreferences.scienceFeed"
          title="Science"
          kicker="Reading queue"
          icon="science"
          channel="science"
          :items="homeStore.scienceFeed"
          :format-date-time="homeStore.formatDateTime"
        />
      </aside>

      <section class="center-stage">
        <div v-if="appStore.themeFeedback" class="theme-feedback-banner">
          {{ appStore.themeFeedback }}
        </div>
        <div v-if="appStore.pwaFeedback" class="theme-feedback-banner">
          {{ appStore.pwaFeedback }}
        </div>
        <RouterView />
      </section>

      <aside class="right-rail">
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

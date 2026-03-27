import { defineStore } from "pinia";

import { defaultWidgets, SAFETY_BACKUP_STORAGE_KEY } from "../app/constants";
import {
  changePassword,
  changeUsername,
  clearAccountData,
  deleteAccount,
  fetchAccountProfile,
  generateRecoveryCode,
  signOutAllAccounts,
} from "../services/account-api";
import { saveAuthConfig, saveSessionId } from "../services/config";
import { createTask, deleteTask, fetchDailyRecord, listTasks, saveAccountPreferences, saveDailyRecord, updateTask } from "../services/today-api";
import { fetchWeeklySummary, saveWeeklySummary } from "../services/weekly-api";
import { clearDashboardSnapshot } from "../services/sync-service";
import { addDays, formatDateKey, formatDateTime, formatWeekInputValue, getStartOfWeek, parseIsoDate } from "../utils/date";
import { getUserFacingErrorMessage } from "../utils/error-message";
import { useContentStore } from "./content";
import { useHomeStore } from "./home";
import { useSessionStore } from "./session";
import { useTodayStore } from "./today";
import { useWeeklyStore } from "./weekly";

function createDefaultSidebarPreferences() {
  return {
    calendar: true,
    github: true,
    freshNews: true,
    financeFeed: true,
    scienceFeed: true,
    favorites: true,
    weather: true,
    stock: true,
  };
}

function createDefaultProfilePreferences() {
  return {
    birthDate: "1996-11-05",
    lifeExpectancyYears: 80,
  };
}

function createDefaultSyncPreferences() {
  return {
    lastSyncAttemptAt: "",
    lastSuccessfulSyncAt: "",
    notices: [],
  };
}

function normalizePreferences(preferences = {}) {
  const sidebarPreferences = preferences?.sidebar || {};
  return {
    ...(preferences || {}),
    theme: preferences?.theme === "dark" ? "dark" : "light",
    sidebar: {
      ...createDefaultSidebarPreferences(),
      ...sidebarPreferences,
      freshNews: Object.prototype.hasOwnProperty.call(sidebarPreferences, "freshNews")
        ? sidebarPreferences.freshNews !== false
        : sidebarPreferences.financeFeed !== false || sidebarPreferences.scienceFeed !== false,
    },
    profile: {
      ...createDefaultProfilePreferences(),
      ...(preferences?.profile || {}),
    },
    sync: {
      ...createDefaultSyncPreferences(),
      ...(preferences?.sync || {}),
      notices: Array.isArray(preferences?.sync?.notices) ? preferences.sync.notices.slice(0, 12) : [],
    },
    widgets: {
      github: {
        ...defaultWidgets.github,
        ...(preferences?.widgets?.github || {}),
      },
      favorites: {
        ...defaultWidgets.favorites,
        ...(preferences?.widgets?.favorites || {}),
      },
      weather: {
        ...defaultWidgets.weather,
        ...(preferences?.widgets?.weather || {}),
      },
      stock: {
        ...defaultWidgets.stock,
        ...(preferences?.widgets?.stock || {}),
      },
    },
    tasks: {
      ...(preferences?.tasks || {}),
      tagsByTaskId: {
        ...(preferences?.tasks?.tagsByTaskId || {}),
      },
      iconByTaskId: {
        ...(preferences?.tasks?.iconByTaskId || {}),
      },
    },
    content: {
      ...(preferences?.content || {}),
      readItems: {
        ...(preferences?.content?.readItems || {}),
      },
      hiddenSources: {
        ...(preferences?.content?.hiddenSources || {}),
      },
    },
  };
}

function createEmptyForms() {
  return {
    profile: {
      sidebar: createDefaultSidebarPreferences(),
      profile: createDefaultProfilePreferences(),
      widgets: structuredClone(defaultWidgets),
    },
    password: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    account: {
      username: "",
      currentPassword: "",
      deletePassword: "",
    },
  };
}

function createEmptySnapshotData(preferences = {}) {
  return {
    version: 6,
    taskTypes: [],
    dailyRecords: {},
    weeklySummaries: {},
    preferences: normalizePreferences(preferences),
  };
}

function normalizeTaskForSnapshot(task = {}) {
  return {
    id: String(task.id || ""),
    name: String(task.name || "未命名任务"),
    color: String(task.color || ""),
    order: Number(task.order || task.display_order || 1),
    archived: Boolean(task.archived),
    archivedAt: task.archivedAt || task.archived_at || "",
  };
}

function buildDateKeysBetween(startDate, endDate = new Date()) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const keys = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    keys.push(formatDateKey(cursor));
  }
  return keys;
}

function buildWeekValuesBetween(startDate, endDate = new Date()) {
  const start = getStartOfWeek(startDate);
  const end = getStartOfWeek(endDate);
  const values = [];

  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 7)) {
    values.push(formatWeekInputValue(cursor));
  }
  return values;
}

async function mapInBatches(items = [], batchSize = 10, mapper) {
  const results = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...(await Promise.all(batch.map(mapper))));
  }
  return results;
}

function hasRecordContent(record = {}) {
  const tasks = record?.tasks || record?.payload?.tasks || {};
  return Object.keys(tasks).length > 0 || Boolean(record?.updatedAt);
}

function hasSummaryContent(summary = {}) {
  return Boolean(String(summary?.content || "").trim() || summary?.updatedAt);
}

function getSnapshotStats(snapshotData = {}) {
  return {
    tasks: Array.isArray(snapshotData.taskTypes) ? snapshotData.taskTypes.length : 0,
    dailyRecords: Object.keys(snapshotData.dailyRecords || {}).length,
    weeklySummaries: Object.keys(snapshotData.weeklySummaries || {}).length,
  };
}

function downloadJsonPayload(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeImportPayload(rawData = {}, basePreferences = {}) {
  const parsed = rawData && typeof rawData === "object" ? rawData : {};
  return {
    taskTypes: Array.isArray(parsed.taskTypes) ? parsed.taskTypes : [],
    dailyRecords: parsed.dailyRecords && typeof parsed.dailyRecords === "object" ? parsed.dailyRecords : {},
    weeklySummaries: parsed.weeklySummaries && typeof parsed.weeklySummaries === "object" ? parsed.weeklySummaries : {},
    preferences: normalizePreferences({
      ...basePreferences,
      ...(parsed.preferences || {}),
    }),
  };
}

function buildExportPayload(snapshotData) {
  return {
    exportedAt: new Date().toISOString(),
    data: snapshotData,
  };
}

function loadSafetyBackup() {
  try {
    const raw = localStorage.getItem(SAFETY_BACKUP_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function saveSafetyBackup(snapshotData, reason = "manual") {
  const payload = {
    id: `backup-${Date.now()}`,
    reason,
    createdAt: new Date().toISOString(),
    data: snapshotData,
  };
  localStorage.setItem(SAFETY_BACKUP_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

function appendSyncNotice(notices, message, tone = "default") {
  return [
    {
      id: `notice-${Date.now()}`,
      message,
      tone,
      createdAt: new Date().toISOString(),
    },
    ...(Array.isArray(notices) ? notices : []),
  ].slice(0, 12);
}

function createLocalProfilePayload(sessionUser = null, syncProfileData = null) {
  return {
    user: sessionUser || null,
    counts: {
      tasks: Number(syncProfileData?.counts?.tasks || 0),
      dailyRecords: Number(syncProfileData?.counts?.dailyRecords || 0),
      weeklySummaries: Number(syncProfileData?.counts?.weeklySummaries || 0),
    },
  };
}

export const useAccountStore = defineStore("account", {
  state: () => ({
    menuOpen: false,
    profileOpen: false,
    syncOpen: false,
    passwordOpen: false,
    widgetSettingsOpen: false,
    widgetSettingsKey: "",
    profileLoading: false,
    profileData: null,
    syncProfileLoading: false,
    syncProfileData: null,
    profileFeedback: "",
    widgetSettingsFeedback: "",
    securityFeedback: "",
    dangerFeedback: "",
    recoveryCode: "",
    recoveryBusy: false,
    passwordBusy: false,
    passwordFeedback: "",
    widgetSettingsBusy: false,
    usernameBusy: false,
    signOutAllBusy: false,
    clearDataBusy: false,
    deleteAccountBusy: false,
    profileRequestId: 0,
    transferBusy: false,
    transferMode: "merge",
    replaceImportConfirmed: false,
    syncFeedbackNotice: null,
    forms: createEmptyForms(),
    safetyBackup: loadSafetyBackup(),
  }),
  getters: {
    syncNotices() {
      const sessionStore = useSessionStore();
      const persisted = sessionStore.user?.preferences?.sync?.notices || [];
      return [this.syncFeedbackNotice, ...persisted].filter(Boolean).slice(0, 12);
    },
    syncCounts(state) {
      return {
        tasks: Number(state.syncProfileData?.counts?.tasks || 0),
        dailyRecords: Number(state.syncProfileData?.counts?.dailyRecords || 0),
        weeklySummaries: Number(state.syncProfileData?.counts?.weeklySummaries || 0),
      };
    },
  },
  actions: {
    setSyncFeedback(message, tone = "default") {
      if (!message) {
        this.syncFeedbackNotice = null;
        return;
      }
      this.syncFeedbackNotice = {
        id: `local-notice-${Date.now()}`,
        message,
        tone,
        createdAt: new Date().toISOString(),
      };
    },
    closeMenu() {
      this.menuOpen = false;
    },
    toggleMenu() {
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        return;
      }
      this.menuOpen = !this.menuOpen;
    },
    closeProfile() {
      this.profileRequestId += 1;
      this.profileOpen = false;
      this.profileLoading = false;
    },
    closeAllModals() {
      this.closeProfile();
      this.syncOpen = false;
      this.passwordOpen = false;
      this.widgetSettingsOpen = false;
      this.widgetSettingsKey = "";
      this.transferBusy = false;
      this.passwordBusy = false;
      this.widgetSettingsBusy = false;
      this.recoveryBusy = false;
      this.usernameBusy = false;
      this.signOutAllBusy = false;
      this.clearDataBusy = false;
      this.deleteAccountBusy = false;
    },
    openWidgetSettings(widget) {
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        return;
      }
      if (!["favorites", "weather", "stock"].includes(widget)) {
        return;
      }
      this.closeMenu();
      this.populateProfileForms(sessionStore.user.preferences || {}, sessionStore.user.username || "");
      this.widgetSettingsKey = widget;
      this.widgetSettingsOpen = true;
      this.widgetSettingsFeedback = "";
    },
    closeWidgetSettings() {
      this.widgetSettingsOpen = false;
      this.widgetSettingsKey = "";
      this.widgetSettingsFeedback = "";
      this.widgetSettingsBusy = false;
    },
    populateProfileForms(preferences = {}, username = "") {
      const normalized = normalizePreferences(preferences);
      const sessionStore = useSessionStore();
      this.forms.profile = {
        sidebar: { ...normalized.sidebar },
        profile: { ...normalized.profile },
        widgets: {
          github: { ...normalized.widgets.github },
          favorites: { ...normalized.widgets.favorites },
          weather: { ...normalized.widgets.weather },
          stock: { ...normalized.widgets.stock },
        },
      };
      this.forms.account = {
        username: String(username || sessionStore.user?.username || "").trim(),
        currentPassword: "",
        deletePassword: "",
      };
    },
    async refreshSyncProfile() {
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        this.syncProfileData = null;
        return null;
      }

      this.syncProfileLoading = true;
      try {
        const payload = await fetchAccountProfile();
        this.syncProfileData = payload;
        return payload;
      } finally {
        this.syncProfileLoading = false;
      }
    },
    async openProfile() {
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        return;
      }
      const requestId = this.profileRequestId + 1;
      this.profileRequestId = requestId;
      this.closeMenu();
      this.profileOpen = true;
      this.profileLoading = true;
      this.profileData = createLocalProfilePayload(sessionStore.user, this.syncProfileData);
      this.recoveryCode = "";
      this.profileFeedback = "";
      this.securityFeedback = "";
      this.dangerFeedback = "";
      this.populateProfileForms(sessionStore.user.preferences || {}, sessionStore.user.username || "");
      try {
        const payload = await this.refreshSyncProfile();
        if (this.profileRequestId !== requestId || !this.profileOpen) {
          return;
        }
        this.profileData = payload;
        this.populateProfileForms(
          payload?.user?.preferences || sessionStore.user.preferences || {},
          payload?.user?.username || sessionStore.user.username || "",
        );
      } catch (error) {
        if (this.profileRequestId !== requestId || !this.profileOpen) {
          return;
        }
        this.profileFeedback = getUserFacingErrorMessage(error, "暂时无法读取当前账号资料。");
      } finally {
        if (this.profileRequestId === requestId) {
          this.profileLoading = false;
        }
      }
    },
    async openSyncCenter() {
      this.closeMenu();
      this.syncOpen = true;
      this.transferMode = "merge";
      this.replaceImportConfirmed = false;
      this.setSyncFeedback("");
      this.safetyBackup = loadSafetyBackup();
      try {
        await this.refreshSyncProfile();
      } catch (error) {
        this.setSyncFeedback(getUserFacingErrorMessage(error, "暂时无法读取账号统计。"));
      }
    },
    openPasswordModal() {
      this.closeMenu();
      this.passwordOpen = true;
      this.passwordFeedback = "";
      this.forms.password = createEmptyForms().password;
    },
    syncProfileUser(user) {
      const sessionStore = useSessionStore();
      if (!user?.username || !sessionStore.user) {
        return;
      }
      sessionStore.user = {
        ...sessionStore.user,
        username: user.username,
        preferences: user.preferences || sessionStore.user.preferences || {},
      };
      if (this.profileData?.user) {
        this.profileData = {
          ...this.profileData,
          user: {
            ...this.profileData.user,
            username: user.username,
            preferences: user.preferences || this.profileData.user.preferences || {},
          },
        };
      }
      this.forms.account.username = user.username;
      saveAuthConfig({ username: user.username });
    },
    async persistPreferences(reasonMessage = "设置已保存") {
      const sessionStore = useSessionStore();
      const homeStore = useHomeStore();
      if (!sessionStore.user?.id) {
        return;
      }

      const nextPreferences = normalizePreferences({
        ...(sessionStore.user.preferences || {}),
        sidebar: this.forms.profile.sidebar,
        profile: this.forms.profile.profile,
        widgets: this.forms.profile.widgets,
        sync: {
          ...(sessionStore.user.preferences?.sync || {}),
          notices: appendSyncNotice(sessionStore.user.preferences?.sync?.notices, reasonMessage, "success"),
          lastSuccessfulSyncAt: new Date().toISOString(),
          lastSyncAttemptAt: new Date().toISOString(),
        },
      });
      const response = await saveAccountPreferences(nextPreferences);
      sessionStore.setPreferences(response?.preferences || nextPreferences);
      await homeStore.bootstrap();
    },
    async saveProfile() {
      try {
        await this.persistPreferences("账号资料设置已保存");
        this.profileFeedback = "账号资料设置已保存";
      } catch (error) {
        this.profileFeedback = getUserFacingErrorMessage(error, "保存账号设置失败");
      }
    },
    async saveWidgetSettings() {
      const widget = this.widgetSettingsKey;
      if (!["favorites", "weather", "stock"].includes(widget)) {
        return;
      }

      this.widgetSettingsBusy = true;
      this.widgetSettingsFeedback = "正在保存组件设置...";
      try {
        const label = widget === "favorites" ? "Favorites" : widget === "weather" ? "Weather" : "Stock";
        await this.persistPreferences(`${label} 设置已保存`);
        this.widgetSettingsFeedback = `${label} 设置已保存`;
        this.widgetSettingsOpen = false;
        this.widgetSettingsKey = "";
      } catch (error) {
        this.widgetSettingsFeedback = getUserFacingErrorMessage(error, "保存组件设置失败");
      } finally {
        this.widgetSettingsBusy = false;
      }
    },
    async regenerateRecoveryCode() {
      this.recoveryBusy = true;
      this.profileFeedback = "正在生成新的恢复码...";
      try {
        const payload = await generateRecoveryCode();
        this.recoveryCode = payload?.recoveryCode || "";
        this.profileFeedback = this.recoveryCode ? "新的恢复码已生成，请立即保存。" : "恢复码已更新。";
      } catch (error) {
        this.profileFeedback = getUserFacingErrorMessage(error, "生成恢复码失败");
      } finally {
        this.recoveryBusy = false;
      }
    },
    async savePassword() {
      const { currentPassword, newPassword, confirmPassword } = this.forms.password;
      if (!currentPassword || !newPassword || !confirmPassword) {
        this.passwordFeedback = "请完整填写密码信息。";
        return;
      }
      if (newPassword !== confirmPassword) {
        this.passwordFeedback = "两次输入的新密码不一致。";
        return;
      }
      this.passwordBusy = true;
      this.passwordFeedback = "正在更新密码...";
      try {
        await changePassword(currentPassword, newPassword);
        this.passwordFeedback = "密码已更新";
        this.passwordOpen = false;
        this.forms.password = createEmptyForms().password;
      } catch (error) {
        this.passwordFeedback = getUserFacingErrorMessage(error, "修改密码失败");
      } finally {
        this.passwordBusy = false;
      }
    },
    async saveUsername() {
      const nextUsername = String(this.forms.account.username || "").trim();
      const currentPassword = String(this.forms.account.currentPassword || "");
      if (!nextUsername || !currentPassword) {
        this.securityFeedback = "请填写新用户名和当前密码。";
        return;
      }
      this.usernameBusy = true;
      this.securityFeedback = "正在更新用户名...";
      try {
        const payload = await changeUsername(nextUsername, currentPassword);
        this.syncProfileUser(payload?.user || { username: nextUsername });
        this.forms.account.currentPassword = "";
        this.securityFeedback = "用户名已更新";
      } catch (error) {
        this.securityFeedback = getUserFacingErrorMessage(error, "更新用户名失败");
      } finally {
        this.usernameBusy = false;
      }
    },
    async signOutAllSessions() {
      this.signOutAllBusy = true;
      this.securityFeedback = "正在退出全部登录...";
      try {
        await signOutAllAccounts();
        saveSessionId("");
        const sessionStore = useSessionStore();
        sessionStore.applySession(null, "已退出全部登录");
        this.closeAllModals();
      } catch (error) {
        this.securityFeedback = getUserFacingErrorMessage(error, "退出全部登录失败");
      } finally {
        this.signOutAllBusy = false;
      }
    },
    async resetAccountDataLocally() {
      const sessionStore = useSessionStore();
      clearDashboardSnapshot(sessionStore.user?.id);
      const todayStore = useTodayStore();
      const weeklyStore = useWeeklyStore();
      const homeStore = useHomeStore();
      const contentStore = useContentStore();
      todayStore.$reset();
      weeklyStore.$reset();
      homeStore.$reset();
      contentStore.$reset();
      await Promise.allSettled([
        todayStore.bootstrap(),
        weeklyStore.bootstrap(),
        homeStore.bootstrap(),
      ]);
    },
    async clearAllAccountData() {
      this.clearDataBusy = true;
      this.dangerFeedback = "正在清空当前账号数据...";
      try {
        await clearAccountData();
        await this.resetAccountDataLocally();
        await this.refreshSyncProfile().catch(() => null);
        this.dangerFeedback = "当前账号数据已清空";
      } catch (error) {
        this.dangerFeedback = getUserFacingErrorMessage(error, "清空账号数据失败");
      } finally {
        this.clearDataBusy = false;
      }
    },
    async removeAccount() {
      const password = String(this.forms.account.deletePassword || "");
      if (!password) {
        this.dangerFeedback = "请输入当前密码后再删除账号。";
        return;
      }
      this.deleteAccountBusy = true;
      this.dangerFeedback = "正在删除账号...";
      try {
        const sessionStore = useSessionStore();
        const userId = sessionStore.user?.id;
        await deleteAccount(password);
        saveSessionId("");
        sessionStore.applySession(null, "账号已删除");
        clearDashboardSnapshot(userId);
        this.forms.account.deletePassword = "";
        this.closeAllModals();
        await this.resetAccountDataLocally();
      } catch (error) {
        this.dangerFeedback = getUserFacingErrorMessage(error, "删除账号失败");
      } finally {
        this.deleteAccountBusy = false;
      }
    },
    async collectFullSnapshotData() {
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        throw new Error("请先登录账号后再导出数据");
      }

      const profile = this.syncProfileData?.user?.id === sessionStore.user.id
        ? this.syncProfileData
        : await this.refreshSyncProfile();
      const snapshotData = createEmptySnapshotData(sessionStore.user?.preferences || {});
      const createdAt = parseIsoDate(profile?.user?.createdAt) || new Date();
      const startDate = new Date(createdAt);
      const today = new Date();
      startDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      const dateKeys = buildDateKeysBetween(startDate, today);
      const weekValues = buildWeekValuesBetween(startDate, today);
      const [{ tasks = [] }, dailyResponses, summaryResponses] = await Promise.all([
        listTasks(),
        mapInBatches(dateKeys, 20, (date) => fetchDailyRecord(date)),
        mapInBatches(weekValues, 12, (week) => fetchWeeklySummary(week)),
      ]);

      snapshotData.taskTypes = tasks.map((task) => normalizeTaskForSnapshot(task));

      dailyResponses.forEach((response, index) => {
        const date = dateKeys[index];
        const record = response?.record;
        if (!hasRecordContent(record)) {
          return;
        }
        snapshotData.dailyRecords[date] = {
          date,
          tasks: record?.payload?.tasks || {},
          updatedAt: record?.updatedAt || "",
        };
      });

      summaryResponses.forEach((response, index) => {
        const week = weekValues[index];
        const summary = response?.summary;
        if (!hasSummaryContent(summary)) {
          return;
        }
        snapshotData.weeklySummaries[week] = {
          week,
          content: summary?.content || "",
          updatedAt: summary?.updatedAt || "",
        };
      });

      return snapshotData;
    },
    async exportSnapshot() {
      this.transferBusy = true;
      this.setSyncFeedback("正在读取完整账号快照...");
      try {
        const snapshotData = await this.collectFullSnapshotData();
        const stats = getSnapshotStats(snapshotData);
        saveSafetyBackup(snapshotData, "manual-export");
        this.safetyBackup = loadSafetyBackup();
        const payload = buildExportPayload(snapshotData);
        downloadJsonPayload(`lifeflow-dashboard-${formatDateKey(new Date())}.json`, payload);
        this.setSyncFeedback(
          `当前账号数据已完整导出（任务 ${stats.tasks} 项 · 日记录 ${stats.dailyRecords} 项 · 周总结 ${stats.weeklySummaries} 项）`,
          "success",
        );
      } catch (error) {
        this.setSyncFeedback(getUserFacingErrorMessage(error, "导出当前账号数据失败"));
      } finally {
        this.transferBusy = false;
      }
    },
    downloadLatestSafetyBackup() {
      const backup = loadSafetyBackup();
      if (!backup?.data) {
        this.setSyncFeedback("当前没有可导出的安全备份");
        return;
      }
      downloadJsonPayload(
        `lifeflow-safety-backup-${formatDateKey(new Date(backup.createdAt || Date.now()))}.json`,
        {
          exportedAt: new Date().toISOString(),
          backup,
        },
      );
      this.setSyncFeedback("最近安全备份已导出", "success");
    },
    async restoreSafetyBackup() {
      const backup = loadSafetyBackup();
      if (!backup?.data) {
        this.setSyncFeedback("当前没有可恢复的安全备份");
        return;
      }
      const fileLike = new File([JSON.stringify({ data: backup.data })], "backup.json", { type: "application/json" });
      try {
        await this.importSnapshot(fileLike, "replace");
      } catch (error) {
        this.setSyncFeedback(getUserFacingErrorMessage(error, "恢复最近安全备份失败"));
      }
    },
    setTransferMode(mode) {
      this.transferMode = mode === "replace" ? "replace" : "merge";
      if (this.transferMode !== "replace") {
        this.replaceImportConfirmed = false;
      }
    },
    setReplaceImportConfirmed(value) {
      this.replaceImportConfirmed = Boolean(value);
    },
    async startImportFromFile(file) {
      if (this.transferMode === "replace" && !this.replaceImportConfirmed) {
        this.setSyncFeedback("选择完整覆盖时，请先确认覆盖当前账号数据。");
        return;
      }
      try {
        await this.importSnapshot(file, this.transferMode);
        this.setSyncFeedback(
          this.transferMode === "replace" ? "导入备份已覆盖到当前账号" : "导入备份已合并到当前账号",
          "success",
        );
        this.replaceImportConfirmed = false;
        this.transferMode = "merge";
      } catch (error) {
        this.setSyncFeedback(getUserFacingErrorMessage(error, "导入备份失败"));
      }
    },
    async importSnapshot(file, strategy = "merge") {
      if (!(file instanceof File)) {
        throw new Error("请选择要导入的 JSON 备份文件");
      }

      this.transferBusy = true;
      const sessionStore = useSessionStore();
      const homeStore = useHomeStore();
      try {
        const raw = JSON.parse(await file.text());
        const normalized = normalizeImportPayload(raw?.data || raw, sessionStore.user?.preferences || {});
        const currentSnapshot = await this.collectFullSnapshotData();
        saveSafetyBackup(currentSnapshot, strategy === "replace" ? "before-replace-import" : "before-merge-import");
        this.safetyBackup = loadSafetyBackup();

        const existingResponse = await listTasks();
        const existingTasks = Array.isArray(existingResponse?.tasks) ? existingResponse.tasks : [];
        const existingIds = new Set(existingTasks.map((task) => String(task.id)));
        const importedIds = new Set(normalized.taskTypes.map((task) => String(task.id)));

        if (strategy === "replace") {
          await Promise.all(
            existingTasks
              .filter((task) => !importedIds.has(String(task.id)))
              .map((task) => deleteTask(task.id)),
          );
        }

        for (const task of normalized.taskTypes) {
          const payload = {
            id: task.id,
            name: task.name,
            color: task.color,
            displayOrder: task.order || task.display_order || 1,
            archived: Boolean(task.archived),
            archivedAt: task.archivedAt || task.archived_at || "",
          };
          if (existingIds.has(String(task.id))) {
            await updateTask(task.id, payload);
          } else {
            await createTask(payload);
          }
        }

        for (const [date, record] of Object.entries(normalized.dailyRecords)) {
          const payloadTasks = record?.tasks || record?.payload?.tasks || {};
          await saveDailyRecord(date, {
            tasks: payloadTasks,
          });
        }

        for (const [week, summary] of Object.entries(normalized.weeklySummaries)) {
          await saveWeeklySummary(week, summary?.content || "");
        }

        const importMessage = strategy === "replace" ? "导入备份已覆盖到当前账号" : "导入备份已合并到当前账号";
        const mergedPreferences =
          strategy === "replace"
            ? normalized.preferences
            : normalizePreferences({
                ...(sessionStore.user?.preferences || {}),
                ...(normalized.preferences || {}),
              });
        mergedPreferences.sync = {
          ...(mergedPreferences.sync || createDefaultSyncPreferences()),
          lastSuccessfulSyncAt: new Date().toISOString(),
          lastSyncAttemptAt: new Date().toISOString(),
          notices: appendSyncNotice(mergedPreferences.sync?.notices, importMessage, "success"),
        };
        const response = await saveAccountPreferences(mergedPreferences);
        sessionStore.setPreferences(response?.preferences || mergedPreferences);

        const todayStore = useTodayStore();
        const weeklyStore = useWeeklyStore();
        await Promise.allSettled([todayStore.bootstrap(), weeklyStore.loadCurrentView(), homeStore.bootstrap(), this.refreshSyncProfile()]);
        this.syncOpen = false;
      } finally {
        this.transferBusy = false;
      }
    },
    formatDateTime,
  },
});

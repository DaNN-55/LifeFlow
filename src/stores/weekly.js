import { defineStore } from "pinia";

import { createPeriodReview, reviewPeriods, reviewViews } from "../services/period-review.js";
import { stateContinuity } from "../services/state-continuity.js";
import {
  formatMonthDay,
  formatMonthRangeText,
  formatMonthValue,
  formatTime,
  formatWeekInputValue,
  formatWeekRangeText,
  getMonthlyRangeOptions,
  getWeeklyRangeOptions,
} from "../utils/date.js";
import { getUserFacingErrorMessage } from "../utils/error-message.js";
import { renderTaskNoteMarkdown } from "../utils/markdown.js";
import { useSessionStore } from "./session.js";

let activeScope = null;
let activeReview = null;

function getReview() {
  const session = useSessionStore();
  const identity = session.previewMode
    ? { id: "demo", mode: "demo" }
    : { id: session.user?.id };
  if (!identity.id) return null;
  const scope = stateContinuity.open(identity);
  if (activeReview && activeScope === scope) return activeReview;
  activeScope = scope;
  activeReview = createPeriodReview(scope);
  return activeReview;
}

function reviewProjection(store) {
  const review = getReview();
  if (!review) return null;
  const filters = { ...store.filters };
  return store.mode === "month"
    ? review.view(reviewViews.month(reviewPeriods.month(store.selectedMonth), filters))
    : review.view(reviewViews.week(reviewPeriods.week(store.selectedWeek), filters));
}

function overviewProjection(store) {
  const review = getReview();
  return review?.view(reviewViews.statusOverview(reviewPeriods.month(store.selectedMonth))) || null;
}

function timelineProjection() {
  return getReview()?.view(reviewViews.timeline()) || null;
}

export const useWeeklyStore = defineStore("weekly", {
  state: () => ({
    mode: "week",
    selectedWeek: formatWeekInputValue(new Date()),
    selectedMonth: formatMonthValue(new Date()),
    filters: { taskId: "all", completion: "all", archive: "all" },
    summaryDrafts: {},
    summaryModes: {},
    summaryDialogOpen: false,
    saveStatus: "",
    actionError: "",
  }),
  getters: {
    loading(state) {
      return reviewProjection(state)?.activity === "syncing";
    },
    error(state) {
      return state.actionError || (reviewProjection(state)?.issue === "error" ? "周期复盘加载失败" : "");
    },
    status(state) {
      const projection = reviewProjection(state);
      if (state.saveStatus) return state.saveStatus;
      if (projection?.issue === "offline") return "当前离线，已显示最近一次同步内容";
      if (projection?.freshness === "demo") return "Demo 数据仅保存在独立的本地空间";
      if (projection?.freshness === "cached") return "已从本地缓存载入周期复盘";
      return "";
    },
    weekOptions: () => getWeeklyRangeOptions(),
    monthOptions: () => getMonthlyRangeOptions(),
    rangeOptions(state) {
      return state.mode === "month" ? this.monthOptions : this.weekOptions;
    },
    currentRangeLabel(state) {
      return state.mode === "month" ? formatMonthRangeText(state.selectedMonth) : formatWeekRangeText(state.selectedWeek);
    },
    timelineTasks() {
      return timelineProjection()?.data?.tasks || [];
    },
    visibleTasks(state) {
      return reviewProjection(state)?.data?.visibleTasks || [];
    },
    taskFilterOptions(state) {
      return reviewProjection(state)?.data?.taskFilterOptions || [{ value: "all", label: "全部任务" }];
    },
    completionFilterOptions: () => [
      { value: "all", label: "状态: 全部" },
      { value: "completed", label: "状态: 已完成" },
      { value: "incomplete", label: "状态: 未完成" },
    ],
    archiveFilterOptions: () => [
      { value: "all", label: "存档: 全部" },
      { value: "active", label: "存档: 未存档" },
      { value: "archived", label: "存档: 已存档" },
    ],
    currentSummary(state) {
      const summary = reviewProjection(state)?.data?.summary;
      return summary || { week: state.selectedWeek, content: "", rawUpdatedAt: "" };
    },
    currentSummaryDraftKey(state) {
      const session = useSessionStore();
      const identity = session.previewMode ? "demo" : String(session.user?.id || "guest");
      return `${identity}:${state.selectedWeek}`;
    },
    currentSummaryDraft(state) {
      return typeof state.summaryDrafts[this.currentSummaryDraftKey] === "string"
        ? state.summaryDrafts[this.currentSummaryDraftKey]
        : this.currentSummary.content || "";
    },
    currentSummaryMode(state) {
      return typeof state.summaryModes[this.currentSummaryDraftKey] === "string"
        ? state.summaryModes[this.currentSummaryDraftKey]
        : (this.currentSummary.content ? "view" : "edit");
    },
    summaryMeta(state) {
      if (state.mode === "month") return `当前月：${formatMonthRangeText(state.selectedMonth)} · 按月模式下不编辑周总结`;
      let meta = `当前周：${formatWeekRangeText(state.selectedWeek)}`;
      if (this.currentSummary.rawUpdatedAt) {
        const date = new Date(this.currentSummary.rawUpdatedAt);
        meta += ` · 已保存 ${formatMonthDay(date)} ${formatTime(date)}`;
      } else meta += " · 尚未保存";
      if (this.currentSummaryDraft !== this.currentSummary.content) meta += " · 有未保存修改";
      return meta;
    },
    summaryDisplayHtml() {
      return renderTaskNoteMarkdown(this.currentSummary.content || "");
    },
    monthSummaryEntries(state) {
      return overviewProjection(state)?.data?.summaryEntries || [];
    },
    monthOverview(state) {
      return overviewProjection(state)?.data || {
        label: formatMonthRangeText(state.selectedMonth),
        activeTaskCount: 0,
        completionDays: 0,
        noteCount: 0,
        writtenSummaryCount: 0,
        rankedTasks: [],
        summaries: [],
        summaryEntries: [],
        pendingSummary: null,
        missingSummaries: [],
        progressDenominator: 0,
        totalDays: 0,
      };
    },
  },
  actions: {
    setSaveStatus(message) {
      this.saveStatus = message;
    },
    async setMode(mode) {
      this.mode = mode === "month" ? "month" : "week";
      this.syncTaskFilterSelection();
    },
    async setSelectedWeek(week) {
      reviewPeriods.week(week);
      this.selectedWeek = week;
      this.syncTaskFilterSelection();
    },
    async setSelectedMonth(month) {
      reviewPeriods.month(month);
      this.selectedMonth = month;
      this.syncTaskFilterSelection();
    },
    setFilter(key, value) {
      this.filters = { ...this.filters, [key]: value };
    },
    syncTaskFilterSelection() {
      if (this.filters.taskId !== "all" && !this.taskFilterOptions.some((item) => item.value === this.filters.taskId)) {
        this.filters = { ...this.filters, taskId: "all" };
      }
    },
    updateSummaryDraft(value) {
      this.summaryDrafts = { ...this.summaryDrafts, [this.currentSummaryDraftKey]: value };
    },
    setSummaryMode(mode) {
      this.summaryModes = { ...this.summaryModes, [this.currentSummaryDraftKey]: mode };
    },
    openSummaryDialog() {
      this.summaryDialogOpen = true;
    },
    closeSummaryDialog() {
      this.summaryDialogOpen = false;
    },
    async saveSummary() {
      const review = getReview();
      if (!review) return false;
      const content = String(this.currentSummaryDraft || "").trim();
      this.actionError = "";
      try {
        await review.saveWeeklySummary({ period: reviewPeriods.week(this.selectedWeek), content });
        this.summaryDrafts = { ...this.summaryDrafts, [this.currentSummaryDraftKey]: content };
        this.summaryModes = { ...this.summaryModes, [this.currentSummaryDraftKey]: content ? "view" : "edit" };
        this.summaryDialogOpen = false;
        this.setSaveStatus(`已保存 ${formatWeekRangeText(this.selectedWeek)} 的周总结`);
        return true;
      } catch (error) {
        this.actionError = getUserFacingErrorMessage(error, "周总结保存失败");
        this.setSaveStatus(this.actionError);
        return false;
      }
    },
  },
});

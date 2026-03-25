import { defineStore } from "pinia";

import {
  fetchDailyRecord,
  fetchTaskTimeline,
  fetchWeeklySummary,
  listTasks,
  saveWeeklySummary,
} from "../services/weekly-api";
import {
  loadCachedHomeData,
  loadCachedDailyRecord,
  loadCachedDailyRecords,
  loadCachedTasks,
  loadDashboardUserCache,
  loadCachedWeeklySummary,
  saveCachedHomeData,
  saveCachedDailyRecords,
  saveCachedTasks,
  saveCachedWeeklySummary,
} from "../services/dashboard-cache";
import { updateTask } from "../services/today-api";
import {
  addDays,
  formatDateKey,
  formatMonthDay,
  formatMonthRangeText,
  formatMonthValue,
  formatTime,
  formatWeekInputValue,
  formatWeekRangeText,
  getMonthRange,
  getMonthlyRangeOptions,
  getStartOfWeek,
  getWeekRangeFromWeekValue,
  getWeeklyRangeOptions,
  parseLocalDate,
} from "../utils/date";
import { getUserFacingErrorMessage } from "../utils/error-message";
import { renderTaskNoteMarkdown } from "../utils/markdown";
import { useSessionStore } from "./session";

function normalizeTask(task = {}, index = 0) {
  return {
    id: String(task.id || ""),
    name: String(task.name || "未命名任务"),
    color: String(task.color || "#4f46e5"),
    order: Number(task.display_order || index + 1),
    archived: Boolean(task.archived),
    archivedAt: task.archived_at || "",
  };
}

function createAggregation(tasks = [], totalDays = 7) {
  const presenceCounts = {};
  const completionCounts = {};
  const notesByTask = {};
  const eventsByTask = {};

  tasks.forEach((task) => {
    presenceCounts[task.id] = 0;
    completionCounts[task.id] = 0;
    notesByTask[task.id] = [];
    eventsByTask[task.id] = [];
  });

  return {
    tasks,
    presenceCounts,
    completionCounts,
    notesByTask,
    eventsByTask,
    totalDays,
  };
}

function hasTaskHistory(aggregation, taskId) {
  return (
    Number(aggregation?.presenceCounts?.[taskId] || 0) > 0 ||
    Number(aggregation?.completionCounts?.[taskId] || 0) > 0 ||
    (Array.isArray(aggregation?.notesByTask?.[taskId]) && aggregation.notesByTask[taskId].length > 0)
  );
}

function hasAnyTaskHistory(aggregation) {
  return (aggregation?.tasks || []).some((task) => hasTaskHistory(aggregation, task.id));
}

function buildMonthDateKeys(monthValue) {
  const range = getMonthRange(monthValue);
  const dates = [];

  for (let cursor = new Date(range.start); cursor <= range.end; cursor = addDays(cursor, 1)) {
    dates.push(formatDateKey(cursor));
  }

  return dates;
}

function buildWeekDateKeys(weekValue) {
  const range = getWeekRangeFromWeekValue(weekValue);
  const dates = [];

  for (let cursor = new Date(range.start); cursor <= range.end; cursor = addDays(cursor, 1)) {
    dates.push(formatDateKey(cursor));
  }

  return dates;
}

function buildDateKeysBetween(startDate, endDate) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const dates = [];

  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(formatDateKey(cursor));
  }

  return dates;
}

function buildRecentDateKeys(totalDays = 31) {
  const days = Math.max(1, Number(totalDays || 31));
  const end = new Date();
  const start = addDays(end, -(days - 1));
  const dates = [];

  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(formatDateKey(cursor));
  }

  return dates;
}

function getMonthWeekValues(monthValue) {
  const { start, end } = getMonthRange(monthValue);
  const weeks = [];

  for (let cursor = getStartOfWeek(start); cursor <= end; cursor = addDays(cursor, 7)) {
    weeks.push(formatWeekInputValue(cursor));
  }

  return Array.from(new Set(weeks));
}

function stripMarkdownToPlainText(content = "") {
  return String(content || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSummaryExcerpt(content = "", maxLength = 84) {
  const text = stripMarkdownToPlainText(content);
  if (!text) {
    return "";
  }
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function buildCachedTimelineAggregation(userId) {
  const cache = loadDashboardUserCache(userId);
  const tasks = Array.isArray(cache?.tasks) ? cache.tasks : [];
  const records = Object.values(cache?.dailyRecords || {})
    .filter((record) => record && typeof record === "object" && record.date)
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));
  const dateKeys = records.map((record) => String(record.date));
  const normalizedTasks = tasks.map(normalizeTask).sort((left, right) => left.order - right.order);
  return buildAggregationFromRecords(normalizedTasks, dateKeys, records, Math.max(dateKeys.length, 1));
}

function normalizeTimelineNotes(notes = [], recordDate) {
  return Array.isArray(notes)
    ? notes.map((note, index) => ({
        id: String(note?.id || `${recordDate}-note-${index + 1}`),
        text: String(note?.text || ""),
        createdAt: String(note?.createdAt || note?.created_at || `${recordDate}T00:00:00.000Z`),
      }))
    : [];
}

function createEmptyRecord(recordDate) {
  return {
    date: recordDate,
    updatedAt: "",
    payload: { tasks: {} },
  };
}

function buildTimelineEntries(taskId, dateKeys = [], responses = []) {
  return dateKeys
    .map((recordDate, index) => {
      const record = responses[index]?.record;
      const payloadTasks = record?.payload?.tasks || {};
      const taskState = payloadTasks[taskId];

      if (!taskState) {
        return null;
      }

      const notes = normalizeTimelineNotes(taskState.notes, recordDate);
      const completed = Boolean(taskState.completed);

      if (!completed && notes.length === 0) {
        return null;
      }

      return {
        dateKey: recordDate,
        dateLabel: formatMonthDay(parseLocalDate(recordDate)),
        completed,
        notes,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.dateKey.localeCompare(left.dateKey));
}

function buildAggregationFromRecords(tasks = [], dateKeys = [], records = [], totalDays = 7) {
  const aggregation = createAggregation(tasks, totalDays);

  records.forEach((record, index) => {
    const recordDate = dateKeys[index];
    const payloadTasks = record?.payload?.tasks || {};

    tasks.forEach((task) => {
      const taskState = payloadTasks[task.id];
      if (!taskState) {
        return;
      }
      aggregation.presenceCounts[task.id] += 1;
      if (taskState.completed) {
        aggregation.completionCounts[task.id] += 1;
      }
      for (const note of taskState.notes || []) {
        aggregation.notesByTask[task.id].push({
          dateLabel: formatMonthDay(parseLocalDate(recordDate)),
          note: note.text,
          createdAt: note.createdAt || note.created_at || `${recordDate}T00:00:00.000Z`,
        });
      }
    });
  });

  Object.keys(aggregation.notesByTask).forEach((taskId) => {
    aggregation.notesByTask[taskId].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    aggregation.eventsByTask[taskId] = buildTimelineEntries(
      taskId,
      dateKeys,
      records.map((record) => ({ record })),
    );
  });

  return aggregation;
}

async function fetchFreshWeekRecords(dateKeys = []) {
  const records = await Promise.all(
    dateKeys.map((date) =>
      fetchDailyRecord(date)
        .then((payload) => payload?.record || createEmptyRecord(date))
        .catch(() => createEmptyRecord(date)),
    ),
  );
  return records;
}

export const useWeeklyStore = defineStore("weekly", {
  state: () => ({
    loading: false,
    error: "",
    mode: "week",
    selectedWeek: formatWeekInputValue(new Date()),
    selectedMonth: formatMonthValue(new Date()),
    filters: {
      taskId: "all",
      completion: "all",
      archive: "all",
    },
    aggregation: createAggregation([], 7),
    timelineAggregation: createAggregation([], 31),
    summaryByWeek: {},
    summaryDrafts: {},
    summaryModes: {},
    summaryDialogOpen: false,
    saveStatus: "",
  }),
  getters: {
    weekOptions() {
      return getWeeklyRangeOptions();
    },
    monthOptions() {
      return getMonthlyRangeOptions();
    },
    taskFilterOptions(state) {
      return [
        { value: "all", label: "全部任务" },
        ...state.aggregation.tasks.map((task) => ({ value: task.id, label: task.name })),
      ];
    },
    completionFilterOptions() {
      return [
        { value: "all", label: "状态: 全部" },
        { value: "completed", label: "状态: 已完成" },
        { value: "incomplete", label: "状态: 未完成" },
      ];
    },
    archiveFilterOptions() {
      return [
        { value: "all", label: "存档: 全部" },
        { value: "active", label: "存档: 未存档" },
        { value: "archived", label: "存档: 已存档" },
      ];
    },
    rangeOptions(state) {
      return state.mode === "month" ? this.monthOptions : this.weekOptions;
    },
    visibleTasks(state) {
      return state.aggregation.tasks
        .filter((task) => hasTaskHistory(state.aggregation, task.id))
        .filter((task) => {
          const completionCount = state.aggregation.completionCounts[task.id] || 0;

          if (state.filters.taskId !== "all" && state.filters.taskId !== task.id) {
            return false;
          }
          if (state.filters.archive === "archived" && !task.archived) {
            return false;
          }
          if (state.filters.archive === "active" && task.archived) {
            return false;
          }
          if (state.filters.completion === "completed" && completionCount === 0) {
            return false;
          }
          if (state.filters.completion === "incomplete" && completionCount > 0) {
            return false;
          }
          return true;
        })
        .sort((left, right) => left.order - right.order);
    },
    currentSummary(state) {
      return state.summaryByWeek[state.selectedWeek] || { week: state.selectedWeek, content: "", updatedAt: "" };
    },
    currentSummaryDraft(state) {
      if (typeof state.summaryDrafts[state.selectedWeek] === "string") {
        return state.summaryDrafts[state.selectedWeek];
      }
      return state.summaryByWeek[state.selectedWeek]?.content || "";
    },
    currentSummaryMode(state) {
      if (typeof state.summaryModes[state.selectedWeek] === "string") {
        return state.summaryModes[state.selectedWeek];
      }
      return state.summaryByWeek[state.selectedWeek]?.content ? "view" : "edit";
    },
    currentRangeLabel(state) {
      return state.mode === "month" ? formatMonthRangeText(state.selectedMonth) : formatWeekRangeText(state.selectedWeek);
    },
    summaryMeta(state) {
      if (state.mode === "month") {
        return `当前月：${formatMonthRangeText(state.selectedMonth)} · 按月模式下不编辑周总结`;
      }

      const summary = state.summaryByWeek[state.selectedWeek];
      const savedContent = summary?.content || "";
      const draft = this.currentSummaryDraft;
      const hasUnsavedChanges = draft !== savedContent;

      let meta = `当前周：${formatWeekRangeText(state.selectedWeek)}`;
      if (summary?.updatedAt) {
        meta += ` · 已保存 ${formatMonthDay(new Date(summary.updatedAt))} ${formatTime(new Date(summary.updatedAt))}`;
      } else {
        meta += " · 尚未保存";
      }
      if (hasUnsavedChanges) {
        meta += " · 有未保存修改";
      }
      return meta;
    },
    summaryDisplayHtml() {
      return renderTaskNoteMarkdown(this.currentSummary.content || "");
    },
    monthSummaryEntries(state) {
      return getMonthWeekValues(state.selectedMonth).map((week) => {
        const summary = state.summaryByWeek[week] || { content: "", updatedAt: "" };
        return {
          week,
          label: formatWeekRangeText(week),
          content: summary.content || "",
          excerpt: buildSummaryExcerpt(summary.content || ""),
          updatedAt: summary.updatedAt
            ? `${formatMonthDay(new Date(summary.updatedAt))} ${formatTime(new Date(summary.updatedAt))}`
            : "",
        };
      });
    },
    monthOverview(state) {
      const rankedTasks = state.aggregation.tasks
        .filter((task) => hasTaskHistory(state.aggregation, task.id))
        .sort((left, right) => {
          const leftCompletionDays = state.aggregation.completionCounts[left.id] || 0;
          const rightCompletionDays = state.aggregation.completionCounts[right.id] || 0;
          const leftNotes = state.aggregation.notesByTask[left.id]?.length || 0;
          const rightNotes = state.aggregation.notesByTask[right.id]?.length || 0;
          return rightCompletionDays - leftCompletionDays || rightNotes - leftNotes || left.order - right.order;
        });
      const summaryEntries = this.monthSummaryEntries;
      const writtenSummaries = summaryEntries.filter((entry) => entry.content.trim().length > 0);

      return {
        label: formatMonthRangeText(state.selectedMonth),
        activeTaskCount: rankedTasks.length,
        completionDays: Object.values(state.aggregation.completionCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0),
        noteCount: Object.values(state.aggregation.notesByTask || {}).reduce((sum, notes) => sum + (Array.isArray(notes) ? notes.length : 0), 0),
        writtenSummaryCount: writtenSummaries.length,
        rankedTasks: rankedTasks.map((task) => ({
          id: task.id,
          name: task.name,
          color: task.color,
          completionCount: state.aggregation.completionCounts[task.id] || 0,
          noteCount: state.aggregation.notesByTask[task.id]?.length || 0,
          notes: state.aggregation.notesByTask[task.id] || [],
        })),
        summaries: writtenSummaries,
        totalDays: state.aggregation.totalDays,
      };
    },
  },
  actions: {
    setSaveStatus(message) {
      this.saveStatus = message;
    },
    handleActionError(error, fallbackMessage) {
      this.error = getUserFacingErrorMessage(error, fallbackMessage);
      this.setSaveStatus(this.error);
    },
    ensureSummaryState(week, summary) {
      this.summaryByWeek = {
        ...this.summaryByWeek,
        [week]: summary,
      };
      if (typeof this.summaryDrafts[week] !== "string") {
        this.summaryDrafts = {
          ...this.summaryDrafts,
          [week]: summary.content || "",
        };
      }
      if (typeof this.summaryModes[week] !== "string") {
        this.summaryModes = {
          ...this.summaryModes,
          [week]: summary.content ? "view" : "edit",
        };
      }
    },
    async bootstrap() {
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        return;
      }
      await this.loadCurrentView();
    },
    async loadCurrentView() {
      this.loading = true;
      this.error = "";
      try {
        if (this.mode === "month") {
          await this.loadMonthReview();
        } else {
          await this.loadWeekReview();
        }
      } catch (error) {
        this.error = getUserFacingErrorMessage(error, "Weekly 模块加载失败");
        this.setSaveStatus(this.error);
      } finally {
        this.loading = false;
      }
    },
    async loadWeekReview() {
      const sessionStore = useSessionStore();
      const userId = sessionStore.user?.id;
      const dateKeys = buildWeekDateKeys(this.selectedWeek);
      let tasks = loadCachedTasks(userId);
      if (!tasks.length) {
        const taskPayload = await listTasks();
        tasks = taskPayload?.tasks || [];
        saveCachedTasks(userId, tasks);
      }

      const cachedRecords = loadCachedDailyRecords(userId, dateKeys);
      const missingDateKeys = dateKeys.filter((_, index) => !cachedRecords[index]);
      if (missingDateKeys.length) {
        const fetchedRecords = await Promise.all(
          missingDateKeys.map((date) =>
            fetchDailyRecord(date)
              .then((payload) => payload?.record || createEmptyRecord(date))
              .catch(() => createEmptyRecord(date)),
          ),
        );
        saveCachedDailyRecords(userId, fetchedRecords);
      }

      const records = dateKeys.map((date) => loadCachedDailyRecord(userId, date) || createEmptyRecord(date));
      let normalizedTasks = tasks.map(normalizeTask).sort((left, right) => left.order - right.order);
      let aggregation = buildAggregationFromRecords(normalizedTasks, dateKeys, records, 7);

      if (normalizedTasks.length && !hasAnyTaskHistory(aggregation)) {
        const [freshTaskPayload, freshRecords] = await Promise.all([
          listTasks().catch(() => ({ tasks })),
          fetchFreshWeekRecords(dateKeys),
        ]);
        tasks = freshTaskPayload?.tasks || tasks;
        normalizedTasks = tasks.map(normalizeTask).sort((left, right) => left.order - right.order);
        saveCachedTasks(userId, tasks);
        saveCachedDailyRecords(userId, freshRecords);
        aggregation = buildAggregationFromRecords(normalizedTasks, dateKeys, freshRecords, 7);
      }

      let summary = loadCachedWeeklySummary(userId, this.selectedWeek);
      if (!summary) {
        const summaryPayload = await fetchWeeklySummary(this.selectedWeek);
        summary = {
          week: this.selectedWeek,
          content: summaryPayload?.summary?.content || "",
          updatedAt: summaryPayload?.summary?.updatedAt || "",
        };
        saveCachedWeeklySummary(userId, summary);
      }

      this.aggregation = aggregation;
      this.ensureSummaryState(this.selectedWeek, {
        week: this.selectedWeek,
        content: summary?.content || "",
        updatedAt: summary?.updatedAt || "",
      });
      this.setSaveStatus(`已从本地缓存载入 ${formatWeekRangeText(this.selectedWeek)} 的周复盘`);
    },
    async loadMonthReview() {
      const sessionStore = useSessionStore();
      const userId = sessionStore.user?.id;
      let tasks = loadCachedTasks(userId);
      if (!tasks.length) {
        const taskPayload = await listTasks();
        tasks = taskPayload?.tasks || [];
        saveCachedTasks(userId, tasks);
      }

      const normalizedTasks = tasks.map(normalizeTask).sort((left, right) => left.order - right.order);
      const dateKeys = buildMonthDateKeys(this.selectedMonth);
      const cachedRecords = loadCachedDailyRecords(userId, dateKeys);
      const missingDateKeys = dateKeys.filter((_, index) => !cachedRecords[index]);
      if (missingDateKeys.length) {
        const fetchedRecords = await Promise.all(
          missingDateKeys.map((date) =>
            fetchDailyRecord(date)
              .then((payload) => payload?.record || createEmptyRecord(date))
              .catch(() => createEmptyRecord(date)),
          ),
        );
        saveCachedDailyRecords(userId, fetchedRecords);
      }

      const records = dateKeys.map((date) => loadCachedDailyRecord(userId, date) || createEmptyRecord(date));
      const aggregation = buildAggregationFromRecords(normalizedTasks, dateKeys, records, dateKeys.length);

      const summaryWeeks = getMonthWeekValues(this.selectedMonth);
      const missingWeeks = summaryWeeks.filter((week) => !loadCachedWeeklySummary(userId, week));
      if (missingWeeks.length) {
        const fetchedSummaries = await Promise.all(
          missingWeeks.map(async (week) => {
            const summaryPayload = await fetchWeeklySummary(week).catch(() => ({ summary: null }));
            const summary = {
              week,
              content: summaryPayload?.summary?.content || "",
              updatedAt: summaryPayload?.summary?.updatedAt || "",
            };
            saveCachedWeeklySummary(userId, summary);
            return summary;
          }),
        );
        fetchedSummaries.forEach((summary) => {
          this.ensureSummaryState(summary.week, summary);
        });
      }

      summaryWeeks.forEach((week) => {
        const summary = loadCachedWeeklySummary(userId, week) || { week, content: "", updatedAt: "" };
        this.ensureSummaryState(week, summary);
      });

      this.aggregation = aggregation;
      this.setSaveStatus(`已从本地缓存载入 ${formatMonthRangeText(this.selectedMonth)} 的月度复盘`);
    },
    async loadTimelineView() {
      const sessionStore = useSessionStore();
      const userId = sessionStore.user?.id;
      if (!userId) {
        return;
      }

      this.loading = true;
      this.error = "";
      try {
        const cachedHome = loadCachedHomeData(userId);
        if (cachedHome?.timelineHydratedAt) {
          this.timelineAggregation = buildCachedTimelineAggregation(userId);
          this.setSaveStatus("Timeline 已从本地缓存载入完整历史记录");
          return;
        }

        const payload = await fetchTaskTimeline();
        const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
        const records = Array.isArray(payload?.records) ? payload.records : [];
        const startDate = String(payload?.start || "");
        const endDate = String(payload?.end || "");
        const totalDays = Number(payload?.totalDays || 0) || buildRecentDateKeys(31).length;
        const dateKeys = startDate && endDate ? buildDateKeysBetween(startDate, endDate) : buildRecentDateKeys(totalDays);
        const normalizedTasks = tasks.map(normalizeTask).sort((left, right) => left.order - right.order);
        saveCachedTasks(userId, tasks);
        saveCachedDailyRecords(userId, records);
        saveCachedHomeData(userId, {
          timelineHydratedAt: new Date().toISOString(),
        });
        this.timelineAggregation = buildAggregationFromRecords(normalizedTasks, dateKeys, records, totalDays);
        this.setSaveStatus("Timeline 已直接从云端载入完整历史记录");
      } catch (error) {
        this.error = getUserFacingErrorMessage(error, "Timeline 加载失败");
        this.setSaveStatus(this.error);
      } finally {
        this.loading = false;
      }
    },
    async setMode(mode) {
      this.mode = mode === "month" ? "month" : "week";
      await this.loadCurrentView();
    },
    async setSelectedWeek(week) {
      this.selectedWeek = week;
      if (this.mode === "week") {
        await this.loadCurrentView();
      }
    },
    async setSelectedMonth(month) {
      this.selectedMonth = month;
      if (this.mode === "month") {
        await this.loadCurrentView();
      }
    },
    setFilter(key, value) {
      this.filters = {
        ...this.filters,
        [key]: value,
      };
    },
    updateSummaryDraft(value) {
      this.summaryDrafts = {
        ...this.summaryDrafts,
        [this.selectedWeek]: value,
      };
    },
    setSummaryMode(mode) {
      this.summaryModes = {
        ...this.summaryModes,
        [this.selectedWeek]: mode,
      };
    },
    openSummaryDialog() {
      this.summaryDialogOpen = true;
    },
    closeSummaryDialog() {
      this.summaryDialogOpen = false;
    },
    async saveSummary() {
      try {
        const sessionStore = useSessionStore();
        const content = String(this.currentSummaryDraft || "").trim();
        const response = await saveWeeklySummary(this.selectedWeek, content);
        const summary = {
          week: this.selectedWeek,
          content: response?.summary?.content || content,
          updatedAt: response?.summary?.updatedAt || new Date().toISOString(),
        };
        this.ensureSummaryState(this.selectedWeek, summary);
        saveCachedWeeklySummary(sessionStore.user?.id, summary);
        this.summaryDrafts = {
          ...this.summaryDrafts,
          [this.selectedWeek]: content,
        };
        this.summaryModes = {
          ...this.summaryModes,
          [this.selectedWeek]: content ? "view" : "edit",
        };
        this.summaryDialogOpen = false;
        this.setSaveStatus(`已保存 ${formatWeekRangeText(this.selectedWeek)} 的周总结`);
      } catch (error) {
        this.handleActionError(error, "周总结保存失败");
      }
    },
    async restoreTask(taskId) {
      const sessionStore = useSessionStore();
      const task = this.aggregation.tasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      try {
        await updateTask(taskId, { archived: false, archivedAt: null });
        task.archived = false;
        task.archivedAt = "";
        saveCachedTasks(sessionStore.user?.id, this.aggregation.tasks);
        this.setSaveStatus(`已恢复任务：${task.name}`);
      } catch (error) {
        this.handleActionError(error, "任务恢复失败");
      }
    },
  },
});

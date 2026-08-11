import { readonly } from "vue";

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
  getStartOfWeek,
  getWeekRangeFromWeekValue,
  parseLocalDate,
} from "../utils/date.js";
import { views as continuityViews } from "./state-continuity.js";

const PERIOD_TOKEN = Symbol("period-review-period");
const VIEW_TOKEN = Symbol("period-review-view");

export class PeriodReviewInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "PeriodReviewInputError";
  }
}

function normalizeTask(task = {}, index = 0) {
  return {
    id: String(task.id || ""),
    name: String(task.name || "未命名任务"),
    color: String(task.color || "#4f46e5"),
    order: Number(task.display_order ?? task.displayOrder ?? index + 1),
    archived: Boolean(task.archived),
    archivedAt: String(task.archived_at || task.archivedAt || ""),
    tags: Array.isArray(task.tags) ? task.tags : [],
    icon: String(task.icon || ""),
  };
}

function createPeriod(kind, value) {
  const key = String(value || "").trim();
  const valid = kind === "week" ? /^\d{4}-W\d{2}$/.test(key) : /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
  if (!valid) {
    throw new PeriodReviewInputError(`Invalid ${kind} period`);
  }
  return Object.freeze({ [PERIOD_TOKEN]: true, kind, key });
}

function assertPeriod(period, kind) {
  if (!period?.[PERIOD_TOKEN] || (kind && period.kind !== kind)) {
    throw new PeriodReviewInputError(`Expected a ${kind || "review"} period`);
  }
}

function createSelector(type, period = null, filters = null) {
  if (period) assertPeriod(period);
  return Object.freeze({ [VIEW_TOKEN]: true, type, period, filters: filters ? { ...filters } : null });
}

export const reviewPeriods = Object.freeze({
  week: (value) => createPeriod("week", value),
  month: (value) => createPeriod("month", value),
});

export const reviewViews = Object.freeze({
  week(period, filters) {
    assertPeriod(period, "week");
    return createSelector("week", period, filters);
  },
  month(period, filters) {
    assertPeriod(period, "month");
    return createSelector("month", period, filters);
  },
  statusOverview(period) {
    assertPeriod(period, "month");
    return createSelector("statusOverview", period);
  },
  timeline() {
    return createSelector("timeline");
  },
});

function dateKeysBetween(start, end) {
  const keys = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    keys.push(formatDateKey(cursor));
  }
  return keys;
}

function dateKeysForPeriod(period) {
  const range = period.kind === "week" ? getWeekRangeFromWeekValue(period.key) : getMonthRange(period.key);
  return dateKeysBetween(range.start, range.end);
}

function monthWeekValues(month) {
  const { start, end } = getMonthRange(month);
  const weeks = [];
  for (let cursor = getStartOfWeek(start); cursor <= end; cursor = addDays(cursor, 7)) {
    weeks.push(formatWeekInputValue(cursor));
  }
  return [...new Set(weeks)];
}

function timestampDateKey(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? formatDateKey(date) : "";
}

function normalizeNotes(notes, date) {
  return Array.isArray(notes)
    ? notes.map((note, index) => ({
        id: String(note?.id || `${date}-note-${index + 1}`),
        text: String(note?.text || ""),
        createdAt: String(note?.createdAt || note?.created_at || `${date}T00:00:00.000Z`),
      }))
    : [];
}

function createAggregation(tasks, totalDays) {
  const aggregation = {
    tasks,
    presenceCounts: {},
    completionCounts: {},
    notesByTask: {},
    eventsByTask: {},
    totalDays,
  };
  tasks.forEach((task) => {
    aggregation.presenceCounts[task.id] = 0;
    aggregation.completionCounts[task.id] = 0;
    aggregation.notesByTask[task.id] = [];
    aggregation.eventsByTask[task.id] = [];
  });
  return aggregation;
}

function buildAggregation(facts, dateKeys, totalDays = dateKeys.length) {
  const tasks = (facts.tasks || []).map(normalizeTask).sort((left, right) => left.order - right.order);
  const aggregation = createAggregation(tasks, totalDays);

  for (const date of dateKeys) {
    const taskStates = facts.dailyRecords?.[date]?.payload?.tasks || {};
    for (const task of tasks) {
      const taskState = taskStates[task.id];
      if (!taskState) continue;
      const notes = normalizeNotes(taskState.notes, date);
      aggregation.presenceCounts[task.id] += 1;
      if (taskState.completed) aggregation.completionCounts[task.id] += 1;
      notes.forEach((note) => aggregation.notesByTask[task.id].push({
        dateLabel: formatMonthDay(parseLocalDate(date)),
        note: note.text,
        createdAt: note.createdAt,
      }));
      if (taskState.completed || notes.length) {
        aggregation.eventsByTask[task.id].push({
          dateKey: date,
          dateLabel: formatMonthDay(parseLocalDate(date)),
          completed: Boolean(taskState.completed),
          notes,
          archived: false,
        });
      }
    }
  }

  for (const task of tasks) {
    aggregation.notesByTask[task.id].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const archiveDate = timestampDateKey(task.archivedAt);
    if (task.archived && archiveDate) {
      const existing = aggregation.eventsByTask[task.id].find((entry) => entry.dateKey === archiveDate);
      if (existing) existing.archived = true;
      else aggregation.eventsByTask[task.id].push({
        dateKey: archiveDate,
        dateLabel: formatMonthDay(parseLocalDate(archiveDate)),
        completed: false,
        notes: [],
        archived: true,
      });
    }
    aggregation.eventsByTask[task.id].sort((left, right) => right.dateKey.localeCompare(left.dateKey));
  }
  return aggregation;
}

function hasHistory(aggregation, taskId) {
  return Number(aggregation.presenceCounts[taskId] || 0) > 0
    || Number(aggregation.completionCounts[taskId] || 0) > 0
    || (aggregation.notesByTask[taskId] || []).length > 0;
}

function archivedInPeriod(task, dateKeys) {
  return task.archived && dateKeys.includes(timestampDateKey(task.archivedAt));
}

function applyFilters(tasks, aggregation, filters = {}, dateKeys = []) {
  return tasks
    .filter((task) => hasHistory(aggregation, task.id) || archivedInPeriod(task, dateKeys))
    .filter((task) => filters.taskId === "all" || !filters.taskId || filters.taskId === task.id)
    .filter((task) => filters.archive !== "active" || !task.archived)
    .filter((task) => filters.archive !== "archived" || task.archived)
    .filter((task) => filters.completion !== "completed" || aggregation.completionCounts[task.id] > 0)
    .filter((task) => filters.completion !== "incomplete" || aggregation.completionCounts[task.id] === 0);
}

function taskRows(tasks, aggregation) {
  return tasks.map((task) => ({
    ...task,
    completionCount: aggregation.completionCounts[task.id] || 0,
    noteCount: aggregation.notesByTask[task.id]?.length || 0,
    notes: aggregation.notesByTask[task.id] || [],
    events: aggregation.eventsByTask[task.id] || [],
    totalDays: aggregation.totalDays,
  }));
}

function stripMarkdown(content = "") {
  return String(content)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summaryEntry(facts, week, now) {
  const saved = facts.weeklySummaries?.[week] || {};
  const content = String(saved.content || "");
  const text = stripMarkdown(content);
  const weekEnd = getWeekRangeFromWeekValue(week).end;
  const currentWeek = formatWeekInputValue(now);
  return {
    week,
    label: formatWeekRangeText(week),
    content,
    excerpt: text.length > 84 ? `${text.slice(0, 84).trim()}...` : text,
    updatedAt: saved.updatedAt
      ? `${formatMonthDay(new Date(saved.updatedAt))} ${formatTime(new Date(saved.updatedAt))}`
      : "",
    rawUpdatedAt: String(saved.updatedAt || ""),
    status: content.trim() ? "written" : (week === currentWeek || weekEnd >= now ? "in-progress" : "missing"),
  };
}

function monthDenominator(month, now) {
  const current = formatMonthValue(now);
  if (month > current) return null;
  if (month === current) return now.getDate();
  return dateKeysForPeriod(reviewPeriods.month(month)).length;
}

function buildMonthOverview(facts, month, now) {
  const period = reviewPeriods.month(month);
  const dateKeys = dateKeysForPeriod(period);
  const denominator = monthDenominator(month, now);
  const aggregation = buildAggregation(facts, dateKeys, denominator ?? 0);
  const visibleTasks = aggregation.tasks
    .filter((task) => hasHistory(aggregation, task.id) || archivedInPeriod(task, dateKeys))
    .sort((left, right) => Number(left.archived) - Number(right.archived)
      || aggregation.completionCounts[right.id] - aggregation.completionCounts[left.id]
      || aggregation.notesByTask[right.id].length - aggregation.notesByTask[left.id].length
      || left.order - right.order);
  const summaryEntries = monthWeekValues(month).map((week) => summaryEntry(facts, week, now));
  const written = summaryEntries.filter((entry) => entry.status === "written");

  return {
    label: formatMonthRangeText(month),
    activeTaskCount: visibleTasks.filter((task) => !task.archived).length,
    completionDays: Object.values(aggregation.completionCounts).reduce((sum, count) => sum + Number(count || 0), 0),
    noteCount: Object.values(aggregation.notesByTask).reduce((sum, notes) => sum + notes.length, 0),
    writtenSummaryCount: written.length,
    rankedTasks: visibleTasks.map((task) => {
      const completionCount = aggregation.completionCounts[task.id] || 0;
      return {
        id: task.id,
        name: task.name,
        color: task.color,
        icon: task.icon,
        archived: task.archived,
        completionCount,
        noteCount: aggregation.notesByTask[task.id].length,
        notes: aggregation.notesByTask[task.id],
        progress: denominator === null ? null : {
          completedDays: completionCount,
          elapsedDays: denominator,
          ratio: denominator ? Math.min(completionCount / denominator, 1) : 0,
        },
      };
    }),
    summaries: written,
    summaryEntries,
    pendingSummary: summaryEntries.find((entry) => entry.status === "in-progress" && entry.week === formatWeekInputValue(now)) || null,
    missingSummaries: summaryEntries.filter((entry) => entry.status === "missing"),
    progressDenominator: denominator,
    totalDays: denominator ?? 0,
  };
}

function project(selector, facts, now) {
  if (selector.type === "timeline") {
    const dateKeys = Object.keys(facts.dailyRecords || {}).sort();
    const aggregation = buildAggregation(facts, dateKeys, Math.max(dateKeys.length, 1));
    return { tasks: taskRows(aggregation.tasks, aggregation).filter((task) => task.events.length) };
  }
  if (selector.type === "statusOverview") {
    return buildMonthOverview(facts, selector.period.key, now);
  }
  const dateKeys = dateKeysForPeriod(selector.period);
  const denominator = selector.type === "month" ? monthDenominator(selector.period.key, now) : 7;
  const aggregation = buildAggregation(facts, dateKeys, denominator ?? 0);
  const visibleTasks = taskRows(
    applyFilters(aggregation.tasks, aggregation, selector.filters || {}, dateKeys),
    aggregation,
  );
  const result = {
    visibleTasks,
    taskFilterOptions: [
      { value: "all", label: "全部任务" },
      ...aggregation.tasks
        .filter((task) => hasHistory(aggregation, task.id) || archivedInPeriod(task, dateKeys))
        .map((task) => ({ value: task.id, label: task.name })),
    ],
  };
  if (selector.type === "week") {
    result.summary = summaryEntry(facts, selector.period.key, now);
  } else {
    const overview = buildMonthOverview(facts, selector.period.key, now);
    result.summaryEntries = overview.summaryEntries;
    result.overview = overview;
  }
  return result;
}

export function createPeriodReview(continuityScope, { clock = { now: () => new Date() } } = {}) {
  if (!continuityScope?.view || !continuityScope?.change) {
    throw new PeriodReviewInputError("Period review requires a state continuity scope");
  }
  const facts = continuityScope.view(continuityViews.periodReviewFacts());

  return {
    view(selector) {
      if (!selector?.[VIEW_TOKEN]) {
        throw new PeriodReviewInputError("Unknown period review view");
      }
      const projection = {};
      Object.defineProperties(projection, {
        data: { enumerable: true, get: () => project(selector, facts.data, clock.now()) },
        freshness: { enumerable: true, get: () => facts.freshness },
        activity: { enumerable: true, get: () => facts.activity },
        issue: { enumerable: true, get: () => facts.issue },
      });
      return readonly(projection);
    },
    saveWeeklySummary({ period, content }) {
      assertPeriod(period, "week");
      const normalizedContent = String(content ?? "").trim();
      const updatedAt = clock.now().toISOString();
      return continuityScope.change((operations) => (
        operations.periodReview.saveWeeklySummary(period.key, normalizedContent, updatedAt)
      ));
    },
  };
}

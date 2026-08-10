<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import ToolbarSelect from "../components/common/ToolbarSelect.vue";
import { fetchPulseQuote } from "../services/pulse-api";
import { loadDashboardSnapshot } from "../services/sync-service";
import { useSessionStore } from "../stores/session";
import { useTodayStore } from "../stores/today";
import { useWeeklyStore } from "../stores/weekly";
import { formatDateTime, formatMonthValue, formatWeekInputValue, getTodayDateString } from "../utils/date";
import { getUserFacingErrorMessage } from "../utils/error-message";
import { renderTaskNoteMarkdown } from "../utils/markdown";
import { getTaskDisplayName, getTaskIcon } from "../utils/task-icons";

const PULSE_QUOTE_CACHE_KEY = "lifeflow-private-dashboard-pulse-quote";
const PULSE_QUOTE_TIME_ZONE = "Asia/Shanghai";
const FALLBACK_QUOTE = {
  text: "It's easier to lose than to win.",
  author: "Wayne Gretzky",
};

const router = useRouter();
const sessionStore = useSessionStore();
const todayStore = useTodayStore();
const weeklyStore = useWeeklyStore();
const rootRef = ref(null);
const activeNotesTaskId = ref("");
const noteDraft = ref("");
const noteSubmitting = ref(false);
const quote = ref(loadCachedQuote());
const summaryExpandedState = ref({});

function getDateKeyInTimeZone(date = new Date(), timeZone = PULSE_QUOTE_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

function loadCachedQuote() {
  if (typeof window === "undefined") {
    return FALLBACK_QUOTE;
  }

  try {
    const raw = localStorage.getItem(PULSE_QUOTE_CACHE_KEY);
    if (!raw) {
      return FALLBACK_QUOTE;
    }
    const parsed = JSON.parse(raw);
    const currentDateKey = getDateKeyInTimeZone();
    if (!parsed?.text || !parsed?.author || parsed?.generatedAtDateKey !== currentDateKey) {
      return FALLBACK_QUOTE;
    }
    return {
      ...FALLBACK_QUOTE,
      ...parsed,
    };
  } catch {
    return FALLBACK_QUOTE;
  }
}

function saveCachedQuote(nextQuote) {
  if (typeof window === "undefined" || !nextQuote?.text || !nextQuote?.author) {
    return;
  }

  localStorage.setItem(
    PULSE_QUOTE_CACHE_KEY,
    JSON.stringify({
      ...nextQuote,
      generatedAtDateKey: nextQuote.generatedAtDateKey || getDateKeyInTimeZone(),
      generatedAtTimeZone: nextQuote.generatedAtTimeZone || PULSE_QUOTE_TIME_ZONE,
    }),
  );
}

const isAuthenticated = computed(() => Boolean(sessionStore.user?.id) || sessionStore.previewMode);
function isTaskArchivedInSelectedMonth(task) {
  if (!task?.archived || !task?.archivedAt) {
    return false;
  }
  const archivedAt = new Date(task.archivedAt);
  if (Number.isNaN(archivedAt.getTime())) {
    return false;
  }
  return formatMonthValue(archivedAt) === weeklyStore.selectedMonth;
}

function hasTaskActivityInSelectedMonth(task) {
  const taskId = task?.id;
  const completionCount = Number(weeklyStore.aggregation?.completionCounts?.[taskId] || 0);
  const noteCount = Array.isArray(weeklyStore.aggregation?.notesByTask?.[taskId])
    ? weeklyStore.aggregation.notesByTask[taskId].length
    : 0;
  if (task?.archived) {
    return completionCount > 0 || noteCount > 0 || isTaskArchivedInSelectedMonth(task);
  }
  return (
    Number(weeklyStore.aggregation?.presenceCounts?.[taskId] || 0) > 0
    || completionCount > 0
    || noteCount > 0
  );
}

const displayedRankedTasks = computed(() => {
  const tasks = Array.isArray(weeklyStore.aggregation?.tasks) ? weeklyStore.aggregation.tasks : [];
  const completionCounts = weeklyStore.aggregation?.completionCounts || {};
  const notesByTask = weeklyStore.aggregation?.notesByTask || {};

  return [...tasks]
    .filter((task) => hasTaskActivityInSelectedMonth(task))
    .sort((left, right) => {
      const leftArchived = left?.archived ? 1 : 0;
      const rightArchived = right?.archived ? 1 : 0;
      const leftCompletionDays = Number(completionCounts[left.id] || 0);
      const rightCompletionDays = Number(completionCounts[right.id] || 0);
      const leftNotes = Array.isArray(notesByTask[left.id]) ? notesByTask[left.id].length : 0;
      const rightNotes = Array.isArray(notesByTask[right.id]) ? notesByTask[right.id].length : 0;

      return leftArchived - rightArchived
        || rightCompletionDays - leftCompletionDays
        || rightNotes - leftNotes
        || Number(left.order || 0) - Number(right.order || 0);
    })
    .map((task) => ({
      id: task.id,
      name: task.name,
      color: task.color,
      icon: task.icon || "",
      archived: Boolean(task.archived),
      completionCount: Number(completionCounts[task.id] || 0),
      noteCount: Array.isArray(notesByTask[task.id]) ? notesByTask[task.id].length : 0,
      notes: Array.isArray(notesByTask[task.id]) ? notesByTask[task.id] : [],
    }));
});
const activeNotesTask = computed(() => displayedRankedTasks.value.find((task) => task.id === activeNotesTaskId.value) || null);
const currentWeekPendingSummary = computed(() => {
  const currentWeek = formatWeekInputValue(new Date());
  const entry = (weeklyStore.monthSummaryEntries || []).find((item) => item.week === currentWeek);
  if (!entry || String(entry.content || "").trim()) {
    return null;
  }
  return entry;
});
const pulseStats = computed(() => ([
  {
    id: "tasks",
    label: "活跃任务",
    value: String(weeklyStore.monthOverview.activeTaskCount || 0),
  },
  {
    id: "done",
    label: "完成记录",
    value: String(weeklyStore.monthOverview.completionDays || 0),
  },
  {
    id: "notes",
    label: "备注数",
    value: String(weeklyStore.monthOverview.noteCount || 0),
  },
  {
    id: "weeks",
    label: "周总结",
    value: String(weeklyStore.monthOverview.writtenSummaryCount || 0),
  },
]));

function getProgressWidth(task) {
  const total = Math.max(1, Number(weeklyStore.monthOverview?.totalDays || 0));
  const completion = Math.max(0, Number(task?.completionCount || 0));
  return `${Math.min((completion / total) * 100, 100)}%`;
}

function renderSummary(content) {
  return renderTaskNoteMarkdown(content || "");
}

function getSummaryMarker(index) {
  return `Week ${index + 1}`;
}

function isSummaryExpanded(week) {
  return summaryExpandedState.value[String(week || "")] !== false;
}

function toggleSummaryExpanded(week) {
  const key = String(week || "");
  if (!key) {
    return;
  }
  summaryExpandedState.value = {
    ...summaryExpandedState.value,
    [key]: !isSummaryExpanded(key),
  };
}

function getTaskTitleIcon(task) {
  return getTaskIcon(
    task?.name,
    sessionStore.previewMode ? (task?.icon || "") : (sessionStore.user?.preferences?.tasks?.iconByTaskId?.[task?.id] || ""),
  );
}

function openNotesModal(taskId) {
  activeNotesTaskId.value = taskId;
  noteDraft.value = "";
}

function closeNotesPreview() {
  activeNotesTaskId.value = "";
  noteDraft.value = "";
}

function getTaskNotesTimeline(task) {
  return Array.isArray(task?.notes)
    ? [...task.notes].sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))
    : [];
}

function handleNoteComposerKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    submitPulseNote();
  }
}

async function submitPulseNote() {
  const task = activeNotesTask.value;
  const text = String(noteDraft.value || "").trim();
  if (!task || !text || noteSubmitting.value) {
    return;
  }

  const today = getTodayDateString();
  noteSubmitting.value = true;
  weeklyStore.setSaveStatus("正在同步备注到云端...");

  try {
    if (!todayStore.tasks.length) {
      await todayStore.bootstrap();
    }
    const savePromise = todayStore.appendTaskNoteForDate(task.id, text, today);
    noteDraft.value = "";
    if (sessionStore.user?.id) {
      weeklyStore.applyMonthReviewFromSnapshot(loadDashboardSnapshot(sessionStore.user.id));
    }
    const saved = await savePromise;
    if (!saved) {
      throw new Error(todayStore.error || "备注保存失败");
    }
    weeklyStore.setSaveStatus(`已保存 ${getTaskDisplayName(task.name)} 的备注`);
  } catch (error) {
    weeklyStore.setSaveStatus(getUserFacingErrorMessage(error, "备注保存失败，请稍后重试"));
    noteDraft.value = text;
  } finally {
    noteSubmitting.value = false;
  }
}

async function handleTaskJump(taskId) {
  if (!taskId) {
    return;
  }
  await router.push({
    name: "today",
    query: {
      task: taskId,
    },
  });
}

async function loadPulse() {
  if (!isAuthenticated.value) {
    return;
  }
  await weeklyStore.setMode("month");
}

async function loadQuote() {
  if (!isAuthenticated.value || sessionStore.previewMode) {
    return;
  }
  try {
    const payload = await fetchPulseQuote();
    quote.value = payload?.quote || FALLBACK_QUOTE;
    saveCachedQuote(quote.value);
  } catch {
    quote.value = quote.value?.text ? quote.value : FALLBACK_QUOTE;
  }
}

function handleDocumentPointerDown(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if (!rootRef.value?.contains(target)) {
    closeNotesPreview();
  }
}

onMounted(async () => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  await Promise.all([
    loadPulse(),
    loadQuote(),
  ]);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
});

watch(
  () => sessionStore.user?.id,
  async (userId) => {
    if (userId) {
      await Promise.all([
        loadPulse(),
        loadQuote(),
      ]);
    }
  },
);
</script>

<template>
  <section ref="rootRef" class="stage-view pulse-view" aria-labelledby="pulse-panel-title">
    <header class="pulse-hero">
      <div class="pulse-hero-copy">
        <p class="panel-kicker">Navigation hub</p>
        <h1 id="pulse-panel-title">Pulse</h1>

        <div v-if="isAuthenticated && weeklyStore.saveStatus" class="pulse-hero-status">
          <p class="save-note" data-tone="default">{{ weeklyStore.saveStatus }}</p>
        </div>

        <div class="pulse-month-filter">
          <ToolbarSelect
            :model-value="weeklyStore.selectedMonth"
            icon="calendar_month"
            :options="weeklyStore.monthOptions"
            @update:model-value="weeklyStore.setSelectedMonth($event)"
          />
        </div>
      </div>

      <aside class="pulse-quote-panel" aria-label="每日名言">
        <template v-if="quote">
          <blockquote class="pulse-quote-body">“{{ quote.text }}”</blockquote>
          <p class="pulse-quote-author">{{ quote.author }}</p>
        </template>
        <p v-else class="pulse-quote-body">每日名言暂时不可用。</p>
      </aside>
    </header>

    <div v-if="!isAuthenticated" class="today-state-card">
      <h2>未连接账号</h2>
      <p>Pulse 需要先连接现有后端账号，才能展示月概览和跳转入口。</p>
    </div>

    <div v-else-if="weeklyStore.loading" class="today-state-card">
      <h2>正在载入</h2>
      <p>正在读取当前月份的任务和总结。</p>
    </div>

    <div v-else-if="weeklyStore.error" class="today-state-card">
      <h2>载入失败</h2>
      <p>{{ weeklyStore.error }}</p>
    </div>

    <template v-else>
      <section class="pulse-stats-grid" aria-label="月度概览">
        <article v-for="stat in pulseStats" :key="stat.id" class="pulse-stat-card">
          <span class="pulse-stat-label">{{ stat.label }}</span>
          <strong class="pulse-stat-value">{{ stat.value }}</strong>
        </article>
      </section>

      <section class="pulse-columns" aria-label="月度详情">
        <section class="pulse-block pulse-column-card">
          <div class="section-head pulse-card-head">
            <div>
              <p class="panel-kicker pulse-parent-title">Focus board</p>
              <h2>任务焦点</h2>
            </div>
          </div>

          <div v-if="displayedRankedTasks.length" class="pulse-task-list">
            <article
              v-for="task in displayedRankedTasks"
              :key="task.id"
              class="pulse-task-item"
              :class="{ 'is-archived': task.archived }"
              :style="{ '--task-accent': task.color }"
              role="link"
              tabindex="0"
              @click="handleTaskJump(task.id)"
              @keydown.enter.prevent="handleTaskJump(task.id)"
              @keydown.space.prevent="handleTaskJump(task.id)"
            >
              <div class="pulse-task-head">
                <div class="pulse-task-head-main">
                  <span class="material-symbols-outlined pulse-task-title-icon" aria-hidden="true">{{ getTaskTitleIcon(task) }}</span>
                  <span class="pulse-task-link">{{ getTaskDisplayName(task.name) }}</span>
                </div>
                <div class="pulse-task-meta-float">
                  <button
                    type="button"
                    class="pulse-task-notes"
                    @click.stop="openNotesModal(task.id)"
                    @keydown.enter.stop
                    @keydown.space.stop
                  >
                    <span class="material-symbols-outlined" aria-hidden="true">chat_bubble_outline</span>
                    <span>{{ task.noteCount }} 备注</span>
                  </button>
                  <span class="pulse-task-progress-copy">{{ task.completionCount }}/{{ weeklyStore.monthOverview.totalDays }}天</span>
                </div>
              </div>

              <div class="pulse-task-progress-row">
                <div class="pulse-task-progress" aria-hidden="true">
                  <span class="pulse-task-progress-fill" :style="{ width: getProgressWidth(task) }"></span>
                </div>
              </div>
            </article>
          </div>
          <p v-else class="monthly-overview-empty">本月还没有任务活跃记录。</p>
        </section>

        <section class="pulse-block pulse-column-card">
          <div class="section-head pulse-card-head">
            <div>
              <p class="panel-kicker pulse-parent-title">Weekly notes</p>
              <h2>每周札记</h2>
            </div>
          </div>

          <div v-if="weeklyStore.monthOverview.summaries.length || currentWeekPendingSummary" class="pulse-summary-list">
            <article
              v-for="(summary, index) in weeklyStore.monthOverview.summaries"
              :key="summary.week"
              class="pulse-summary-item"
            >
              <div class="pulse-summary-timeline" aria-hidden="true">
                <span class="pulse-summary-timeline-tag">{{ getSummaryMarker(index) }}</span>
                <span class="pulse-summary-line"></span>
              </div>
              <div class="pulse-summary-content">
                <div class="pulse-summary-head">
                  <strong>{{ summary.label }}</strong>
                  <button
                    type="button"
                    class="pulse-summary-toggle"
                    :aria-expanded="isSummaryExpanded(summary.week)"
                    :aria-label="isSummaryExpanded(summary.week) ? `收起 ${summary.label}` : `展开 ${summary.label}`"
                    @click="toggleSummaryExpanded(summary.week)"
                  >
                    <span class="material-symbols-outlined" aria-hidden="true">
                      {{ isSummaryExpanded(summary.week) ? "expand_less" : "expand_more" }}
                    </span>
                  </button>
                </div>
                <div v-show="isSummaryExpanded(summary.week)" class="pulse-summary-card">
                  <div class="pulse-summary-body" v-html="renderSummary(summary.content)"></div>
                  <div class="pulse-summary-time-row">
                    <span class="pulse-summary-time">{{ summary.updatedAt || "未记录保存时间" }}</span>
                  </div>
                </div>
              </div>
            </article>
            <article
              v-if="currentWeekPendingSummary"
              class="pulse-summary-item pulse-summary-item-pending"
            >
              <div class="pulse-summary-timeline" aria-hidden="true">
                <span class="pulse-summary-timeline-tag">{{ getSummaryMarker(weeklyStore.monthOverview.summaries.length) }}</span>
              </div>
              <div class="pulse-summary-content">
                <div class="pulse-summary-head">
                  <strong>{{ currentWeekPendingSummary.label }}</strong>
                  <span class="pulse-summary-status">In progress</span>
                </div>
                <div class="pulse-summary-card pulse-summary-card-pending">
                  <p>学到了什么... 持续记录中</p>
                </div>
              </div>
            </article>
          </div>
          <p v-else class="monthly-overview-empty">当前月份还没有已保存的每周札记。</p>
        </section>
      </section>

      <div v-if="activeNotesTask" class="pulse-note-modal-backdrop" @click.self="closeNotesPreview">
        <section
          class="pulse-note-modal"
          :style="{ '--task-accent': activeNotesTask.color }"
          role="dialog"
          aria-modal="true"
          aria-label="任务备注"
        >
          <div class="pulse-note-modal-head">
            <div class="pulse-note-modal-title">
              <span class="material-symbols-outlined pulse-note-modal-task-icon" aria-hidden="true">{{ getTaskTitleIcon(activeNotesTask) }}</span>
              <strong>{{ getTaskDisplayName(activeNotesTask.name) }} ({{ activeNotesTask.noteCount }}条记录)</strong>
            </div>
            <button type="button" class="modal-close pulse-task-popover-close" aria-label="关闭备注浮窗" @click="closeNotesPreview">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="pulse-task-popover-list pulse-note-modal-timeline">
            <template v-if="getTaskNotesTimeline(activeNotesTask).length">
              <article
                v-for="note in getTaskNotesTimeline(activeNotesTask)"
                :key="`${activeNotesTask.id}-${note.createdAt}-${note.note}`"
                class="pulse-task-popover-item pulse-note-modal-item"
              >
                <span class="pulse-note-modal-dot" aria-hidden="true"></span>
                <div class="pulse-note-modal-copy">
                  <span class="pulse-task-popover-time">{{ formatDateTime(note.createdAt) }}</span>
                  <p>{{ note.note }}</p>
                </div>
              </article>
            </template>
            <article class="pulse-task-popover-item pulse-note-modal-item is-composer">
              <span class="pulse-note-modal-dot" aria-hidden="true"></span>
              <div class="pulse-note-modal-copy">
                <span class="pulse-note-modal-new">New Note...</span>
                <textarea
                  v-model="noteDraft"
                  class="pulse-note-modal-input"
                  placeholder="添加新的备注..."
                  :disabled="noteSubmitting"
                  @keydown="handleNoteComposerKeydown"
                ></textarea>
                <div class="pulse-note-modal-actions">
                  <button
                    type="button"
                    class="pulse-note-modal-submit"
                    :disabled="noteSubmitting || !noteDraft.trim()"
                    @click="submitPulseNote"
                  >
                    {{ noteSubmitting ? "提交中..." : "提交备注" }}
                  </button>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

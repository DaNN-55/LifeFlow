<script setup>
import Sortable from "sortablejs";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import SegmentedTabs from "../components/common/SegmentedTabs.vue";
import ToolbarSelect from "../components/common/ToolbarSelect.vue";
import TaskIconPicker from "../components/today/TaskIconPicker.vue";
import TaskDialog from "../components/today/TaskDialog.vue";
import TodayTaskCard from "../components/today/TodayTaskCard.vue";
import TimelineTaskCard from "../components/weekly/TimelineTaskCard.vue";
import WeeklyReviewCard from "../components/weekly/WeeklyReviewCard.vue";
import { TASK_COLOR_PALETTES } from "../app/task-constants";
import { useSessionStore } from "../stores/session";
import { useTodayStore } from "../stores/today";
import { useWeeklyStore } from "../stores/weekly";

const previewTasks = [
  {
    id: "preview-task-1",
    name: "收口 Today / Review / Timeline 结构",
    color: "#64748b",
    meta: ["Design", "2 notes"],
  },
  {
    id: "preview-task-2",
    name: "整理 Content 一级 / 二级导航关系",
    color: "#94a3b8",
    meta: ["IA", "in progress"],
  },
  {
    id: "preview-task-3",
    name: "接入 FretFlow 独立主入口",
    color: "#cbd5e1",
    meta: ["Done", "prototype"],
  },
];

const previewReviewTasks = [
  {
    id: "preview-review-1",
    name: "Today 信息架构",
    color: "#64748b",
    archived: false,
    notes: [
      { dateLabel: "03-21", createdAt: "2026-03-21T09:20:00.000Z", note: "把 Weekly 收回到 Today 内部的二级视图。" },
      { dateLabel: "03-24", createdAt: "2026-03-24T14:08:00.000Z", note: "确定 Review 承担周总结，Timeline 承担事件总览。" },
    ],
    tags: ["review", "timeline"],
    completionCount: 4,
  },
  {
    id: "preview-review-2",
    name: "Content 分层",
    color: "#94a3b8",
    archived: false,
    notes: [
      { dateLabel: "03-23", createdAt: "2026-03-23T20:44:00.000Z", note: "内容扩展优先留在 Content 二级导航，不再增加一级 tab。" },
    ],
    tags: ["content"],
    completionCount: 3,
  },
];

const previewTimelineTasks = [
  {
    id: "preview-timeline-1",
    name: "Today 结构调整",
    color: "#64748b",
    tags: ["review", "timeline"],
    events: [
      {
        dateLabel: "2026-03-21",
        dateKey: "2026-03-21",
        completed: true,
        notes: [{ id: "pt-1", text: "把 Weekly 从一级导航移除。" }],
      },
      {
        dateLabel: "2026-03-24",
        dateKey: "2026-03-24",
        completed: false,
        notes: [{ id: "pt-2", text: "确认 Timeline 作为 Today 的二级视图长期保留。" }],
      },
    ],
  },
  {
    id: "preview-timeline-2",
    name: "FretFlow 主入口",
    color: "#94a3b8",
    tags: ["fretflow"],
    events: [
      {
        dateLabel: "2026-03-24",
        dateKey: "2026-03-24",
        completed: true,
        notes: [{ id: "pt-3", text: "决定将 FretFlow 作为独立一级 tab 接入。" }],
      },
    ],
  },
];

const sessionStore = useSessionStore();
const todayStore = useTodayStore();
const weeklyStore = useWeeklyStore();
const route = useRoute();
const router = useRouter();
const NEW_TASK_PALETTE_ID = "__new-task__";
const TODAY_PANELS = ["focus", "review", "timeline"];

const taskListRef = ref(null);
const rootRef = ref(null);
const newTaskName = ref("");
const newTaskTags = ref("");
const expandedReviewCards = ref({});
const expandedTimelineCards = ref({});
let highlightTimeout = null;
let sortableInstance = null;

const isAuthenticated = computed(() => Boolean(sessionStore.user?.id));
const isPreviewMode = computed(() => sessionStore.previewMode);
const todayPanel = computed(() => (
  TODAY_PANELS.includes(String(route.query.panel || "")) ? String(route.query.panel) : "focus"
));
const activeTasks = computed(() => todayStore.activeTasks);
const todayPanelItems = [
  { value: "focus", label: "TODAY" },
  { value: "review", label: "REVIEW" },
  { value: "timeline", label: "TIMELINE" },
];
const renameTask = computed(() => todayStore.getTaskForDialog(todayStore.renameDialogTaskId));
const archiveTask = computed(() => todayStore.getTaskForDialog(todayStore.archiveDialogTaskId));
const deleteTask = computed(() => todayStore.getTaskForDialog(todayStore.deleteDialogTaskId));
const deleteTaskName = computed(() => deleteTask.value?.name || "该任务");
const deleteNote = computed(() =>
  todayStore.getTaskNoteForDialog(todayStore.deleteNoteDialogTaskId, todayStore.deleteNoteDialogNoteId),
);
const showSummaryEdit = computed(
  () => weeklyStore.mode === "week" && weeklyStore.currentSummaryMode !== "view",
);
const timelineTasks = computed(() => (
  weeklyStore.timelineAggregation.tasks
    .filter((task) => (weeklyStore.timelineAggregation.eventsByTask?.[task.id] || []).length > 0)
    .slice()
    .sort((left, right) => left.order - right.order)
));
const headerMeta = computed(() => {
  if (todayPanel.value === "review") {
    return {
      kicker: "Retrospective",
      title: "Review",
    };
  }
  if (todayPanel.value === "timeline") {
    return {
      kicker: "Activity line",
      title: "Timeline",
    };
  }
  return {
    kicker: "Focus mode",
    title: "Today",
  };
});
const weeklyStatusText = computed(() => {
  if (!isAuthenticated.value) {
    return "当前还没有拿到登录会话，Review 和 Timeline 需要先连接现有后端账号。";
  }
  if (weeklyStore.loading) {
    return "正在读取复盘数据。";
  }
  if (weeklyStore.error) {
    return weeklyStore.error;
  }
  if (todayPanel.value === "timeline" && timelineTasks.value.length === 0) {
    return "当前范围内还没有可展示的任务时间线。";
  }
  if (todayPanel.value === "review" && weeklyStore.visibleTasks.length === 0) {
    return "尝试切换周/月范围，或放宽筛选条件。";
  }
  return "";
});

async function loadTodayModule() {
  if (!isAuthenticated.value || isPreviewMode.value) {
    return;
  }
  const routeDate = /^\d{4}-\d{2}-\d{2}$/.test(String(route.query.date || "")) ? String(route.query.date) : "";
  if (routeDate && routeDate !== todayStore.selectedDate) {
    todayStore.selectedDate = routeDate;
  }
  await todayStore.bootstrap();
}

async function loadWeeklyModule() {
  if (!isAuthenticated.value || isPreviewMode.value) {
    return;
  }
  if (todayPanel.value === "timeline") {
    await weeklyStore.loadTimelineView();
    return;
  }
  await weeklyStore.setMode("week");
}

function destroySortable() {
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }
}

async function setupSortable() {
  await nextTick();
  destroySortable();
  if (todayPanel.value !== "focus" || !taskListRef.value || activeTasks.value.length < 2) {
    return;
  }

  sortableInstance = Sortable.create(taskListRef.value, {
    animation: 160,
    handle: ".task-drag-handle",
    draggable: ".task-card",
    ghostClass: "task-card-sort-ghost",
    chosenClass: "task-card-sort-chosen",
    dragClass: "task-card-sort-drag",
    onEnd: async () => {
      const orderedTaskIds = Array.from(taskListRef.value.querySelectorAll("[data-task-id]"))
        .map((node) => node.dataset.taskId)
        .filter(Boolean);
      await todayStore.reorderTasks(orderedTaskIds);
    },
  });
}

async function loadCurrentPanel() {
  if (isPreviewMode.value) {
    destroySortable();
    return;
  }
  if (todayPanel.value === "focus") {
    await loadTodayModule();
    await setupSortable();
    await focusRequestedTask();
    return;
  }
  destroySortable();
  await Promise.all([
    loadTodayModule(),
    loadWeeklyModule(),
  ]);
}

function handleDocumentPointerDown(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if (!rootRef.value?.contains(target)) {
    todayStore.closeTransientUi();
    return;
  }
  if (
    !target.closest(".task-menu-panel") &&
    !target.closest(".task-menu-trigger") &&
    !target.closest(".task-palette-popover") &&
    !target.closest(".task-accent-trigger")
  ) {
    todayStore.closeTransientUi();
  }
}

async function handleCreateTask() {
  await todayStore.createTask(newTaskName.value, newTaskTags.value, todayStore.newTaskColor, todayStore.newTaskIcon);
  newTaskName.value = "";
  newTaskTags.value = "";
}

function toggleNewTaskPalette() {
  todayStore.toggleTaskPalette(NEW_TASK_PALETTE_ID);
}

function setNewTaskColor(color) {
  todayStore.newTaskColor = todayStore.newTaskColor === color ? "" : color;
  todayStore.activePaletteTaskId = "";
}

async function handleDateChange(value) {
  await todayStore.selectDate(value);
  router.replace({
    path: "/today",
    query: {
      ...route.query,
      date: todayStore.selectedDate,
    },
  });
}

async function switchTodayPanel(panel) {
  const nextPanel = TODAY_PANELS.includes(panel) ? panel : "focus";
  const nextQuery = {
    ...route.query,
  };

  if (todayStore.selectedDate) {
    nextQuery.date = todayStore.selectedDate;
  }

  if (nextPanel === "focus") {
    delete nextQuery.panel;
  } else {
    nextQuery.panel = nextPanel;
  }

  await router.replace({
    path: "/today",
    query: nextQuery,
  });
}

function handleEditSummary() {
  weeklyStore.setSummaryMode("edit");
}

function handleSaveSummary() {
  weeklyStore.openSummaryDialog();
}

function getTimelineEntries(taskId) {
  return weeklyStore.timelineAggregation.eventsByTask?.[taskId] || [];
}

function isReviewExpanded(taskId) {
  return Boolean(expandedReviewCards.value[String(taskId)]);
}

function toggleReviewCard(taskId) {
  const key = String(taskId);
  expandedReviewCards.value = {
    ...expandedReviewCards.value,
    [key]: !isReviewExpanded(key),
  };
}

async function focusRequestedTask() {
  const taskId = String(route.query.task || "");
  if (!taskId || todayPanel.value !== "focus") {
    return;
  }
  await nextTick();
  const taskNode = rootRef.value?.querySelector(`[data-task-id="${taskId}"]`);
  if (!(taskNode instanceof HTMLElement)) {
    return;
  }
  taskNode.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
  taskNode.classList.add("is-task-highlighted");
  if (highlightTimeout) {
    clearTimeout(highlightTimeout);
  }
  highlightTimeout = setTimeout(() => {
    taskNode.classList.remove("is-task-highlighted");
  }, 1800);
}

function isTimelineExpanded(taskId) {
  return Boolean(expandedTimelineCards.value[String(taskId)]);
}

function toggleTimelineCard(taskId) {
  const key = String(taskId);
  expandedTimelineCards.value = {
    ...expandedTimelineCards.value,
    [key]: !expandedTimelineCards.value[key],
  };
}

async function handleTimelineRestore(taskId) {
  todayStore.closeTransientUi();
  await weeklyStore.restoreTask(taskId);
}

function buildTimelineSummary(entry) {
  if (entry?.archived && Array.isArray(entry?.notes) && entry.notes.length) {
    return `已存档 · ${entry.notes.map((note) => note.text).filter(Boolean).join(" · ")}`;
  }
  if (entry?.archived) {
    return "已存档";
  }
  if (Array.isArray(entry?.notes) && entry.notes.length) {
    return entry.notes.map((note) => note.text).filter(Boolean).join(" · ");
  }
  return entry?.completed ? "已完成" : "状态更新";
}

function buildTimelineCardEntries(entries = []) {
  return entries.map((entry) => ({
    ...entry,
    summary: buildTimelineSummary(entry),
  }));
}

onMounted(async () => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  await loadCurrentPanel();
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  destroySortable();
  if (highlightTimeout) {
    clearTimeout(highlightTimeout);
  }
});

watch(
  () => sessionStore.user?.id,
  async (userId) => {
    if (!userId) {
      return;
    }
    await loadCurrentPanel();
  },
);

watch(
  () => route.query.panel,
  async () => {
    await loadCurrentPanel();
  },
);

watch(
  activeTasks,
  async () => {
    if (todayPanel.value === "focus") {
      await setupSortable();
      await focusRequestedTask();
    }
  },
  { deep: true },
);

watch(
  () => route.query.task,
  async () => {
    await focusRequestedTask();
  },
);

watch(
  () => route.query.date,
  async (value) => {
    const nextDate = /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
    if (nextDate && nextDate !== todayStore.selectedDate && isAuthenticated.value) {
      await todayStore.selectDate(nextDate);
    }
  },
);
</script>

<template>
  <section ref="rootRef" class="stage-view">
    <section class="content-panel is-active" aria-labelledby="daily-panel-title">
      <div class="panel-header">
        <div>
          <p class="panel-kicker">{{ headerMeta.kicker }}</p>
          <h1 id="daily-panel-title">{{ headerMeta.title }}</h1>
        </div>
        <div v-if="todayPanel === 'focus'" class="panel-tools">
          <div class="summary-badge">
            <span>已完成</span>
            <strong>{{ todayStore.completedCount }} / {{ todayStore.activeTaskCount }}</strong>
          </div>
        </div>
      </div>

      <div class="save-note-row">
        <p
          v-if="todayPanel === 'focus'"
          class="save-note"
          :data-tone="todayStore.saveTone"
        >
          {{ todayStore.saveStatus }}
        </p>
        <p v-else-if="isAuthenticated && weeklyStore.saveStatus" class="save-note" data-tone="default">
          {{ weeklyStore.saveStatus }}
        </p>
        <div v-else></div>

        <SegmentedTabs
          :items="todayPanelItems"
          :model-value="todayPanel"
          aria-label="Today 子视图切换"
          @update:model-value="switchTodayPanel"
        />
      </div>

      <template v-if="todayPanel === 'focus'">
        <div v-if="isPreviewMode" class="task-stack" aria-live="polite">
          <article
            v-for="task in previewTasks"
            :key="task.id"
            class="task-card"
            :style="{ '--task-accent': task.color }"
          >
            <div class="task-row">
              <div class="task-title-group">
                <button type="button" class="task-completion-toggle" aria-label="预览模式任务状态"></button>
                <div>
                  <h3 class="task-title">{{ task.name }}</h3>
                  <div class="task-meta-stack">
                    <span v-for="meta in task.meta" :key="meta" class="task-meta">{{ meta }}</span>
                  </div>
                </div>
              </div>
              <div class="task-head-actions">
                <span class="task-drag-handle mono">::</span>
              </div>
            </div>
          </article>

          <article class="task-card new-task-card">
            <div>
              <h3 class="task-title">+ 新建任务</h3>
            </div>
            <p class="panel-copy">预览模式下不提交真实数据，这里只展示 Today 主输入区的结构。</p>
          </article>
        </div>

        <div v-else-if="!isAuthenticated" class="today-state-card">
          <h2>未连接账号</h2>
          <p>当前还没有拿到登录会话，Today 模块需要先连接现有后端账号。</p>
        </div>

        <div v-else-if="todayStore.loading && !todayStore.ready" class="today-state-card">
          <h2>正在载入</h2>
          <p>正在从现有后端读取任务和当日记录。</p>
        </div>

        <div v-else-if="todayStore.error && !todayStore.ready" class="today-state-card">
          <h2>载入失败</h2>
          <p>{{ todayStore.error }}</p>
        </div>

        <div v-else ref="taskListRef" class="task-stack" aria-live="polite">
          <TodayTaskCard
            v-for="task in activeTasks"
            :key="task.id"
            :task="task"
            :task-icon="todayStore.getTaskIcon(task.id, task.name)"
            :task-state="todayStore.getTaskState(task.id)"
            :tags="todayStore.getTaskTags(task.id)"
            :note-draft="todayStore.noteDrafts[task.id] || ''"
            :menu-open="todayStore.activeTaskMenuId === task.id"
            :palette-open="todayStore.activePaletteTaskId === task.id"
            :color-palettes="TASK_COLOR_PALETTES"
            :format-date-time="todayStore.formatDateTime"
            @toggle-task="todayStore.toggleTaskCompletion"
            @toggle-menu="todayStore.toggleTaskMenu"
            @toggle-palette="todayStore.toggleTaskPalette"
            @set-color="todayStore.setTaskColor"
            @draft-note="todayStore.setNoteDraft"
            @submit-note="todayStore.submitTaskNote"
            @delete-note="todayStore.openDeleteNoteDialog"
            @edit-task="todayStore.openRenameDialog"
            @archive-task="todayStore.openArchiveDialog"
            @delete-task="todayStore.openDeleteDialog"
          />

          <article
            class="task-card new-task-card"
            :style="{ '--task-accent': todayStore.newTaskColor || 'var(--line-2)' }"
          >
            <button
              type="button"
              class="task-accent-trigger"
              :aria-label="todayStore.newTaskColor ? '修改新任务颜色' : '设置新任务颜色，默认随机分配'"
              @click="toggleNewTaskPalette"
            />
            <div
              v-if="todayStore.activePaletteTaskId === NEW_TASK_PALETTE_ID"
              class="task-palette-popover"
              role="group"
              aria-label="新建任务颜色选择"
            >
              <button
                v-for="palette in todayStore.colorPalettes"
                :key="palette.id"
                type="button"
                class="palette-swatch"
                :class="{ 'is-active': palette.value === todayStore.newTaskColor }"
                :style="{ '--swatch-color': palette.value }"
                :title="palette.label"
                :aria-label="palette.label"
                @click="setNewTaskColor(palette.value)"
              />
            </div>
            <div>
              <h3 class="task-title">+ 新建任务</h3>
            </div>
            <form class="new-task-form" @submit.prevent="handleCreateTask">
              <TaskIconPicker v-model="todayStore.newTaskIcon" label="任务图标" layout="single-row" />
              <div class="new-task-input-row">
                <input
                  v-model="newTaskName"
                  type="text"
                  maxlength="20"
                  placeholder="输入新任务名称"
                  required
                />
                <input
                  v-model="newTaskTags"
                  type="text"
                  maxlength="120"
                  placeholder="标签，多个请用逗号分隔"
                />
              </div>
              <button type="submit" class="add-task-submit">创建任务</button>
            </form>
          </article>
        </div>
      </template>

      <template v-else>
        <div v-if="todayPanel === 'review'" class="weekly-tools">
          <div class="weekly-review-controls toolbar-filter-bar is-review-only">
            <label class="weekly-filter-field">
              <span class="weekly-filter-label">周范围</span>
              <ToolbarSelect
                :model-value="weeklyStore.selectedWeek"
                icon="calendar_month"
                :options="weeklyStore.weekOptions"
                @update:model-value="weeklyStore.setSelectedWeek($event)"
              />
            </label>

            <label class="weekly-filter-field">
              <span class="weekly-filter-label">任务</span>
              <ToolbarSelect
                :model-value="weeklyStore.filters.taskId"
                icon="task_alt"
                :options="weeklyStore.taskFilterOptions"
                @update:model-value="weeklyStore.setFilter('taskId', $event)"
              />
            </label>

            <label class="weekly-filter-field">
              <span class="weekly-filter-label">完成状态</span>
              <ToolbarSelect
                :model-value="weeklyStore.filters.completion"
                icon="radio_button_checked"
                :options="weeklyStore.completionFilterOptions"
                @update:model-value="weeklyStore.setFilter('completion', $event)"
              />
            </label>

            <label class="weekly-filter-field">
              <span class="weekly-filter-label">存档状态</span>
              <ToolbarSelect
                :model-value="weeklyStore.filters.archive"
                icon="inventory_2"
                :options="weeklyStore.archiveFilterOptions"
                @update:model-value="weeklyStore.setFilter('archive', $event)"
              />
            </label>
          </div>

          <section
            v-if="todayPanel === 'review'"
            class="weekly-summary-card"
            :class="{
              'is-empty': !weeklyStore.currentSummary.content,
              'is-editing': weeklyStore.currentSummaryMode !== 'view',
              'is-saved': weeklyStore.currentSummaryMode === 'view' && weeklyStore.currentSummary.content,
            }"
            aria-labelledby="weekly-summary-title"
          >
            <div class="section-head">
              <div>
                <p class="panel-kicker">Weekly wrap-up</p>
                <h2 id="weekly-summary-title">周总结</h2>
              </div>
              <div class="weekly-summary-actions" v-if="weeklyStore.mode === 'week'">
                <button
                  v-if="weeklyStore.currentSummaryMode === 'view' && weeklyStore.currentSummary.content"
                  type="button"
                  class="settings-save"
                  @click="handleEditSummary"
                >
                  修改
                </button>
                <button
                  v-else
                  type="button"
                  class="settings-save"
                  @click="handleSaveSummary"
                >
                  保存总结
                </button>
              </div>
            </div>

            <textarea
              v-if="showSummaryEdit"
              class="weekly-summary-input review-summary-textarea"
              :value="weeklyStore.currentSummaryDraft"
              placeholder="使用 Markdown 记录本周的收获、问题和下一步。保存后会切换到预览模式。"
              spellcheck="false"
              @input="weeklyStore.updateSummaryDraft($event.target.value)"
            />
            <div v-else-if="weeklyStore.currentSummary.content" class="weekly-summary-display" v-html="weeklyStore.summaryDisplayHtml" />
            <div v-else class="weekly-summary-display">
              <p>本周还没有保存总结。</p>
            </div>

            <p class="weekly-summary-meta" :class="{ 'is-dirty': weeklyStore.currentSummaryDraft !== weeklyStore.currentSummary.content }">
              {{ weeklyStore.summaryMeta }}
            </p>
          </section>
        </div>

        <div v-if="isPreviewMode && todayPanel === 'review'" class="stage-view">
          <section
            class="weekly-summary-card is-saved"
            aria-labelledby="preview-weekly-summary-title"
          >
            <div class="section-head">
              <div>
                <p class="panel-kicker">Weekly wrap-up</p>
                <h2 id="preview-weekly-summary-title">周总结</h2>
              </div>
            </div>
            <div class="weekly-summary-display">
              <p>这一周主要完成了信息架构收口：Today 成为默认入口，Weekly 被拆成 Review / Timeline，Content 保持频道式扩展，FretFlow 独立成一级空间。</p>
            </div>
            <p class="weekly-summary-meta">预览模式示例文案</p>
          </section>

          <div class="review-stack">
            <WeeklyReviewCard
              v-for="task in previewReviewTasks"
              :key="task.id"
              :task="task"
              task-icon="dashboard"
              :tags="task.tags"
              :completion-count="task.completionCount"
              :total-days="7"
              :notes="task.notes"
              :expanded="isReviewExpanded(task.id)"
              @toggle="toggleReviewCard"
            />
          </div>
        </div>

        <div v-else-if="isPreviewMode && todayPanel === 'timeline'" class="today-timeline-stack">
          <TimelineTaskCard
            v-for="task in previewTimelineTasks"
            :key="task.id"
            :task="task"
            task-icon="dashboard"
            :tags="task.tags"
            :entries="buildTimelineCardEntries(task.events)"
            :completion-count="task.events.filter((entry) => entry.completed).length"
            :note-count="task.events.reduce((count, entry) => count + entry.notes.length, 0)"
            :expanded="isTimelineExpanded(task.id)"
            :menu-open="todayStore.activeTaskMenuId === task.id"
            @toggle="toggleTimelineCard"
            @toggle-menu="todayStore.toggleTaskMenu"
            @restore-task="handleTimelineRestore"
            @delete-task="todayStore.openDeleteDialog"
          />
        </div>

        <div v-else-if="weeklyStatusText" class="today-state-card">
          <h2>{{ todayPanel === "review" ? "Review" : "Timeline" }}</h2>
          <p>{{ weeklyStatusText }}</p>
        </div>

        <div v-else-if="todayPanel === 'review'" class="review-stack">
          <WeeklyReviewCard
            v-for="task in weeklyStore.visibleTasks"
            :key="task.id"
            :task="task"
            :task-icon="todayStore.getTaskIcon(task.id, task.name)"
            :tags="sessionStore.user?.preferences?.tasks?.tagsByTaskId?.[task.id] || []"
            :completion-count="weeklyStore.aggregation.completionCounts[task.id] || 0"
            :total-days="weeklyStore.aggregation.totalDays"
            :notes="weeklyStore.aggregation.notesByTask[task.id] || []"
            :expanded="isReviewExpanded(task.id)"
            @toggle="toggleReviewCard"
            @restore-task="weeklyStore.restoreTask"
          />
        </div>

        <div v-else-if="todayPanel === 'timeline'" class="today-timeline-stack">
          <TimelineTaskCard
            v-for="task in timelineTasks"
            :key="`timeline-${task.id}`"
            :task="task"
            :task-icon="todayStore.getTaskIcon(task.id, task.name)"
            :tags="sessionStore.user?.preferences?.tasks?.tagsByTaskId?.[task.id] || []"
            :entries="buildTimelineCardEntries(getTimelineEntries(task.id))"
            :completion-count="weeklyStore.timelineAggregation.completionCounts[task.id] || 0"
            :note-count="weeklyStore.timelineAggregation.notesByTask[task.id]?.length || 0"
            :expanded="isTimelineExpanded(task.id)"
            :menu-open="todayStore.activeTaskMenuId === task.id"
            @toggle="toggleTimelineCard"
            @toggle-menu="todayStore.toggleTaskMenu"
            @restore-task="handleTimelineRestore"
            @delete-task="todayStore.openDeleteDialog"
          />
        </div>
      </template>
    </section>

    <TaskDialog
      :open="Boolean(renameTask)"
      title="编辑任务"
      copy="任务名称和标签会同步到现有后端。"
      confirm-label="保存"
      @cancel="todayStore.closeRenameDialog"
      @confirm="todayStore.confirmRename"
    >
      <div class="dialog-form">
        <input v-model="todayStore.renameDraftName" type="text" maxlength="20" placeholder="任务名称" />
        <input v-model="todayStore.renameDraftTags" type="text" maxlength="120" placeholder="标签，多个请用逗号分隔" />
        <TaskIconPicker v-model="todayStore.renameDraftIcon" label="任务图标" />
      </div>
    </TaskDialog>

    <TaskDialog
      :open="Boolean(archiveTask)"
      title="存档任务"
      :copy="archiveTask ? `确认将 ${archiveTask.name} 存档吗？` : ''"
      confirm-label="确认存档"
      @cancel="todayStore.closeArchiveDialog"
      @confirm="todayStore.confirmArchive"
    />

    <TaskDialog
      :open="Boolean(todayStore.deleteDialogTaskId)"
      title="删除任务"
      :copy="`确认永久删除 ${deleteTaskName} 吗？该操作不会保留任务本体。`"
      confirm-label="确认删除"
      tone="danger"
      @cancel="todayStore.closeDeleteDialog"
      @confirm="todayStore.confirmDelete"
    />

    <TaskDialog
      :open="Boolean(deleteNote)"
      title="删除备注"
      copy="确认删除这条备注吗？删除后不能恢复。"
      confirm-label="确认删除"
      tone="danger"
      @cancel="todayStore.closeDeleteNoteDialog"
      @confirm="todayStore.confirmDeleteNote"
    />

    <TaskDialog
      :open="weeklyStore.summaryDialogOpen"
      title="保存周总结"
      :copy="`确认保存 ${weeklyStore.selectedWeek} 的周总结吗？`"
      confirm-label="确认保存"
      @cancel="weeklyStore.closeSummaryDialog"
      @confirm="weeklyStore.saveSummary"
    />
  </section>
</template>

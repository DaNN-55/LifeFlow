<script setup>
import Sortable from "sortablejs";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import ToolbarSelect from "../components/common/ToolbarSelect.vue";
import TaskIconPicker from "../components/today/TaskIconPicker.vue";
import TaskDialog from "../components/today/TaskDialog.vue";
import TodayTaskCard from "../components/today/TodayTaskCard.vue";
import MonthlyOverviewCard from "../components/weekly/MonthlyOverviewCard.vue";
import WeeklyReviewCard from "../components/weekly/WeeklyReviewCard.vue";
import { useSessionStore } from "../stores/session";
import { useTodayStore } from "../stores/today";
import { useWeeklyStore } from "../stores/weekly";

const sessionStore = useSessionStore();
const todayStore = useTodayStore();
const weeklyStore = useWeeklyStore();
const NEW_TASK_PALETTE_ID = "__new-task__";

const homeTab = ref("today");
const taskListRef = ref(null);
const rootRef = ref(null);
const newTaskName = ref("");
const newTaskTags = ref("");
const expandedReviewCards = ref({});
let sortableInstance = null;

const isAuthenticated = computed(() => Boolean(sessionStore.user?.id));
const activeTasks = computed(() => todayStore.activeTasks);
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

async function loadTodayModule() {
  if (!isAuthenticated.value) {
    return;
  }
  await todayStore.bootstrap();
}

async function loadWeeklyModule() {
  if (!isAuthenticated.value) {
    return;
  }
  await weeklyStore.bootstrap();
}

async function loadActivePanel() {
  if (homeTab.value === "weekly") {
    destroySortable();
    await loadWeeklyModule();
    return;
  }
  await loadTodayModule();
  await setupSortable();
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
  if (homeTab.value !== "today" || !taskListRef.value || activeTasks.value.length < 2) {
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

function switchHomeTab(tab) {
  homeTab.value = tab === "weekly" ? "weekly" : "today";
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

function handleEditSummary() {
  weeklyStore.setSummaryMode("edit");
}

function handleSaveSummary() {
  weeklyStore.openSummaryDialog();
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

onMounted(async () => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  await loadActivePanel();
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  destroySortable();
});

watch(
  () => sessionStore.user?.id,
  async (userId) => {
    if (!userId) {
      return;
    }
    await loadActivePanel();
  },
);

watch(
  () => homeTab.value,
  async () => {
    await loadActivePanel();
  },
);

watch(
  activeTasks,
  async () => {
    if (homeTab.value === "today") {
      await setupSortable();
    }
  },
  { deep: true },
);
</script>

<template>
  <section ref="rootRef" class="stage-view home-stage-view">
    <div class="stage-toolbar">
      <div class="center-tabs" :data-active-tab="homeTab" aria-label="首页面板切换">
        <button
          type="button"
          class="center-tab"
          :class="{ 'is-active': homeTab === 'today' }"
          @click="switchHomeTab('today')"
        >
          TODAY
        </button>
        <button
          type="button"
          class="center-tab"
          :class="{ 'is-active': homeTab === 'weekly' }"
          @click="switchHomeTab('weekly')"
        >
          WEEKLY
        </button>
      </div>
    </div>

    <section v-if="homeTab === 'today'" class="content-panel is-active" aria-labelledby="home-daily-panel-title">
      <div class="panel-header">
        <div>
          <p class="panel-kicker">Focus mode</p>
          <h1 id="home-daily-panel-title">Today</h1>
        </div>
        <div class="panel-tools">
          <div class="summary-badge">
            <span>已完成</span>
            <strong>{{ todayStore.completedCount }} / {{ todayStore.activeTaskCount }}</strong>
          </div>
        </div>
      </div>

      <div class="save-note-row">
        <p class="save-note" :data-tone="todayStore.saveTone">{{ todayStore.saveStatus }}</p>
      </div>

      <div v-if="!isAuthenticated" class="today-state-card">
        <h2>未连接账号</h2>
        <p>当前还没有拿到登录会话，Home 首页的任务面板需要先连接现有后端账号。</p>
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
          :color-palettes="todayStore.colorPalettes"
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
    </section>

    <section v-else class="content-panel is-active" aria-labelledby="home-weekly-panel-title">
      <div class="panel-header">
        <div>
          <p class="panel-kicker">Retrospective</p>
          <h1 id="home-weekly-panel-title">Weekly</h1>
        </div>
      </div>

      <div v-if="isAuthenticated && weeklyStore.saveStatus" class="save-note-row">
        <p class="save-note" data-tone="default">{{ weeklyStore.saveStatus }}</p>
      </div>

      <div v-if="!isAuthenticated" class="today-state-card">
        <h2>未连接账号</h2>
        <p>Weekly 模块需要先连接现有后端账号。</p>
      </div>

      <template v-else>
        <div class="weekly-tools">
          <div class="weekly-review-controls toolbar-filter-bar">
            <div class="weekly-mode-block">
              <span class="weekly-filter-label">复盘范围</span>
              <div class="toolbar-control">
                <div class="weekly-mode-toggle" :data-active-mode="weeklyStore.mode">
                  <button
                    type="button"
                    class="task-cancel-action"
                    :class="{ 'is-active': weeklyStore.mode === 'week' }"
                    @click="weeklyStore.setMode('week')"
                  >
                    按周
                  </button>
                  <button
                    type="button"
                    class="task-cancel-action"
                    :class="{ 'is-active': weeklyStore.mode === 'month' }"
                    @click="weeklyStore.setMode('month')"
                  >
                    按月
                  </button>
                </div>
              </div>
            </div>

            <label class="weekly-filter-field">
              <span class="weekly-filter-label">{{ weeklyStore.mode === "month" ? "月范围" : "周范围" }}</span>
              <ToolbarSelect
                :model-value="weeklyStore.mode === 'month' ? weeklyStore.selectedMonth : weeklyStore.selectedWeek"
                icon="calendar_month"
                :options="weeklyStore.rangeOptions"
                @update:model-value="
                  weeklyStore.mode === 'month'
                    ? weeklyStore.setSelectedMonth($event)
                    : weeklyStore.setSelectedWeek($event)
                "
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

          <MonthlyOverviewCard
            v-if="weeklyStore.mode === 'month'"
            :overview="weeklyStore.monthOverview"
            :tags-by-task-id="sessionStore.user?.preferences?.tasks?.tagsByTaskId || {}"
            :icon-by-task-id="sessionStore.user?.preferences?.tasks?.iconByTaskId || {}"
          />

          <section
            v-else
            class="weekly-summary-card"
            :class="{
              'is-empty': !weeklyStore.currentSummary.content,
              'is-editing': weeklyStore.currentSummaryMode !== 'view',
              'is-saved': weeklyStore.currentSummaryMode === 'view' && weeklyStore.currentSummary.content,
            }"
            aria-labelledby="home-weekly-summary-title"
          >
            <div class="section-head">
              <div>
                <p class="panel-kicker">Weekly wrap-up</p>
                <h2 id="home-weekly-summary-title">周总结</h2>
              </div>
              <div class="weekly-summary-actions">
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
              class="weekly-summary-input"
              :value="weeklyStore.currentSummaryDraft"
              placeholder="记录本周的收获、问题和下一步。支持 Markdown。"
              @input="weeklyStore.updateSummaryDraft($event.target.value)"
            />
            <div
              v-else-if="weeklyStore.mode === 'week' && weeklyStore.currentSummary.content"
              class="weekly-summary-display"
              v-html="weeklyStore.summaryDisplayHtml"
            />
            <div v-else class="weekly-summary-display">
              <p>本周还没有保存总结。</p>
            </div>

            <p class="weekly-summary-meta" :class="{ 'is-dirty': weeklyStore.currentSummaryDraft !== weeklyStore.currentSummary.content }">
              {{ weeklyStore.summaryMeta }}
            </p>
          </section>
        </div>

        <div v-if="weeklyStore.loading" class="today-state-card">
          <h2>正在载入</h2>
          <p>正在读取周复盘数据。</p>
        </div>

        <div v-else-if="weeklyStore.error" class="today-state-card">
          <h2>载入失败</h2>
          <p>{{ weeklyStore.error }}</p>
        </div>

        <div v-else-if="weeklyStore.visibleTasks.length === 0" class="today-state-card">
          <h2>暂无匹配结果</h2>
          <p>尝试切换周/月范围，或放宽筛选条件。</p>
        </div>

        <div v-else-if="weeklyStore.mode === 'week'" class="review-stack">
          <WeeklyReviewCard
            v-for="task in weeklyStore.visibleTasks"
            :key="task.id"
            :task="task"
            :task-icon="todayStore.getTaskIcon(task.id, task.name)"
            :tags="sessionStore.user?.preferences?.tasks?.tagsByTaskId?.[task.id] || []"
            :completion-count="task.completionCount"
            :total-days="task.totalDays"
            :notes="task.notes"
            :expanded="isReviewExpanded(task.id)"
            @toggle="toggleReviewCard"
            @restore-task="todayStore.restoreTask"
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

<script setup>
import Sortable from "sortablejs";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { TASK_COLOR_PALETTES } from "../app/task-constants";
import TaskDialog from "../components/today/TaskDialog.vue";
import TodayTaskCard from "../components/today/TodayTaskCard.vue";
import { useSessionStore } from "../stores/session";
import { useTodayStore } from "../stores/today";

const sessionStore = useSessionStore();
const todayStore = useTodayStore();
const route = useRoute();
const router = useRouter();
const NEW_TASK_PALETTE_ID = "__new-task__";

const taskListRef = ref(null);
const rootRef = ref(null);
const newTaskName = ref("");
const newTaskTags = ref("");
let sortableInstance = null;

const isAuthenticated = computed(() => Boolean(sessionStore.user?.id));
const activeTasks = computed(() => todayStore.activeTasks);
const renameTask = computed(() => todayStore.getTaskForDialog(todayStore.renameDialogTaskId));
const archiveTask = computed(() => todayStore.getTaskForDialog(todayStore.archiveDialogTaskId));
const deleteTask = computed(() => todayStore.getTaskForDialog(todayStore.deleteDialogTaskId));

async function loadTodayModule() {
  if (!isAuthenticated.value) {
    return;
  }
  const routeDate = /^\d{4}-\d{2}-\d{2}$/.test(String(route.query.date || "")) ? String(route.query.date) : "";
  if (routeDate && routeDate !== todayStore.selectedDate) {
    todayStore.selectedDate = routeDate;
  }
  await todayStore.bootstrap();
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
  if (!taskListRef.value || activeTasks.value.length < 2) {
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

async function handleCreateTask() {
  await todayStore.createTask(newTaskName.value, newTaskTags.value, todayStore.newTaskColor);
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
    query: { date: todayStore.selectedDate },
  });
}

onMounted(async () => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  await loadTodayModule();
  await setupSortable();
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
    await loadTodayModule();
    await setupSortable();
  },
);

watch(
  activeTasks,
  async () => {
    await setupSortable();
  },
  { deep: true },
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
          <p class="panel-kicker">Focus mode</p>
          <h1 id="daily-panel-title">Today</h1>
          <p class="today-date-summary">{{ todayStore.selectedDateLabel }}</p>
        </div>
        <div class="panel-tools">
          <input
            class="today-date-input"
            type="date"
            :value="todayStore.selectedDate"
            @change="handleDateChange($event.target.value)"
          />
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
          @delete-note="todayStore.deleteTaskNote"
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
            <button type="submit" class="add-task-submit">创建任务</button>
          </form>
        </article>
      </div>
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
      :open="Boolean(deleteTask)"
      title="删除任务"
      :copy="deleteTask ? `确认永久删除 ${deleteTask.name} 吗？该操作不会保留任务本体。` : ''"
      confirm-label="确认删除"
      tone="danger"
      @cancel="todayStore.closeDeleteDialog"
      @confirm="todayStore.confirmDelete"
    />
  </section>
</template>

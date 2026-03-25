<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

import { formatDateTime } from "../../utils/date";
import { renderTaskNoteMarkdown } from "../../utils/markdown";
import { getTaskDisplayName, getTaskIcon } from "../../utils/task-icons";

const props = defineProps({
  overview: {
    type: Object,
    required: true,
  },
  tagsByTaskId: {
    type: Object,
    default: () => ({}),
  },
  iconByTaskId: {
    type: Object,
    default: () => ({}),
  },
});
const emit = defineEmits(["select-task"]);

const rootRef = ref(null);
const hoveredTaskId = ref("");
const pinnedTaskId = ref("");

function getTaskTags(taskId) {
  return Array.isArray(props.tagsByTaskId?.[taskId]) ? props.tagsByTaskId[taskId] : [];
}

function resolveTaskIcon(task) {
  return getTaskIcon(task?.name, props.iconByTaskId?.[task?.id] || "");
}

function getProgressWidth(task) {
  const total = Math.max(1, Number(props.overview?.totalDays || 0));
  const completion = Math.max(0, Number(task?.completionCount || 0));
  return `${Math.min((completion / total) * 100, 100)}%`;
}

function isNotesPopoverVisible(taskId) {
  return hoveredTaskId.value === taskId || pinnedTaskId.value === taskId;
}

function showNotesPreview(taskId) {
  hoveredTaskId.value = taskId;
}

function hideNotesPreview(taskId) {
  if (pinnedTaskId.value !== taskId) {
    hoveredTaskId.value = "";
  }
}

function togglePinnedNotes(taskId) {
  pinnedTaskId.value = pinnedTaskId.value === taskId ? "" : taskId;
  hoveredTaskId.value = taskId;
}

function closeNotesPreview() {
  pinnedTaskId.value = "";
  hoveredTaskId.value = "";
}

function selectTask(taskId) {
  emit("select-task", taskId);
}

function renderSummary(content) {
  return renderTaskNoteMarkdown(content || "");
}

function handleDocumentPointerDown(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if (!rootRef.value?.contains(target)) {
    pinnedTaskId.value = "";
    hoveredTaskId.value = "";
  }
}

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
});
</script>

<template>
  <section ref="rootRef" class="weekly-summary-card monthly-overview-card is-saved" aria-labelledby="monthly-overview-title">
    <div class="section-head">
      <div>
        <p class="panel-kicker">Monthly recap</p>
        <h2 id="monthly-overview-title">月概览</h2>
      </div>
    </div>

    <div class="monthly-overview-stats">
      <article class="monthly-overview-stat">
        <span class="monthly-overview-stat-label">活跃任务</span>
        <strong class="monthly-overview-stat-value">{{ overview.activeTaskCount }}</strong>
      </article>
      <article class="monthly-overview-stat">
        <span class="monthly-overview-stat-label">完成记录</span>
        <strong class="monthly-overview-stat-value">{{ overview.completionDays }}</strong>
      </article>
      <article class="monthly-overview-stat">
        <span class="monthly-overview-stat-label">备注数</span>
        <strong class="monthly-overview-stat-value">{{ overview.noteCount }}</strong>
      </article>
      <article class="monthly-overview-stat">
        <span class="monthly-overview-stat-label">周总结</span>
        <strong class="monthly-overview-stat-value">{{ overview.writtenSummaryCount }}</strong>
      </article>
    </div>

    <div class="monthly-overview-columns">
      <section class="monthly-overview-panel">
        <div class="monthly-overview-panel-head">
          <h3>本月任务完成排序</h3>
        </div>
        <div v-if="overview.rankedTasks.length" class="monthly-overview-task-list">
          <article v-for="task in overview.rankedTasks" :key="task.id" class="monthly-overview-task" :style="{ '--task-accent': task.color }">
            <div class="monthly-overview-task-head">
              <button type="button" class="monthly-overview-task-link" @click="selectTask(task.id)">
                <span class="material-symbols-outlined task-title-icon monthly-task-icon" aria-hidden="true">{{ resolveTaskIcon(task) }}</span>
                <span>{{ getTaskDisplayName(task.name) }}</span>
              </button>
              <div v-if="getTaskTags(task.id).length" class="task-tag-row monthly-overview-tag-row">
                <span v-for="tag in getTaskTags(task.id)" :key="tag" class="task-tag">#{{ tag }}</span>
              </div>
            </div>

            <div class="monthly-overview-task-metrics">
              <div class="monthly-overview-progress-copy">
                <span>{{ task.completionCount }} / {{ overview.totalDays }} 天</span>
              </div>
              <button
                type="button"
                class="monthly-overview-notes-trigger"
                @mouseenter="showNotesPreview(task.id)"
                @mouseleave="hideNotesPreview(task.id)"
                @click="togglePinnedNotes(task.id)"
              >
                {{ task.noteCount }} 条备注
              </button>
            </div>

            <div class="monthly-overview-progress-track" aria-hidden="true">
              <span class="monthly-overview-progress-fill" :style="{ width: getProgressWidth(task) }"></span>
            </div>

            <div
              v-if="task.noteCount > 0 && isNotesPopoverVisible(task.id)"
              class="monthly-overview-notes-popover"
              @mouseenter="showNotesPreview(task.id)"
              @mouseleave="hideNotesPreview(task.id)"
            >
              <div class="monthly-overview-notes-head">
                <strong>{{ getTaskDisplayName(task.name) }}</strong>
                <div class="monthly-overview-notes-head-actions">
                  <span>{{ task.noteCount }} 条备注</span>
                  <button type="button" class="modal-close monthly-overview-notes-close" aria-label="关闭备注浮窗" @click="closeNotesPreview">
                    <span class="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>
              <div class="monthly-overview-notes-list">
                <article
                  v-for="note in task.notes"
                  :key="`${task.id}-${note.createdAt}-${note.note}`"
                  class="monthly-overview-note-item"
                >
                  <span class="monthly-overview-note-time">{{ note.dateLabel }} {{ formatDateTime(note.createdAt).split(' ')[1] || '' }}</span>
                  <p>{{ note.note }}</p>
                </article>
              </div>
            </div>
          </article>
        </div>
        <p v-else class="monthly-overview-empty">本月还没有任务活跃记录。</p>
      </section>

      <section class="monthly-overview-panel">
        <div class="monthly-overview-panel-head">
          <h3>周总结摘要</h3>
        </div>
        <div v-if="overview.summaries.length" class="monthly-overview-summary-list">
          <article
            v-for="summary in overview.summaries"
            :key="summary.week"
            class="monthly-overview-summary-item"
          >
            <div class="monthly-overview-summary-head">
              <strong>{{ summary.label }}</strong>
              <span>{{ summary.updatedAt }}</span>
            </div>
            <div class="monthly-overview-summary-body" v-html="renderSummary(summary.content)"></div>
          </article>
        </div>
        <p v-else class="monthly-overview-empty">当前月份还没有已保存的周总结。</p>
      </section>
    </div>
  </section>
</template>

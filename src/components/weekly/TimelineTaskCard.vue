<script setup>
import { computed } from "vue";

import { getTaskDisplayName } from "../../utils/task-icons";

const props = defineProps({
  task: {
    type: Object,
    required: true,
  },
  taskIcon: {
    type: String,
    default: "radio_button_unchecked",
  },
  tags: {
    type: Array,
    default: () => [],
  },
  entries: {
    type: Array,
    default: () => [],
  },
  completionCount: {
    type: Number,
    default: 0,
  },
  noteCount: {
    type: Number,
    default: 0,
  },
  expanded: {
    type: Boolean,
    default: false,
  },
  menuOpen: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["toggle", "toggle-menu", "restore-task", "delete-task"]);
const displayName = computed(() => getTaskDisplayName(props.task?.name));
</script>

<template>
  <article
    class="review-card today-timeline-card"
    :class="{ 'is-archived': task.archived }"
    :style="{ '--task-accent': task.color }"
  >
    <div class="review-card-header">
      <div class="review-title-row">
        <div class="review-title-with-icon">
          <span class="material-symbols-outlined task-title-icon review-task-icon" aria-hidden="true">{{ taskIcon }}</span>
          <h3 class="review-title">{{ displayName }}</h3>
        </div>
        <div v-if="tags.length" class="task-tag-row review-tag-row">
          <span v-for="tag in tags" :key="tag" class="task-tag">#{{ tag }}</span>
        </div>
      </div>
      <div class="review-summary">
        <span class="review-chip review-chip-summary">{{ completionCount }} DAYS</span>
        <div v-if="task.archived" class="task-head-actions review-head-actions">
          <button
            type="button"
            class="task-menu-trigger"
            :class="{ 'is-open': menuOpen }"
            :aria-expanded="menuOpen ? 'true' : 'false'"
            :aria-label="`${task.name} 更多操作`"
            @click="emit('toggle-menu', task.id)"
          >
            <span class="material-symbols-outlined">more_horiz</span>
          </button>

          <div class="task-menu-panel" :class="{ 'is-open': menuOpen }">
            <button type="button" class="task-menu-item" @click="emit('restore-task', task.id)">
              <span class="material-symbols-outlined">restore</span>
              <span>恢复</span>
            </button>
            <button type="button" class="task-menu-item is-danger" @click="emit('delete-task', task.id)">
              <span class="material-symbols-outlined">delete</span>
              <span>删除</span>
            </button>
          </div>
        </div>
        <button
          type="button"
          class="timeline-toggle-button"
          :class="{ 'is-expanded': expanded }"
          :aria-expanded="expanded"
          aria-label="展开或收起该任务时间轴"
          @click="emit('toggle', task.id)"
        >
          <span class="material-symbols-outlined">expand_more</span>
        </button>
      </div>
    </div>

    <div v-if="expanded" class="review-notes timeline-review-notes">
      <div v-if="entries.length === 0" class="review-note-item is-empty">
        <span class="review-note-marker" aria-hidden="true"></span>
        <span class="review-note-date">-</span>
        <div class="review-note-copy">
          <p class="review-note-text">暂无时间线记录</p>
        </div>
      </div>

      <div
        v-for="entry in entries"
        :key="`${task.id}-${entry.dateKey}-${entry.summary}`"
        class="review-note-item timeline-review-item"
        :class="{ 'is-complete': entry.completed }"
      >
        <span class="review-note-marker" aria-hidden="true"></span>
        <span class="review-note-date">{{ entry.dateLabel }}</span>
        <div class="review-note-copy">
          <p class="review-note-text">{{ entry.summary }}</p>
        </div>
      </div>
    </div>
  </article>
</template>

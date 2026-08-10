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
  completionCount: {
    type: Number,
    default: 0,
  },
  totalDays: {
    type: Number,
    default: 7,
  },
  notes: {
    type: Array,
    default: () => [],
  },
  expanded: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["restore-task", "toggle"]);
const displayName = computed(() => getTaskDisplayName(props.task?.name));
</script>

<template>
  <article class="review-card" :style="{ '--task-accent': task.color }">
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
        <span class="review-chip review-chip-summary">{{ completionCount }} / {{ totalDays }} DAYS</span>
        <span v-if="task.archived" class="review-chip is-archived">已存档</span>
        <button
          v-if="task.archived"
          type="button"
          class="task-cancel-action review-restore-button"
          @click="emit('restore-task', task.id)"
        >
          恢复
        </button>
        <button
          type="button"
          class="timeline-toggle-button review-toggle-button"
          :class="{ 'is-expanded': expanded }"
          :aria-expanded="expanded"
          aria-label="展开或收起该任务复盘"
          @click="emit('toggle', task.id)"
        >
          <span class="material-symbols-outlined">expand_more</span>
        </button>
      </div>
    </div>

    <div v-if="expanded" class="review-notes">
      <div v-if="notes.length === 0" class="review-note-item is-empty">
        <span class="review-note-marker" aria-hidden="true"></span>
        <span class="review-note-date">-</span>
        <div class="review-note-copy">
          <p class="review-note-text">暂无复盘备注</p>
        </div>
      </div>

      <div v-for="note in notes" :key="`${task.id}-${note.dateLabel}-${note.createdAt}-${note.note}`" class="review-note-item">
        <span class="review-note-marker" aria-hidden="true"></span>
        <span class="review-note-date">{{ note.dateLabel }}</span>
        <div class="review-note-copy">
          <p class="review-note-text">{{ note.note }}</p>
        </div>
      </div>
    </div>
  </article>
</template>

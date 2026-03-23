<script setup>
const props = defineProps({
  task: {
    type: Object,
    required: true,
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
});

const emit = defineEmits(["restore-task"]);
</script>

<template>
  <article class="review-card" :style="{ '--task-accent': task.color }">
    <div class="review-card-header">
      <div class="review-title-row">
        <h3 class="review-title">{{ task.name }}</h3>
        <div v-if="tags.length" class="task-tag-row review-tag-row">
          <span v-for="tag in tags" :key="tag" class="task-tag">#{{ tag }}</span>
        </div>
      </div>
      <div class="review-summary">
        <span v-if="task.archived" class="review-chip is-archived">已存档</span>
        <button
          v-if="task.archived"
          type="button"
          class="task-cancel-action review-restore-button"
          @click="emit('restore-task', task.id)"
        >
          恢复
        </button>
        <span class="review-chip">{{ completionCount }} / {{ totalDays }} DAYS</span>
        <span class="review-chip">{{ notes.length }} NOTES</span>
      </div>
    </div>

    <div class="review-notes">
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

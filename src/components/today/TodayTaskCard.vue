<script setup>
import { computed } from "vue";

import { getTaskDisplayName } from "../../utils/task-icons";

const props = defineProps({
  task: {
    type: Object,
    required: true,
  },
  taskState: {
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
  noteDraft: {
    type: String,
    default: "",
  },
  menuOpen: {
    type: Boolean,
    default: false,
  },
  paletteOpen: {
    type: Boolean,
    default: false,
  },
  colorPalettes: {
    type: Array,
    default: () => [],
  },
  formatDateTime: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits([
  "toggle-task",
  "toggle-menu",
  "toggle-palette",
  "set-color",
  "draft-note",
  "submit-note",
  "delete-note",
  "edit-task",
  "archive-task",
  "delete-task",
]);

const cardStyle = computed(() => ({
  "--task-accent": props.task.color,
}));

function renderMarkdown(note) {
  return String(note?.text || "");
}

const displayName = computed(() => getTaskDisplayName(props.task?.name));
</script>

<template>
  <article
    class="task-card"
    :class="{ 'is-task-completed': taskState.completed }"
    :style="cardStyle"
    :data-task-id="task.id"
  >
    <button
      type="button"
      class="task-accent-trigger"
      :aria-label="`${task.name} 颜色设置`"
      @click="emit('toggle-palette', task.id)"
    />

    <div class="task-row">
      <div class="task-title-group">
        <button
          type="button"
          class="task-completion-toggle"
          :class="{ 'is-completed': taskState.completed }"
          :aria-label="taskState.completed ? '标记为未完成' : '标记为已完成'"
          @click="emit('toggle-task', task.id)"
        >
          <span class="material-symbols-outlined">check</span>
        </button>
        <div class="task-meta-stack">
          <div class="task-title-row">
            <span class="material-symbols-outlined task-title-icon" aria-hidden="true">{{ taskIcon }}</span>
            <h3 class="task-title">{{ displayName }}</h3>
          </div>
          <div v-if="tags.length" class="task-tag-row">
            <span v-for="tag in tags" :key="tag" class="task-tag">#{{ tag }}</span>
          </div>
        </div>
      </div>

      <div class="task-head-actions">
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
          <button type="button" class="task-menu-item" @click="emit('edit-task', task.id)">
            <span class="material-symbols-outlined">edit</span>
            <span>编辑</span>
          </button>
          <button type="button" class="task-menu-item" @click="emit('archive-task', task.id)">
            <span class="material-symbols-outlined">inventory_2</span>
            <span>存档</span>
          </button>
          <button type="button" class="task-menu-item is-danger" @click="emit('delete-task', task.id)">
            <span class="material-symbols-outlined">delete</span>
            <span>删除</span>
          </button>
        </div>

        <button
          type="button"
          class="task-drag-handle"
          :aria-label="`拖拽排序 ${task.name}`"
        >
          <span class="material-symbols-outlined">drag_indicator</span>
        </button>
      </div>
    </div>

    <div v-if="paletteOpen" class="task-palette-popover" role="group" :aria-label="`${task.name} 颜色选择`">
      <button
        v-for="palette in colorPalettes"
        :key="palette.id"
        type="button"
        class="palette-swatch"
        :class="{ 'is-active': palette.value === task.color }"
        :style="{ '--swatch-color': palette.value }"
        :title="palette.label"
        :aria-label="palette.label"
        @click="emit('set-color', task.id, palette.value)"
      />
    </div>

    <div class="note-compose">
      <textarea
        class="task-note-input"
        maxlength="500"
        placeholder="记录本次执行的进度、问题或灵感..."
        :value="noteDraft"
        @input="emit('draft-note', task.id, $event.target.value)"
      ></textarea>
      <button type="button" class="note-submit" @click="emit('submit-note', task.id)">
        提交记录
      </button>
    </div>

    <div v-if="taskState.notes.length" class="task-note-list">
      <div v-for="note in taskState.notes" :key="note.id" class="task-note-item">
        <div class="task-note-row">
          <span class="note-time-chip">{{ formatDateTime(note.createdAt) }}</span>
          <button
            type="button"
            class="delete-note"
            aria-label="删除这条备注"
            @click="emit('delete-note', task.id, note.id)"
          >
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
        <p class="task-note-text">{{ renderMarkdown(note) }}</p>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, ref, watchPostEffect } from "vue";

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
const menuPanelRef = ref(null);
const menuStyle = ref({});

watchPostEffect((onCleanup) => {
  const menu = menuPanelRef.value;
  if (!props.menuOpen || !menu) return;

  const viewport = window.visualViewport;
  let frame = 0;

  function positionMenu() {
    if (!window.matchMedia("(max-width: 880px)").matches) {
      menuStyle.value = {};
      return;
    }
    const anchor = menu.parentElement.getBoundingClientRect();
    const rootStyle = getComputedStyle(document.documentElement);
    const safeTop = parseFloat(rootStyle.getPropertyValue("--safe-top")) || 0;
    const safeBottom = parseFloat(rootStyle.getPropertyValue("--safe-bottom")) || 0;
    const safeLeft = parseFloat(rootStyle.getPropertyValue("--safe-left")) || 0;
    const safeRight = parseFloat(rootStyle.getPropertyValue("--safe-right")) || 0;
    const viewportTop = (viewport?.offsetTop || 0) + safeTop;
    const viewportBottom = (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight) - safeBottom;
    const viewportLeft = (viewport?.offsetLeft || 0) + safeLeft;
    const viewportRight = (viewport?.offsetLeft || 0) + (viewport?.width || window.innerWidth) - safeRight;
    const top = viewportTop + 12;
    const dock = document.querySelector(".bottom-tabs")?.getBoundingClientRect();
    const bottom = Math.min(
      viewportBottom - 12,
      dock ? dock.top - 8 : Infinity,
    );
    // A hidden anchor cannot keep its menu reachable without moving the page.
    const bounds = menu.getBoundingClientRect();
    if (
      anchor.top < viewportTop || anchor.bottom > Math.min(viewportBottom, dock?.top ?? Infinity)
      || anchor.left < viewportLeft || anchor.right > viewportRight
      || bounds.left < viewportLeft || bounds.right > viewportRight
    ) {
      emit("toggle-menu", props.task.id);
      return;
    }
    const gap = 8;
    const above = Math.max(0, anchor.top - gap - top);
    const below = Math.max(0, bottom - anchor.bottom - gap);
    const height = menu.scrollHeight + menu.offsetHeight - menu.clientHeight;
    const flip = below < height && above > below;
    menuStyle.value = {
      top: flip ? "auto" : `${anchor.height + gap}px`,
      bottom: flip ? `${anchor.height + gap}px` : "auto",
      maxHeight: `${flip ? above : below}px`,
      overflowY: "auto",
      overscrollBehavior: "contain",
    };
  }

  function schedulePosition() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(positionMenu);
  }

  positionMenu();
  window.addEventListener("resize", schedulePosition);
  window.addEventListener("scroll", schedulePosition, true);
  viewport?.addEventListener("resize", schedulePosition);
  viewport?.addEventListener("scroll", schedulePosition);
  onCleanup(() => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", schedulePosition);
    window.removeEventListener("scroll", schedulePosition, true);
    viewport?.removeEventListener("resize", schedulePosition);
    viewport?.removeEventListener("scroll", schedulePosition);
  });
});
</script>

<template>
  <article
    class="task-card"
    :class="{ 'is-task-completed': taskState.completed, 'is-task-menu-open': menuOpen }"
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

        <div ref="menuPanelRef" class="task-menu-panel" :class="{ 'is-open': menuOpen }" :style="menuStyle">
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

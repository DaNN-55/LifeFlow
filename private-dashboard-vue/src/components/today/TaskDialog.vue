<script setup>
import { onBeforeUnmount, watch } from "vue";

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: "",
  },
  copy: {
    type: String,
    default: "",
  },
  confirmLabel: {
    type: String,
    default: "确认",
  },
  cancelLabel: {
    type: String,
    default: "取消",
  },
  tone: {
    type: String,
    default: "default",
  },
  dialogClass: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["cancel", "confirm"]);

function syncBodyScrollLock(locked) {
  if (typeof document === "undefined") {
    return;
  }
  document.body.classList.toggle("dialog-open", Boolean(locked));
}

watch(
  () => props.open,
  (open) => {
    syncBodyScrollLock(open);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  syncBodyScrollLock(false);
});
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="emit('cancel')">
    <div class="dialog-card" :class="dialogClass">
      <div class="dialog-header">
        <h2>{{ title }}</h2>
        <button type="button" class="modal-close" aria-label="关闭弹窗" @click="emit('cancel')">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <p v-if="copy" class="dialog-copy">{{ copy }}</p>
      <slot />
      <div class="dialog-actions">
        <button
          type="button"
          class="settings-save"
          :class="{ 'dialog-danger': tone === 'danger' }"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

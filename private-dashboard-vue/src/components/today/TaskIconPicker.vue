<script setup>
import { TASK_ICON_OPTIONS } from "../../utils/task-icons";

defineProps({
  modelValue: {
    type: String,
    default: "",
  },
  label: {
    type: String,
    default: "任务图标",
  },
  layout: {
    type: String,
    default: "grid",
  },
});

const emit = defineEmits(["update:modelValue"]);

function selectIcon(value) {
  emit("update:modelValue", value);
}
</script>

<template>
  <div class="task-icon-picker" :class="`is-${layout}`" role="group" :aria-label="label">
    <span class="task-icon-picker-label">{{ label }}</span>
    <div class="task-icon-picker-options">
      <button
        v-for="option in TASK_ICON_OPTIONS"
        :key="option.icon"
        type="button"
        class="task-icon-option"
        :class="{ 'is-active': modelValue === option.value }"
        :title="option.label"
        :aria-label="option.label"
        @click="selectIcon(option.value)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">{{ option.icon }}</span>
      </button>
    </div>
  </div>
</template>

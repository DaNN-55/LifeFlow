<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
  icon: {
    type: String,
    default: "",
  },
  options: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["update:modelValue"]);

const open = ref(false);
const rootRef = ref(null);

const selectedOption = computed(() => {
  return props.options.find((option) => option.value === props.modelValue) || props.options[0] || null;
});

const selectedLabel = computed(() => {
  if (!selectedOption.value) {
    return "";
  }
  return selectedOption.value.triggerLabel || selectedOption.value.label || "";
});

function handleDocumentPointerDown(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if (!rootRef.value?.contains(target)) {
    open.value = false;
  }
}

function toggleOpen() {
  open.value = !open.value;
}

function selectOption(value) {
  emit("update:modelValue", value);
  open.value = false;
}

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
});
</script>

<template>
  <div ref="rootRef" class="toolbar-control toolbar-select-control" :class="{ 'is-open': open }">
    <span v-if="icon" class="material-symbols-outlined toolbar-control-icon" aria-hidden="true">{{ icon }}</span>
    <div class="toolbar-select-shell">
      <button type="button" class="toolbar-select-trigger" @click="toggleOpen">
        <span class="toolbar-select-trigger-text">{{ selectedLabel }}</span>
        <span class="material-symbols-outlined toolbar-select-caret" aria-hidden="true">expand_more</span>
      </button>
      <div class="toolbar-select-menu">
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          class="toolbar-select-option"
          :class="{ 'is-selected': option.value === modelValue }"
          @click="selectOption(option.value)"
        >
          <span class="toolbar-select-option-check">✓</span>
          <span class="toolbar-select-option-text">{{ option.menuLabel || option.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

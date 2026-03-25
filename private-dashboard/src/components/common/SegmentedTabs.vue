<script setup>
import { computed } from "vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  modelValue: {
    type: String,
    required: true,
  },
  ariaLabel: {
    type: String,
    default: "视图切换",
  },
  containerClass: {
    type: [String, Array, Object],
    default: "",
  },
  buttonClass: {
    type: [String, Array, Object],
    default: "",
  },
});

const emit = defineEmits(["update:modelValue"]);
const activeIndex = computed(() => {
  const index = props.items.findIndex((item) => item.value === props.modelValue);
  return index >= 0 ? index : 0;
});
</script>

<template>
  <div
    class="today-view-tabs"
    :class="containerClass"
    :data-active-tab="modelValue"
    :data-tab-count="items.length"
    :aria-label="ariaLabel"
    :style="{ '--tab-count': String(Math.max(items.length, 1)), '--active-index': String(activeIndex) }"
  >
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="today-view-tab"
      :class="[buttonClass, { 'is-active': modelValue === item.value }]"
      @click="emit('update:modelValue', item.value)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

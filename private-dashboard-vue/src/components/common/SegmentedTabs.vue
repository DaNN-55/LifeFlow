<script setup>
defineProps({
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
</script>

<template>
  <div class="today-view-tabs" :class="containerClass" :data-active-tab="modelValue" :aria-label="ariaLabel">
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

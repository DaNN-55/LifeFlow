<script setup>
defineProps({
  practice: {
    type: Object,
    required: true,
  },
  patternOptions: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["toggle-pattern", "update-show-caged"]);
</script>

<template>
  <section class="fretflow-control-card fretflow-control-card-caged">
    <div class="fretflow-card-head">
      <div>
        <p class="panel-kicker">CAGED</p>
        <h2>指型训练</h2>
      </div>
      <button
        type="button"
        class="fretflow-pill-switch"
        :class="{ 'is-active': practice.showCaged }"
        :aria-pressed="practice.showCaged ? 'true' : 'false'"
        @click="emit('update-show-caged', !practice.showCaged)"
      >
        <span class="fretflow-pill-switch-track" aria-hidden="true">
          <span class="fretflow-pill-switch-thumb"></span>
        </span>
        <span>显示和弦音</span>
      </button>
    </div>

    <div class="fretflow-pattern-grid toolbar-filter-bar">
      <button
        v-for="pattern in patternOptions"
        :key="pattern.value"
        type="button"
        class="fretflow-pattern-pill"
        :class="{ 'is-active': practice.selectedPatterns.includes(pattern.value) }"
        @click="emit('toggle-pattern', pattern.value)"
      >
        {{ pattern.label }}
      </button>
    </div>
  </section>
</template>

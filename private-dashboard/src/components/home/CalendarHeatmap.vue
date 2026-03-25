<script setup>
defineProps({
  label: {
    type: String,
    default: "",
  },
  days: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["select-date"]);
</script>

<template>
  <section class="rail-card calendar-card" aria-labelledby="calendar-title">
    <div class="section-head">
      <div>
        <p class="panel-kicker">Calendar</p>
        <h2 id="calendar-title">Heatmap</h2>
      </div>
      <span class="section-meta mono">{{ label }}</span>
    </div>

    <div class="calendar-weekdays" aria-hidden="true">
      <span>一</span>
      <span>二</span>
      <span>三</span>
      <span>四</span>
      <span>五</span>
      <span>六</span>
      <span>日</span>
    </div>

    <div class="calendar-grid" aria-live="polite">
      <button
        v-for="day in days"
        :key="day.date"
        type="button"
        class="calendar-day"
        :class="[
          `level-${day.level}`,
          { 'is-muted': day.isMuted, 'is-selected': day.isSelected, 'is-today': day.isToday },
        ]"
        :title="`${day.date} · ${day.density} 次执行`"
        @click="emit('select-date', day.date)"
      >
        <span class="calendar-day-dot"></span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { ref } from "vue";

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
const isDateEditing = ref(false);
const dateDraft = ref("");

function startDateEditing(label) {
  dateDraft.value = String(label || "").replaceAll("/", "-");
  isDateEditing.value = true;
}

function cancelDateEditing() {
  isDateEditing.value = false;
}

function commitDateEditing() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDraft.value)) {
    cancelDateEditing();
    return;
  }
  isDateEditing.value = false;
  emit("select-date", dateDraft.value);
}
</script>

<template>
  <section class="rail-card calendar-card" aria-labelledby="calendar-title">
    <div class="section-head">
      <div>
        <p class="panel-kicker">Calendar</p>
        <h2 id="calendar-title">Heatmap</h2>
      </div>
      <div class="calendar-date-control">
        <input
          v-if="isDateEditing"
          v-model="dateDraft"
          class="calendar-date-input mono"
          type="date"
          :max="new Date().toISOString().slice(0, 10)"
          aria-label="选择日期，可跳转到过去的日期"
          autofocus
          @change="commitDateEditing"
          @blur="cancelDateEditing"
          @keydown.enter.prevent="commitDateEditing"
          @keydown.esc="cancelDateEditing"
        />
        <button
          v-else
          type="button"
          class="section-meta mono calendar-date-trigger"
          aria-label="编辑日期，可跳转到过去的日期"
          title="点击编辑日期"
          @click="startDateEditing(label)"
        >
          {{ label }}
        </button>
      </div>
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

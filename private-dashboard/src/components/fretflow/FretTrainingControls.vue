<script setup>
import { computed } from "vue";

import SegmentedTabs from "../common/SegmentedTabs.vue";
import ToolbarSelect from "../common/ToolbarSelect.vue";
import { getNotesFromFormula, scaleFormulas } from "../../utils/fretflow/music-theory";

const props = defineProps({
  practice: {
    type: Object,
    required: true,
  },
  rootOptions: {
    type: Array,
    default: () => [],
  },
  scaleOptions: {
    type: Array,
    default: () => [],
  },
  chordOptions: {
    type: Array,
    default: () => [],
  },
  chordPositionOptions: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits([
  "update-training-view",
  "update-root",
  "update-scale-type",
  "update-chord-type",
  "update-chord-position",
  "play-chord",
]);

const trainingViewItems = [
  { value: "scale", label: "音阶" },
  { value: "chord", label: "和弦" },
];

function formatScaleOptionLabel(root, notes) {
  return `${root}\u2003|\u2003${notes.join(" · ")}`;
}

const displayRootOptions = computed(() => {
  if (props.practice.trainingView !== "scale") {
    return props.rootOptions;
  }

  const formula = scaleFormulas[props.practice.scaleType] || scaleFormulas.major;
  return props.rootOptions.map((option) => ({
    ...option,
    triggerLabel: formatScaleOptionLabel(option.label, getNotesFromFormula(option.value, formula)),
    menuLabel: formatScaleOptionLabel(option.label, getNotesFromFormula(option.value, formula)),
  }));
});
</script>

<template>
  <section class="fretflow-control-card">
    <div class="fretflow-card-head">
      <div>
        <p class="panel-kicker">Practice</p>
        <h2>训练模式</h2>
      </div>
    </div>

    <SegmentedTabs
      :items="trainingViewItems"
      :model-value="practice.trainingView"
      aria-label="训练模式切换"
      container-class="fretflow-training-tabs"
      button-class="fretflow-training-tab"
      @update:model-value="emit('update-training-view', $event)"
    />

    <div class="fretflow-control-toolbar toolbar-filter-bar" :class="practice.trainingView === 'scale' ? 'is-scale' : 'is-chord'">
      <label class="weekly-filter-field fretflow-filter-field">
        <span class="weekly-filter-label">根音</span>
        <ToolbarSelect
          :model-value="practice.root"
          icon="music_note"
          :options="displayRootOptions"
          @update:model-value="emit('update-root', $event)"
        />
      </label>

      <label v-if="practice.trainingView === 'scale'" class="weekly-filter-field fretflow-filter-field">
        <span class="weekly-filter-label">调式</span>
        <ToolbarSelect
          :model-value="practice.scaleType"
          icon="tune"
          :options="scaleOptions"
          @update:model-value="emit('update-scale-type', $event)"
        />
      </label>

      <template v-else>
        <label class="weekly-filter-field fretflow-filter-field">
          <span class="weekly-filter-label">和弦</span>
          <ToolbarSelect
            :model-value="practice.chordType"
            icon="library_music"
            :options="chordOptions"
            @update:model-value="emit('update-chord-type', $event)"
          />
        </label>

        <label class="weekly-filter-field fretflow-filter-field">
          <span class="weekly-filter-label">把位</span>
          <ToolbarSelect
            :model-value="String(practice.chordPosition)"
            icon="piano"
            :options="chordPositionOptions"
            @update:model-value="emit('update-chord-position', $event)"
          />
        </label>

        <div class="fretflow-filter-action">
          <button type="button" class="fretflow-play-button" aria-label="播放当前和弦" @click="emit('play-chord')">
            <span class="material-symbols-outlined" aria-hidden="true">play_arrow</span>
          </button>
        </div>
      </template>
    </div>
  </section>
</template>

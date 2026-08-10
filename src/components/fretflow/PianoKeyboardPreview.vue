<script setup>
import { computed } from "vue";

import {
  chordFormulas,
  getNotesFromFormula,
  normalizeRoot,
  scaleFormulas,
} from "../../utils/fretflow/music-theory";

const props = defineProps({
  practice: {
    type: Object,
    required: true,
  },
});

const whiteKeys = [
  { note: "C", slot: 0 },
  { note: "D", slot: 1 },
  { note: "E", slot: 2 },
  { note: "F", slot: 3 },
  { note: "G", slot: 4 },
  { note: "A", slot: 5 },
  { note: "B", slot: 6 },
];

const blackKeys = [
  { note: "C#", slot: 1 },
  { note: "D#", slot: 2 },
  { note: "F#", slot: 4 },
  { note: "G#", slot: 5 },
  { note: "A#", slot: 6 },
];

const activeDefinition = computed(() => {
  const normalizedRoot = normalizeRoot(props.practice.root);

  if (props.practice.trainingView === "chord") {
    const chordDefinition = chordFormulas[props.practice.chordType] || chordFormulas.majorTriad;
    return {
      root: normalizedRoot,
      notes: getNotesFromFormula(normalizedRoot, chordDefinition.intervals),
      degrees: chordDefinition.degrees || [],
      tone: "chord",
    };
  }

  const scaleFormula = scaleFormulas[props.practice.scaleType] || scaleFormulas.major;
  return {
    root: normalizedRoot,
    notes: getNotesFromFormula(normalizedRoot, scaleFormula),
    degrees: scaleFormula.map((_, index) => String(index + 1)),
    tone: "scale",
  };
});

const activeNoteSet = computed(() => new Set(activeDefinition.value.notes));
const degreeMap = computed(() => new Map(
  activeDefinition.value.notes.map((note, index) => [note, activeDefinition.value.degrees[index] || ""])
));

function buildKeyState(note) {
  const isRoot = activeDefinition.value.root === note;
  const isActive = activeNoteSet.value.has(note);
  return {
    isRoot,
    isActive,
    degree: degreeMap.value.get(note) || "",
  };
}
</script>

<template>
  <section class="fretflow-piano-card" aria-label="音阶钢琴键盘映射">
    <div class="fretflow-piano-shell">
      <div class="fretflow-piano-white-keys">
        <div
          v-for="key in whiteKeys"
          :key="`white-${key.note}`"
          class="fretflow-piano-key is-white"
          :class="{
            'is-active': buildKeyState(key.note).isActive,
            'is-root': buildKeyState(key.note).isRoot,
            'is-chord': activeDefinition.tone === 'chord',
          }"
        >
          <span v-if="buildKeyState(key.note).degree" class="fretflow-piano-degree">{{ buildKeyState(key.note).degree }}</span>
          <span class="fretflow-piano-note">{{ key.note }}</span>
        </div>
      </div>

      <div class="fretflow-piano-black-keys" aria-hidden="true">
        <div
          v-for="key in blackKeys"
          :key="`black-${key.note}`"
          class="fretflow-piano-key is-black"
          :class="{
            'is-active': buildKeyState(key.note).isActive,
            'is-root': buildKeyState(key.note).isRoot,
            'is-chord': activeDefinition.tone === 'chord',
          }"
          :style="{ '--black-slot': String(key.slot) }"
        >
          <span v-if="buildKeyState(key.note).degree" class="fretflow-piano-degree">{{ buildKeyState(key.note).degree }}</span>
          <span class="fretflow-piano-note">{{ key.note }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

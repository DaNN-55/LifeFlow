<script setup>
import { computed } from "vue";

import { useTrainingAudio } from "../../composables/useTrainingAudio";
import { buildFretboardState, fretMarkerFrets, patternOptions } from "../../utils/fretflow/fretboard";
import {
  chordOptions,
  chordPositionOptions,
  rootOptions,
  scaleOptions,
} from "../../utils/fretflow/music-theory";
import { useFretflowStore } from "../../stores/fretflow";
import CagedControls from "./CagedControls.vue";
import FretTrainingControls from "./FretTrainingControls.vue";
import Fretboard from "./Fretboard.vue";

const fretflowStore = useFretflowStore();
const { playTrainingTone, playChordMidis } = useTrainingAudio();

const boardState = computed(() => buildFretboardState(fretflowStore.practice));
const scaleSummary = computed(() => boardState.value.scaleNotes.join(" · "));
const chordSummary = computed(() => boardState.value.chordNotes.join(" · "));

function handleNoteSelect(spot) {
  playTrainingTone(spot.midi);
  fretflowStore.setLastToast(`当前音符 ${spot.note} · 第 ${spot.stringIndex + 1} 弦 · 第 ${spot.fret} 品 · MIDI ${spot.midi}`);
}

function playCurrentChordPosition() {
  if (!boardState.value.voicedChordMidis.length) {
    return;
  }
  playChordMidis(boardState.value.voicedChordMidis);
  fretflowStore.setLastToast(`已播放 ${fretflowStore.practice.root} 的当前把位和弦。`);
}
</script>

<template>
  <section class="rail-card fretflow-interactive-panel">
    <FretTrainingControls
      v-if="fretflowStore.practice.mode === 'training'"
      :practice="fretflowStore.practice"
      :root-options="rootOptions"
      :scale-options="scaleOptions"
      :chord-options="chordOptions"
      :chord-position-options="chordPositionOptions"
      @update-training-view="fretflowStore.setTrainingView"
      @update-root="fretflowStore.setRoot"
      @update-scale-type="fretflowStore.setScaleType"
      @update-chord-type="fretflowStore.setChordType"
      @update-chord-position="fretflowStore.setChordPosition"
      @play-chord="playCurrentChordPosition"
    />

    <CagedControls
      v-else
      :practice="fretflowStore.practice"
      :pattern-options="patternOptions"
      @toggle-pattern="fretflowStore.togglePattern"
      @update-show-caged="fretflowStore.setShowCaged"
    />

    <section class="fretflow-board-card">
      <div class="fretflow-card-head">
        <div class="fretflow-board-summary-stack">
          <div class="fretflow-legend">
            <span class="fretflow-legend-item">
              <span class="fretflow-legend-dot is-scale"></span>
              音阶
            </span>
            <span class="fretflow-legend-item">
              <span class="fretflow-legend-dot is-chord"></span>
              和弦
            </span>
            <span class="fretflow-legend-item">
              <span class="fretflow-legend-dot is-root"></span>
              根音
            </span>
          </div>
        </div>
      </div>

      <Fretboard :strings="boardState.strings" :markers="fretMarkerFrets" @select-note="handleNoteSelect" />
    </section>
  </section>
</template>

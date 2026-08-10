<script setup>
import { ref, watch } from "vue";

import ToolbarSelect from "../common/ToolbarSelect.vue";
import { useMetronome } from "../../composables/useMetronome";
import { useFretflowStore } from "../../stores/fretflow";

const fretflowStore = useFretflowStore();
const { currentBeat, setEnabled, syncSettings } = useMetronome();
const bpmDraft = ref("");
const signatureOptions = [
  { value: "2/4", label: "2/4" },
  { value: "3/4", label: "3/4" },
  { value: "4/4", label: "4/4" },
  { value: "5/4", label: "5/4" },
  { value: "6/4", label: "6/4" },
];

function clampBpm(value) {
  return Math.min(200, Math.max(40, Number(value) || 120));
}

function syncBpmDraft(value) {
  bpmDraft.value = String(clampBpm(value));
}

function setBpm(value) {
  fretflowStore.setMetronomeBpm(clampBpm(value));
  syncBpmDraft(value);
}

async function persistBpm(value) {
  await fretflowStore.persistMetronomeBpm(clampBpm(value));
  syncBpmDraft(fretflowStore.metronome.bpm);
}

function handleBpmInput(event) {
  const nextValue = String(event?.target?.value || "").replace(/[^\d]/g, "").slice(0, 3);
  bpmDraft.value = nextValue;
  if (!nextValue) {
    return;
  }
  fretflowStore.setMetronomeBpm(nextValue);
}

async function commitBpm() {
  await persistBpm(bpmDraft.value || fretflowStore.metronome.bpm);
}

async function stepBpm(step) {
  const nextValue = clampBpm(fretflowStore.metronome.bpm + step);
  setBpm(nextValue);
  await persistBpm(nextValue);
}

async function handleBpmWheel(event) {
  event.preventDefault();
  await stepBpm(event.deltaY < 0 ? 1 : -1);
}

watch(
  () => fretflowStore.metronome.bpm,
  (value) => {
    syncBpmDraft(value);
  },
  { immediate: true },
);

watch(
  () => [fretflowStore.metronome.bpm, fretflowStore.metronome.signature],
  ([bpm, signature]) => {
    syncSettings({ bpm, signature });
  },
  { immediate: true },
);

watch(
  () => fretflowStore.metronome.enabled,
  async (enabled) => {
    await setEnabled(enabled);
  },
  { immediate: true },
);

watch(currentBeat, (value) => {
  fretflowStore.setMetronomeBeat(value);
});
</script>

<template>
  <section class="rail-card fretflow-metronome-card">
    <div class="fretflow-metronome-bar">
      <div class="fretflow-metronome-inline-row">
        <div class="fretflow-metronome-inline-copy">
          <button
            type="button"
            class="fretflow-metronome-power"
            :class="{ 'is-active': fretflowStore.metronome.enabled }"
            :aria-pressed="fretflowStore.metronome.enabled ? 'true' : 'false'"
            :aria-label="fretflowStore.metronome.enabled ? '关闭节拍器' : '开启节拍器'"
            @click="fretflowStore.setMetronomeEnabled(!fretflowStore.metronome.enabled)"
          >
            <span class="fretflow-metronome-power-track" aria-hidden="true">
              <span class="fretflow-metronome-power-thumb"></span>
            </span>
          </button>
          <div class="fretflow-metronome-bpm-control" @wheel="handleBpmWheel">
            <button
              type="button"
              class="fretflow-metronome-bpm-step is-prev"
              aria-label="降低节拍器速度"
              @click="stepBpm(-1)"
            >
              <span class="material-symbols-outlined" aria-hidden="true">chevron_left</span>
            </button>
            <label class="fretflow-metronome-bpm-field">
              <div class="fretflow-metronome-bpm-readout">
                <input
                  :value="bpmDraft"
                  type="text"
                  inputmode="numeric"
                  aria-label="节拍器速度"
                  @input="handleBpmInput"
                  @blur="commitBpm"
                  @keydown.enter.prevent="commitBpm"
                  @keydown.up.prevent="stepBpm(1)"
                  @keydown.down.prevent="stepBpm(-1)"
                />
                <span>BPM</span>
              </div>
            </label>
            <button
              type="button"
              class="fretflow-metronome-bpm-step is-next"
              aria-label="增加节拍器速度"
              @click="stepBpm(1)"
            >
              <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
            </button>
          </div>
        </div>

        <div class="fretflow-metronome-signature">
          <ToolbarSelect
            :model-value="fretflowStore.metronome.signature"
            :options="signatureOptions"
            @update:model-value="fretflowStore.setMetronomeSignature"
          />
        </div>

        <div class="fretflow-metronome-inline-lights" :style="{ '--beat-count': Number(fretflowStore.metronome.signature.split('/')[0]) || 4 }">
          <span
            v-for="beat in Number(fretflowStore.metronome.signature.split('/')[0]) || 4"
            :key="`inline-beat-${beat}`"
            class="fretflow-metronome-light"
            :class="{ 'is-active': fretflowStore.metronome.currentBeat === beat - 1, 'is-accent': beat === 1 }"
          ></span>
        </div>
      </div>
    </div>
  </section>
</template>

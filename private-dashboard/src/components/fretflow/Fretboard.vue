<script setup>
import { computed } from "vue";

const props = defineProps({
  strings: {
    type: Array,
    default: () => [],
  },
  markers: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["select-note"]);

const markerSet = computed(() => new Set(props.markers));
const fretNumbers = computed(() => {
  const count = props.strings[0]?.notes?.length || 0;
  return Array.from({ length: count }, (_, index) => index);
});
const frettedCount = computed(() => Math.max((props.strings[0]?.notes?.length || 1) - 1, 1));
const markerItems = computed(() => (
  props.markers
    .filter((fret) => Number(fret) > 0)
    .flatMap((fret) => {
      const value = Number(fret);
      if (value === 12) {
        return [
          { fret: value, key: `${value}-upper`, placement: "upper" },
          { fret: value, key: `${value}-lower`, placement: "lower" },
        ];
      }
      return [{ fret: value, key: `${value}-single`, placement: "single" }];
    })
));
</script>

<template>
  <div class="fretboard-panel" :style="{ '--fret-count': fretNumbers.length || 16, '--fretted-count': frettedCount }">
    <div class="fretboard-surface">
      <div class="fretboard-strings">
        <div
          v-for="string in strings"
          :key="string.id"
          class="fretboard-string-row"
        >
          <div class="fretboard-string-label" :class="{ 'is-muted': string.isMutedString }">
            {{ string.label || string.notes[0]?.note || "E" }}
          </div>
          <button
            v-for="spot in string.notes"
            :key="spot.id"
            type="button"
            class="fretboard-note"
            :class="{
              'is-active': spot.isActive,
              'is-root': spot.isRoot,
              'is-chord': spot.tone === 'chord',
              'is-caged': spot.tone === 'caged',
              'is-open-string': spot.fret === 0,
            }"
            :aria-label="`${spot.note}，第 ${spot.stringIndex + 1} 弦，第 ${spot.fret} 品`"
            @click="emit('select-note', spot)"
          >
            <span class="fretboard-note-string" aria-hidden="true"></span>
            <span class="fretboard-note-badge">
              <span class="fretboard-note-fill"></span>
              <span class="fretboard-note-label">{{ spot.note }}</span>
            </span>
          </button>
        </div>

        <div class="fretboard-marker-layer" aria-hidden="true">
          <span
            v-for="marker in markerItems"
            :key="`inlay-${marker.key}`"
            class="fretboard-inlay-marker"
            :class="{
              'is-upper': marker.placement === 'upper',
              'is-lower': marker.placement === 'lower',
            }"
            :style="{ '--marker-column': String(marker.fret + 2) }"
          ></span>
        </div>
      </div>

      <div class="fretboard-scale fretboard-scale-bottom">
        <div class="fretboard-corner" aria-hidden="true"></div>
        <div
          v-for="fret in fretNumbers"
          :key="`marker-${fret}`"
          class="fretboard-fret-number"
        >
          {{ markerSet.has(fret) ? fret : "" }}
        </div>
      </div>
    </div>
  </div>
</template>

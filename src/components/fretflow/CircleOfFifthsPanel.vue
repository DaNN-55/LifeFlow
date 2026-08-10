<script setup>
import { computed, reactive } from "vue";

import { useTrainingAudio } from "../../composables/useTrainingAudio";
import { computeCircleDerived, keysMajor, keysMinor } from "../../utils/fretflow/music-theory";
import { useFretflowStore } from "../../stores/fretflow";

const fretflowStore = useFretflowStore();
const { playChordByLabel } = useTrainingAudio();
const degreeHover = reactive({
  major: -1,
  minor: -1,
});

const svgSize = 720;
const center = 360;
const outerRadius = 322;
const outerInnerRadius = 228;
const innerOuterRadius = 206;
const innerInnerRadius = 126;
const centerHoleRadius = 112;
const outerTextRadius = 276;
const innerTextRadius = 166;
const angleStep = 30;
const startAngleDeg = -90;
const wedgeInsetDeg = 0.9;

const derived = computed(() => computeCircleDerived(fretflowStore.theory.activeCircleIndex));
const theorySummary = computed(() => {
  const index = derived.value.index;
  const signature = index === 0 ? "无升降号" : index <= 6 ? `${index} 个升号` : `${12 - index} 个降号`;
  const tonalColor = index === 0 ? "中性 / 开放" : index <= 6 ? "明亮 / 推进" : "温润 / 稳定";
  const harmonicCore = [
    derived.value.majorDiatonicChords[0]?.name,
    derived.value.majorDiatonicChords[3]?.name,
    derived.value.majorDiatonicChords[4]?.name,
  ].filter(Boolean).join(" · ");

  return [
    { label: "调号", value: signature },
    { label: "主功能", value: harmonicCore },
    { label: "色彩", value: tonalColor },
    { label: "建议", value: `${derived.value.majorKey} 大调音阶 / ${derived.value.minorKey} 和弦转换` },
  ];
});

function pointAt(radius, index, offsetDeg = 0) {
  const angleDeg = startAngleDeg + index * angleStep + offsetDeg;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: center + Math.cos(rad) * radius,
    y: center + Math.sin(rad) * radius,
  };
}

function arcPoint(radius, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: center + Math.cos(rad) * radius,
    y: center + Math.sin(rad) * radius,
  };
}

function sectorPath(outerR, innerR, index) {
  const startDeg = startAngleDeg + index * angleStep - angleStep / 2 + wedgeInsetDeg;
  const endDeg = startAngleDeg + index * angleStep + angleStep / 2 - wedgeInsetDeg;
  const outerStart = arcPoint(outerR, startDeg);
  const outerEnd = arcPoint(outerR, endDeg);
  const innerEnd = arcPoint(innerR, endDeg);
  const innerStart = arcPoint(innerR, startDeg);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 0 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 0 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function itemClasses(index) {
  return {
    "is-active": index === derived.value.index,
    "is-related": derived.value.relatedIndices.includes(index) && index !== derived.value.index,
  };
}

function handleKeydown(event) {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    fretflowStore.shiftCircleIndex(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    fretflowStore.shiftCircleIndex(1);
  }
}

function sendToPractice(mode) {
  const useMinor = mode === "minor";
  const practiceRoot = useMinor && derived.value.minorKey.endsWith("m")
    ? derived.value.minorKey.slice(0, -1)
    : derived.value.majorKey;

  void fretflowStore.applyPracticePreset({
    activeTab: "practice",
    mode: "training",
    trainingView: "scale",
    root: practiceRoot,
    scaleType: useMinor ? "minor" : "major",
    lastToast: `已切换到 ${useMinor ? derived.value.minorKey : derived.value.majorKey} 练习模式。`,
  });
}

function setDegreeHover(row, index) {
  degreeHover[row] = index;
}

function clearDegreeHover(row) {
  degreeHover[row] = -1;
}
</script>

<template>
  <section class="rail-card fretflow-interactive-panel fretflow-interactive-panel-theory">
    <div class="fretflow-card-head">
      <div>
        <p class="panel-kicker">Theory</p>
        <h2>五度圈</h2>
      </div>
    </div>

    <div class="fretflow-circle-layout" tabindex="0" @keydown="handleKeydown">
      <div class="fretflow-circle-shell">
        <svg class="fretflow-circle-wheel" :viewBox="`0 0 ${svgSize} ${svgSize}`" role="listbox" aria-label="五度圈调性选择器">
          <circle class="fretflow-circle-core" :cx="center" :cy="center" :r="centerHoleRadius" />

          <g
            v-for="(_, index) in keysMajor"
            :key="`major-${index}`"
            class="fretflow-circle-key fretflow-circle-key-major"
            :class="itemClasses(index)"
            @click="fretflowStore.setCircleIndex(index)"
          >
            <path class="fretflow-circle-sector" :d="sectorPath(outerRadius, outerInnerRadius, index)" />
            <text class="fretflow-circle-text" :x="pointAt(outerTextRadius, index).x" :y="pointAt(outerTextRadius, index).y">
              {{ keysMajor[index] }}
            </text>
          </g>

          <g
            v-for="(_, index) in keysMinor"
            :key="`minor-${index}`"
            class="fretflow-circle-key fretflow-circle-key-minor"
            :class="itemClasses(index)"
            @click="fretflowStore.setCircleIndex(index)"
          >
            <path class="fretflow-circle-sector" :d="sectorPath(innerOuterRadius, innerInnerRadius, index)" />
            <text class="fretflow-circle-text" :x="pointAt(innerTextRadius, index).x" :y="pointAt(innerTextRadius, index).y">
              {{ keysMinor[index] }}
            </text>
          </g>
        </svg>
      </div>

      <aside class="fretflow-circle-info">
        <h3>{{ derived.majorKey }}大调 / {{ derived.minorKey }}小调</h3>
        <div class="fretflow-action-row">
          <button type="button" class="fretflow-circle-row is-major" @click="sendToPractice('major')">
            <span>Major Practice</span>
            <strong>{{ derived.majorKey }} 大调练习</strong>
          </button>
          <button type="button" class="fretflow-circle-row is-minor" @click="sendToPractice('minor')">
            <span>Minor Practice</span>
            <strong>{{ derived.minorKey }}小调练习</strong>
          </button>
        </div>

        <section class="fretflow-theory-block">
          <h4>自然和弦</h4>
          <div class="fretflow-degree-table-wrap">
            <div class="fretflow-degree-table">
              <div class="fretflow-degree-table-row is-head">
                <div class="fretflow-degree-table-label fretflow-degree-table-head">级数</div>
                <div class="fretflow-degree-table-track is-static">
                  <div
                    v-for="item in derived.majorDiatonicChords"
                    :key="`degree-${item.roman}`"
                    class="fretflow-degree-table-head"
                  >
                    {{ item.roman }}
                  </div>
                </div>
              </div>

              <div class="fretflow-degree-table-row">
                <div class="fretflow-degree-table-label">大调</div>
                <div
                  class="fretflow-degree-table-track"
                  :class="{ 'is-hovering': degreeHover.major >= 0 }"
                  :style="{ '--active-index': String(Math.max(degreeHover.major, 0)) }"
                  @mouseleave="clearDegreeHover('major')"
                >
                  <button
                    v-for="(item, index) in derived.majorDiatonicChords"
                    :key="`maj-${item.roman}`"
                    type="button"
                    class="fretflow-degree-table-cell"
                    :class="{ 'is-active': degreeHover.major === index }"
                    @mouseenter="setDegreeHover('major', index)"
                    @focus="setDegreeHover('major', index)"
                    @blur="clearDegreeHover('major')"
                    @click="playChordByLabel(item.name)"
                  >
                    <span>{{ item.name }}</span>
                  </button>
                </div>
              </div>

              <div class="fretflow-degree-table-row">
                <div class="fretflow-degree-table-label">小调</div>
                <div
                  class="fretflow-degree-table-track"
                  :class="{ 'is-hovering': degreeHover.minor >= 0 }"
                  :style="{ '--active-index': String(Math.max(degreeHover.minor, 0)) }"
                  @mouseleave="clearDegreeHover('minor')"
                >
                  <button
                    v-for="(item, index) in derived.minorDiatonicChords"
                    :key="`min-${item.roman}`"
                    type="button"
                    class="fretflow-degree-table-cell"
                    :class="{ 'is-active': degreeHover.minor === index }"
                    @mouseenter="setDegreeHover('minor', index)"
                    @focus="setDegreeHover('minor', index)"
                    @blur="clearDegreeHover('minor')"
                    @click="playChordByLabel(item.name)"
                  >
                    <span>{{ item.name }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="fretflow-theory-block fretflow-theory-summary">
          <h4>调性摘要</h4>
          <div class="fretflow-theory-summary-grid">
            <article
              v-for="item in theorySummary"
              :key="item.label"
              class="fretflow-theory-summary-item"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </article>
          </div>
        </section>
      </aside>
    </div>
  </section>
</template>

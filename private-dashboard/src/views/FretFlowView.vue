<script setup>
import { computed, onMounted, watch } from "vue";

import SegmentedTabs from "../components/common/SegmentedTabs.vue";
import CircleOfFifthsPanel from "../components/fretflow/CircleOfFifthsPanel.vue";
import FretFlowPracticePanel from "../components/fretflow/FretFlowPracticePanel.vue";
import MetronomePanel from "../components/fretflow/MetronomePanel.vue";
import { useFretflowStore } from "../stores/fretflow";
import { useSessionStore } from "../stores/session";

const fretflowStore = useFretflowStore();
const sessionStore = useSessionStore();

const topPanelItems = [
  { value: "practice", label: "Practice" },
  { value: "caged", label: "CAGED" },
  { value: "theory", label: "Theory" },
  { value: "songster", label: "Songster" },
];

const activeStage = computed(() => {
  if (fretflowStore.ui.activeTab === "theory") {
    return "theory";
  }
  return fretflowStore.practice.mode === "caged" ? "caged" : "practice";
});

function handleStageChange(value) {
  if (value === "songster") {
    window.open("https://www.songsterr.com/", "_blank", "noopener,noreferrer");
    return;
  }
  if (value === "theory") {
    void fretflowStore.applyPracticePreset({ activeTab: "theory" });
    return;
  }
  if (value === "caged") {
    void fretflowStore.applyPracticePreset({
      activeTab: "practice",
      mode: "caged",
    });
    return;
  }
  void fretflowStore.applyPracticePreset({
    activeTab: "practice",
    mode: "training",
  });
}

onMounted(() => {
  fretflowStore.hydrate();
});

watch(
  () => sessionStore.user?.id,
  () => {
    fretflowStore.hydrate(true);
  },
);
</script>

<template>
  <section class="stage-view">
    <section class="content-panel is-active fretflow-page" aria-labelledby="fretflow-panel-title">
      <div class="panel-header">
        <div>
          <p class="panel-kicker">Practice space</p>
          <h1 id="fretflow-panel-title">FretFlow</h1>
        </div>
      </div>

      <div class="fretflow-stage-row">
        <MetronomePanel />
        <SegmentedTabs
          :items="topPanelItems"
          :model-value="activeStage"
          aria-label="FretFlow 页面切换"
          container-class="fretflow-stage-tabs"
          button-class="fretflow-stage-tab"
          @update:model-value="handleStageChange"
        />
      </div>

      <div class="fretflow-layout">
        <section class="fretflow-main-column">
          <FretFlowPracticePanel v-if="activeStage !== 'theory'" />
          <CircleOfFifthsPanel v-else />
        </section>
      </div>
    </section>
  </section>
</template>

import { defineStore } from "pinia";

import { saveAccountPreferences } from "../services/today-api";
import { useSessionStore } from "./session";

const LOCAL_FRETFLOW_STORAGE_KEY = "lifeflow-private-dashboard-vue-fretflow";

function createDefaultFretflowPreferences() {
  return {
    ui: {
      activeTab: "practice",
      practiceSubtab: "training",
      songsterEnabled: true,
    },
    practice: {
      mode: "training",
      trainingView: "scale",
      root: "C",
      scaleType: "major",
      chordType: "majorTriad",
      chordPosition: 1,
      selectedPatterns: [1],
      showCaged: false,
      lastToast: "点击任意音符即可发声；切换到和弦模式可以试听当前把位。",
    },
    theory: {
      activeCircleIndex: 0,
    },
    metronome: {
      bpm: 120,
      signature: "4/4",
      collapsed: false,
    },
    progress: {
      todayPlan: [],
      courseModules: [],
    },
  };
}

function normalizeFretflowPreferences(preferences = {}) {
  const defaults = createDefaultFretflowPreferences();
  return {
    ui: {
      ...defaults.ui,
      ...(preferences?.ui || {}),
      activeTab: preferences?.ui?.activeTab === "theory" ? "theory" : "practice",
      practiceSubtab: preferences?.ui?.practiceSubtab === "caged" ? "caged" : "training",
      songsterEnabled: preferences?.ui?.songsterEnabled !== false,
    },
    practice: {
      ...defaults.practice,
      ...(preferences?.practice || {}),
      mode: preferences?.practice?.mode === "caged" ? "caged" : "training",
      trainingView: preferences?.practice?.trainingView === "chord" ? "chord" : "scale",
      chordPosition: Math.min(5, Math.max(1, Number(preferences?.practice?.chordPosition) || defaults.practice.chordPosition)),
      selectedPatterns: Array.isArray(preferences?.practice?.selectedPatterns)
        ? preferences.practice.selectedPatterns.filter((value) => Number.isInteger(value) && value >= 1 && value <= 5)
        : defaults.practice.selectedPatterns.slice(),
      showCaged: Boolean(preferences?.practice?.showCaged),
      lastToast: String(preferences?.practice?.lastToast || defaults.practice.lastToast),
    },
    theory: {
      ...defaults.theory,
      ...(preferences?.theory || {}),
      activeCircleIndex: Math.min(11, Math.max(0, Number(preferences?.theory?.activeCircleIndex) || 0)),
    },
    metronome: {
      ...defaults.metronome,
      ...(preferences?.metronome || {}),
      bpm: Math.min(200, Math.max(40, Number(preferences?.metronome?.bpm) || defaults.metronome.bpm)),
      signature: String(preferences?.metronome?.signature || defaults.metronome.signature),
      collapsed: Boolean(preferences?.metronome?.collapsed),
    },
    progress: {
      ...defaults.progress,
      ...(preferences?.progress || {}),
      todayPlan: Array.isArray(preferences?.progress?.todayPlan) ? preferences.progress.todayPlan : [],
      courseModules: Array.isArray(preferences?.progress?.courseModules) ? preferences.progress.courseModules : [],
    },
  };
}

function loadLocalPreferences() {
  try {
    const raw = localStorage.getItem(LOCAL_FRETFLOW_STORAGE_KEY);
    if (!raw) {
      return createDefaultFretflowPreferences();
    }
    return normalizeFretflowPreferences(JSON.parse(raw));
  } catch {
    return createDefaultFretflowPreferences();
  }
}

export const useFretflowStore = defineStore("fretflow", {
  state: () => ({
    ui: createDefaultFretflowPreferences().ui,
    practice: createDefaultFretflowPreferences().practice,
    theory: createDefaultFretflowPreferences().theory,
    metronome: {
      ...createDefaultFretflowPreferences().metronome,
      enabled: false,
      currentBeat: -1,
    },
    progress: createDefaultFretflowPreferences().progress,
    hydratedFor: "",
  }),
  getters: {
    persistedSnapshot(state) {
      return {
        ui: {
          activeTab: state.ui.activeTab,
          practiceSubtab: state.ui.practiceSubtab,
          songsterEnabled: state.ui.songsterEnabled,
        },
        practice: {
          mode: state.practice.mode,
          trainingView: state.practice.trainingView,
          root: state.practice.root,
          scaleType: state.practice.scaleType,
          chordType: state.practice.chordType,
          chordPosition: state.practice.chordPosition,
          selectedPatterns: state.practice.selectedPatterns.slice(),
          showCaged: state.practice.showCaged,
          lastToast: state.practice.lastToast,
        },
        theory: {
          activeCircleIndex: state.theory.activeCircleIndex,
        },
        metronome: {
          bpm: state.metronome.bpm,
          signature: state.metronome.signature,
          collapsed: state.metronome.collapsed,
        },
        progress: {
          todayPlan: state.progress.todayPlan,
          courseModules: state.progress.courseModules,
        },
      };
    },
  },
  actions: {
    applyPreferences(preferences = {}) {
      const normalized = normalizeFretflowPreferences(preferences);
      this.ui = normalized.ui;
      this.practice = normalized.practice;
      this.theory = normalized.theory;
      this.metronome = {
        ...this.metronome,
        ...normalized.metronome,
        enabled: false,
        currentBeat: -1,
      };
      this.progress = normalized.progress;
    },
    hydrate(force = false) {
      const sessionStore = useSessionStore();
      const ownerKey = sessionStore.user?.id || "__guest__";
      if (!force && this.hydratedFor === ownerKey) {
        return;
      }
      const source = sessionStore.user?.preferences?.fretflow || loadLocalPreferences();
      this.applyPreferences(source);
      this.hydratedFor = ownerKey;
    },
    persistLocal() {
      try {
        localStorage.setItem(LOCAL_FRETFLOW_STORAGE_KEY, JSON.stringify(this.persistedSnapshot));
      } catch {
        // Best effort for guest mode.
      }
    },
    async persist() {
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        this.persistLocal();
        return;
      }
      const nextPreferences = {
        ...(sessionStore.user.preferences || {}),
        fretflow: this.persistedSnapshot,
      };
      sessionStore.setPreferences(nextPreferences);
      const response = await saveAccountPreferences(nextPreferences);
      sessionStore.setPreferences(response?.preferences || nextPreferences);
    },
    async setActiveTab(value) {
      this.ui.activeTab = value === "theory" ? "theory" : "practice";
      await this.persist();
    },
    async setPracticeMode(value) {
      this.ui.practiceSubtab = value === "caged" ? "caged" : "training";
      this.practice.mode = this.ui.practiceSubtab;
      await this.persist();
    },
    async applyPracticePreset(preset = {}) {
      this.ui.activeTab = preset.activeTab === "theory" ? "theory" : "practice";

      if (preset.mode) {
        this.ui.practiceSubtab = preset.mode === "caged" ? "caged" : "training";
        this.practice.mode = this.ui.practiceSubtab;
      }

      if (preset.trainingView) {
        this.practice.trainingView = preset.trainingView === "chord" ? "chord" : "scale";
      }

      if (preset.root) {
        this.practice.root = preset.root;
      }

      if (preset.scaleType) {
        this.practice.scaleType = preset.scaleType;
      }

      if (preset.chordType) {
        this.practice.chordType = preset.chordType;
      }

      if (preset.chordPosition != null) {
        this.practice.chordPosition = Math.min(5, Math.max(1, Number(preset.chordPosition) || 1));
      }

      if (typeof preset.showCaged === "boolean") {
        this.practice.showCaged = preset.showCaged;
      }

      if (typeof preset.lastToast === "string") {
        this.practice.lastToast = preset.lastToast;
      }

      await this.persist();
    },
    async setTrainingView(value) {
      this.practice.trainingView = value === "chord" ? "chord" : "scale";
      await this.persist();
    },
    async setRoot(value) {
      this.practice.root = value || "C";
      await this.persist();
    },
    async setScaleType(value) {
      this.practice.scaleType = value || "major";
      await this.persist();
    },
    async setChordType(value) {
      this.practice.chordType = value || "majorTriad";
      await this.persist();
    },
    async setChordPosition(value) {
      this.practice.chordPosition = Math.min(5, Math.max(1, Number(value) || 1));
      await this.persist();
    },
    async togglePattern(pattern) {
      const nextPatterns = this.practice.selectedPatterns.includes(pattern)
        ? this.practice.selectedPatterns.filter((value) => value !== pattern)
        : [...this.practice.selectedPatterns, pattern].sort((a, b) => a - b);
      this.practice.selectedPatterns = nextPatterns.length ? nextPatterns : [pattern];
      await this.persist();
    },
    async setShowCaged(value) {
      this.practice.showCaged = Boolean(value);
      await this.persist();
    },
    setLastToast(message) {
      this.practice.lastToast = String(message || "");
    },
    async setCircleIndex(index) {
      this.theory.activeCircleIndex = ((Number(index) || 0) + 12) % 12;
      await this.persist();
    },
    async shiftCircleIndex(step) {
      await this.setCircleIndex(this.theory.activeCircleIndex + step);
    },
    setMetronomeEnabled(enabled) {
      this.metronome.enabled = Boolean(enabled);
    },
    async setMetronomeCollapsed(value) {
      this.metronome.collapsed = Boolean(value);
      await this.persist();
    },
    setMetronomeBeat(value) {
      this.metronome.currentBeat = Number.isFinite(value) ? value : -1;
    },
    setMetronomeBpm(value) {
      this.metronome.bpm = Math.min(200, Math.max(40, Number(value) || 120));
    },
    async persistMetronomeBpm(value) {
      this.setMetronomeBpm(value);
      await this.persist();
    },
    async setMetronomeSignature(value) {
      this.metronome.signature = value || "4/4";
      await this.persist();
    },
  },
});

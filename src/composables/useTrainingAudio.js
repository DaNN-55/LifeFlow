import { chromaticScale, flatToSharpMap } from "../utils/fretflow/music-theory";

let trainingAudioContext = null;
let trainingMasterGain = null;

function ensureTrainingAudio() {
  if (!trainingAudioContext) {
    trainingAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    trainingMasterGain = trainingAudioContext.createGain();
    trainingMasterGain.gain.value = 0.72;
    trainingMasterGain.connect(trainingAudioContext.destination);
  }
}

function unlockTrainingAudio() {
  ensureTrainingAudio();
  if (trainingAudioContext.state === "suspended") {
    void trainingAudioContext.resume();
  }
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function playTrainingTone(midi, duration = 0.6, when = 0) {
  ensureTrainingAudio();
  const startTime = trainingAudioContext.currentTime + when;
  const osc = trainingAudioContext.createOscillator();
  const osc2 = trainingAudioContext.createOscillator();
  const gain = trainingAudioContext.createGain();
  const lowpass = trainingAudioContext.createBiquadFilter();
  const body = trainingAudioContext.createBiquadFilter();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(midiToFreq(midi), startTime);
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(midiToFreq(midi) * 2, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.65, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.2, startTime + Math.max(0.06, duration * 0.45));
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(2600, startTime);
  lowpass.Q.setValueAtTime(0.7, startTime);
  body.type = "bandpass";
  body.frequency.setValueAtTime(700, startTime);
  body.Q.setValueAtTime(0.35, startTime);

  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(lowpass);
  lowpass.connect(body);
  body.connect(trainingMasterGain);

  osc.start(startTime);
  osc2.start(startTime);
  osc.stop(startTime + duration + 0.02);
  osc2.stop(startTime + duration + 0.02);
}

function playChordMidis(midis = [], gap = 0.03) {
  unlockTrainingAudio();
  midis.forEach((midi, index) => {
    playTrainingTone(midi, 0.9, index * gap);
  });
}

function playChordByLabel(chordLabel, whenOffset = 0) {
  if (!chordLabel) {
    return;
  }
  unlockTrainingAudio();
  const normalized = String(chordLabel).replace("\u00B0", "dim").trim();
  let quality = "major";
  let root = normalized;

  if (normalized.endsWith("dim")) {
    quality = "dim";
    root = normalized.slice(0, -3);
  } else if (normalized.endsWith("m")) {
    quality = "minor";
    root = normalized.slice(0, -1);
  }

  const sharpRoot = flatToSharpMap[root] || root;
  const rootIndex = chromaticScale.indexOf(sharpRoot);
  if (rootIndex < 0) {
    return;
  }

  const intervals = quality === "minor" ? [0, 3, 7] : quality === "dim" ? [0, 3, 6] : [0, 4, 7];
  const baseMidi = 48 + rootIndex;
  intervals.forEach((interval, index) => {
    playTrainingTone(baseMidi + interval, 0.9, whenOffset + index * 0.02);
  });
}

function playProgression(labels = [], chordGap = 0.52) {
  labels.forEach((label, index) => {
    playChordByLabel(label, index * chordGap);
  });
}

export function useTrainingAudio() {
  return {
    unlockTrainingAudio,
    playTrainingTone,
    playChordMidis,
    playChordByLabel,
    playProgression,
  };
}

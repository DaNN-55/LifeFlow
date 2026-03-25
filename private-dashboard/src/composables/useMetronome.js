import { onBeforeUnmount, ref } from "vue";

function parseBeatsPerBar(signatureValue) {
  const [beatsText] = String(signatureValue || "").split("/");
  const beats = Number.parseInt(beatsText, 10);
  return Number.isFinite(beats) && beats > 0 ? beats : 4;
}

export function useMetronome() {
  const currentBeat = ref(-1);
  const running = ref(false);

  let audioContext = null;
  let beatIndex = 0;
  let bpm = 120;
  let beatsPerBar = 4;
  let timerId = 0;

  function ensureAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playClick(accent) {
    ensureAudioContext();
    const time = audioContext.currentTime + 0.02;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.value = accent ? 1200 : 850;
    osc.type = "sine";
    gain.gain.setValueAtTime(accent ? 0.28 : 0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  function clearTimer() {
    if (timerId) {
      window.clearTimeout(timerId);
      timerId = 0;
    }
  }

  function tick() {
    if (!running.value) {
      return;
    }
    const accent = beatIndex === 0;
    playClick(accent);
    currentBeat.value = beatIndex;
    beatIndex = (beatIndex + 1) % beatsPerBar;
    timerId = window.setTimeout(tick, Math.round((60 / bpm) * 1000));
  }

  async function start() {
    if (running.value) {
      return;
    }
    ensureAudioContext();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    running.value = true;
    beatIndex = 0;
    tick();
  }

  function stop() {
    running.value = false;
    clearTimer();
    currentBeat.value = -1;
  }

  async function setEnabled(enabled) {
    if (enabled) {
      await start();
      return;
    }
    stop();
  }

  function syncSettings({ bpm: nextBpm, signature }) {
    bpm = Math.min(200, Math.max(40, Number(nextBpm) || 120));
    beatsPerBar = parseBeatsPerBar(signature);
    beatIndex = beatIndex % beatsPerBar;
    if (running.value) {
      clearTimer();
      tick();
    }
  }

  onBeforeUnmount(() => {
    stop();
  });

  return {
    currentBeat,
    running,
    setEnabled,
    syncSettings,
    stop,
  };
}

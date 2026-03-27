export const chromaticScale = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export const flatToSharpMap = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

export const rootOptions = chromaticScale.map((note) => ({
  value: note,
  label: note,
}));

export const scaleFormulas = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonicMajor: [0, 2, 4, 7, 9],
  pentatonicMinor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
};

export const scaleOptions = [
  { value: "major", label: "自然大调" },
  { value: "minor", label: "自然小调" },
  { value: "pentatonicMajor", label: "大五声音阶" },
  { value: "pentatonicMinor", label: "小五声音阶" },
  { value: "blues", label: "布鲁斯音阶" },
];

export const chordFormulas = {
  majorTriad: { intervals: [0, 4, 7], degrees: ["1", "3", "5"] },
  minorTriad: { intervals: [0, 3, 7], degrees: ["1", "b3", "5"] },
  sus2: { intervals: [0, 2, 7], degrees: ["1", "2", "5"] },
  sus4: { intervals: [0, 5, 7], degrees: ["1", "4", "5"] },
  dominant7: { intervals: [0, 4, 7, 10], degrees: ["1", "3", "5", "b7"] },
  major7: { intervals: [0, 4, 7, 11], degrees: ["1", "3", "5", "7"] },
  minor7: { intervals: [0, 3, 7, 10], degrees: ["1", "b3", "5", "b7"] },
};

export const chordOptions = [
  { value: "majorTriad", label: "大三和弦" },
  { value: "minorTriad", label: "小三和弦" },
  { value: "sus2", label: "挂二和弦" },
  { value: "sus4", label: "挂四和弦" },
  { value: "dominant7", label: "属七和弦" },
  { value: "major7", label: "大七和弦" },
  { value: "minor7", label: "小七和弦" },
];

export const chordPositionOptions = [
  { value: "1", label: "C 指型" },
  { value: "2", label: "A 指型" },
  { value: "3", label: "G 指型" },
  { value: "4", label: "E 指型" },
  { value: "5", label: "D 指型" },
];

export const trainingViewOptions = [
  { value: "scale", label: "音阶" },
  { value: "chord", label: "和弦" },
];

export const keysMajor = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];
export const keysMinor = ["Am", "Em", "Bm", "F#m", "C#m", "G#m", "D#m", "Bbm", "Fm", "Cm", "Gm", "Dm"];

const noteMap = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  "E#": 5,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
  "B#": 0,
};

const intervals = {
  majorScale: [0, 2, 4, 5, 7, 9, 11],
  minorScale: [0, 2, 3, 5, 7, 8, 10],
};

const romanToDegree = {
  I: 0,
  ii: 1,
  iii: 2,
  IV: 3,
  V: 4,
  vi: 5,
  viiDim: 6,
};

const progressionTemplates = [
  ["I", "IV", "V", "I"],
  ["I", "V", "vi", "IV"],
  ["ii", "V", "I"],
  ["I", "vi", "ii", "V"],
  ["vi", "IV", "I", "V"],
];

export function normalizeRoot(root = "C") {
  return flatToSharpMap[root] || root;
}

export function getNotesFromFormula(root, formula = []) {
  const normalizedRoot = normalizeRoot(root);
  const rootIndex = chromaticScale.indexOf(normalizedRoot);
  if (rootIndex < 0) {
    return [];
  }
  return formula.map((interval) => chromaticScale[(rootIndex + interval) % 12]);
}

function parseNoteToken(note) {
  const match = String(note || "").match(/^([A-G])([#b]?)(m?)$/);
  if (!match) {
    return null;
  }
  return {
    letter: match[1],
    accidental: match[2] || "",
    minor: Boolean(match[3]),
  };
}

function accidentalFromDiff(diff) {
  if (diff === 0) return "";
  if (diff === 1) return "#";
  if (diff === 11) return "b";
  return "";
}

export function computeScale(rootKey, mode = "major") {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const naturalMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const token = parseNoteToken(rootKey);
  if (!token || noteMap[rootKey] == null) {
    return [];
  }
  const startLetterIndex = letters.indexOf(token.letter);
  const rootPitch = noteMap[rootKey];
  const formula = mode === "minor" ? intervals.minorScale : intervals.majorScale;
  return formula.map((step, degreeIndex) => {
    const targetPitch = (rootPitch + step) % 12;
    const letter = letters[(startLetterIndex + degreeIndex) % letters.length];
    const naturalPitch = naturalMap[letter];
    const diff = (targetPitch - naturalPitch + 12) % 12;
    return `${letter}${accidentalFromDiff(diff)}`;
  });
}

function buildChordName(scaleNote, quality) {
  if (quality === "minor") return `${scaleNote}m`;
  if (quality === "dim") return `${scaleNote}\u00B0`;
  return scaleNote;
}

function computeMajorChords(scaleNotes) {
  const romans = ["I", "ii", "iii", "IV", "V", "vi", "vii\u00B0"];
  const qualities = ["major", "minor", "minor", "major", "major", "minor", "dim"];
  return romans.map((roman, idx) => ({
    roman,
    name: buildChordName(scaleNotes[idx], qualities[idx]),
  }));
}

function computeMinorChords(scaleNotes) {
  const romans = ["i", "ii\u00B0", "III", "iv", "v", "VI", "VII"];
  const qualities = ["minor", "dim", "major", "minor", "minor", "major", "major"];
  return romans.map((roman, idx) => ({
    roman,
    name: buildChordName(scaleNotes[idx], qualities[idx]),
  }));
}

function resolveDegree(roman) {
  if (roman === "viiDim" || roman === "vii掳" || roman === "vii\u00B0") {
    return 6;
  }
  return romanToDegree[roman];
}

function computeProgressions(diatonicChords) {
  return progressionTemplates.map((template) => {
    const mappedChords = template.map((roman) => {
      const degree = resolveDegree(roman);
      return diatonicChords[degree] ? diatonicChords[degree].name : roman;
    });
    return {
      roman: template.join(" - "),
      value: mappedChords.join(" - "),
    };
  });
}

export function computeCircleDerived(activeIndex = 0) {
  const index = ((Number(activeIndex) || 0) + keysMajor.length) % keysMajor.length;
  const majorKey = keysMajor[index];
  const minorKey = keysMinor[index];
  const minorTonic = minorKey.endsWith("m") ? minorKey.slice(0, -1) : minorKey;
  const majorScaleNotes = computeScale(majorKey, "major");
  const minorScaleNotes = computeScale(minorTonic, "minor");
  const majorDiatonicChords = computeMajorChords(majorScaleNotes);
  const minorDiatonicChords = computeMinorChords(minorScaleNotes);
  const progressions = computeProgressions(majorDiatonicChords);
  const relatedIndices = [
    (index + keysMajor.length - 1) % keysMajor.length,
    index,
    (index + 1) % keysMajor.length,
  ];
  return {
    index,
    majorKey,
    minorKey,
    majorScaleNotes,
    minorScaleNotes,
    majorDiatonicChords,
    minorDiatonicChords,
    progressions,
    relatedIndices,
  };
}

import { chordFormulas, getNotesFromFormula, scaleFormulas, normalizeRoot } from "./music-theory";

export const openStrings = ["E", "B", "G", "D", "A", "E"];
export const openStringMidis = [64, 59, 55, 50, 45, 40];
export const maxFret = 15;

export const patternRules = {
  1: {
    inPattern: (_stringIndex, fret) => fret <= 3,
    chordAllowed: (stringIndex, fret) => !((stringIndex === 5 && fret === 0) || (stringIndex === 0 && fret === 3)),
  },
  2: {
    inPattern: (_stringIndex, fret) => fret >= 2 && fret <= 6,
    chordAllowed: (stringIndex, fret) => !(stringIndex === 3 && fret === 2),
  },
  3: {
    inPattern: (stringIndex, fret) => {
      if (stringIndex === 2 && fret === 4) return true;
      if (fret >= 5 && fret <= 9) {
        if ((stringIndex === 3 && fret === 9) || (stringIndex === 2 && fret === 9)) return false;
        return true;
      }
      return false;
    },
    chordAllowed: (stringIndex, fret) => !(stringIndex === 1 && fret === 8),
  },
  4: {
    inPattern: (_stringIndex, fret) => fret >= 7 && fret <= 11,
    chordAllowed: (stringIndex, fret) => !(stringIndex === 4 && fret === 7),
  },
  5: {
    inPattern: (stringIndex, fret) => {
      const layout = [
        { stringIndex: 5, frets: [10, 12, 13] },
        { stringIndex: 4, frets: [10, 12] },
        { stringIndex: 3, frets: [9, 10, 12] },
        { stringIndex: 2, frets: [9, 10, 12] },
        { stringIndex: 1, frets: [10, 12, 13] },
        { stringIndex: 0, frets: [10, 12, 13] },
      ];
      return layout.some((item) => item.stringIndex === stringIndex && item.frets.includes(fret));
    },
    chordAllowed: (stringIndex, fret) => !(stringIndex === 2 && fret === 9),
  },
};

export const patternOptions = [
  { value: 1, label: "C 指型" },
  { value: 2, label: "A 指型" },
  { value: 3, label: "G 指型" },
  { value: 4, label: "E 指型" },
  { value: 5, label: "D 指型" },
];

export const chordPositionRanges = {
  1: [0, 3],
  2: [2, 6],
  3: [5, 9],
  4: [7, 11],
  5: [9, 13],
};

export const fretMarkerFrets = [3, 5, 7, 9, 12, 15];

function createBaseBoard(limit = maxFret) {
  return openStrings.map((root, stringIndex) => {
    const notes = Array.from({ length: limit + 1 }, (_, fret) => {
      const rootIndex = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].indexOf(root);
      const note = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][(rootIndex + fret) % 12];
      return {
        id: `${stringIndex}-${fret}`,
        stringIndex,
        fret,
        note,
        midi: openStringMidis[stringIndex] + fret,
      };
    });
    return {
      id: `string-${stringIndex}`,
      stringIndex,
      notes,
    };
  });
}

const baseBoard = createBaseBoard();

function isInChordPosition(fret, chordPosition) {
  const range = chordPositionRanges[chordPosition];
  if (!range) {
    return true;
  }
  return fret >= range[0] && fret <= range[1];
}

function getVoicedChordFrets(root, chordType, chordPosition) {
  const formula = chordFormulas[chordType] || chordFormulas.majorTriad;
  const chordNotes = new Set(getNotesFromFormula(root, formula.intervals));
  const voiced = new Map();
  for (let stringIndex = 5; stringIndex >= 0; stringIndex -= 1) {
    const candidates = baseBoard[stringIndex].notes.filter((spot) => chordNotes.has(spot.note) && isInChordPosition(spot.fret, chordPosition));
    if (!candidates.length) {
      continue;
    }
    voiced.set(stringIndex, candidates[0].fret);
  }
  return voiced;
}

function getActivePatterns(patterns = []) {
  return Array.isArray(patterns) && patterns.length ? patterns.filter((pattern) => patternRules[pattern]) : [];
}

export function buildFretboardState(practice = {}) {
  const mode = practice.mode === "caged" ? "caged" : "training";
  const root = normalizeRoot(practice.root || "C");
  const scaleType = scaleFormulas[practice.scaleType] ? practice.scaleType : "major";
  const chordType = chordFormulas[practice.chordType] ? practice.chordType : "majorTriad";
  const trainingView = practice.trainingView === "chord" ? "chord" : "scale";
  const chordPosition = Number(practice.chordPosition) || 1;
  const selectedPatterns = getActivePatterns(practice.selectedPatterns);
  const activePatterns = mode === "caged" ? selectedPatterns : [];
  const scaleNotes = new Set(getNotesFromFormula(root, scaleFormulas[scaleType]));
  const chordFormula = chordFormulas[chordType] || chordFormulas.majorTriad;
  const chordNotes = getNotesFromFormula(root, chordFormula.intervals);
  const chordNoteSet = new Set(chordNotes);
  const degreeMap = new Map();
  chordNotes.forEach((note, index) => {
    degreeMap.set(note, chordFormula.degrees[index]);
  });
  const voicedChordFrets = mode === "training" && trainingView === "chord"
    ? getVoicedChordFrets(root, chordType, chordPosition)
    : new Map();

  const strings = baseBoard.map((string) => ({
    ...string,
    notes: string.notes.map((spot) => {
      const inPattern = activePatterns.length ? activePatterns.some((pattern) => patternRules[pattern].inPattern(spot.stringIndex, spot.fret)) : true;
      const cagedAllowed = activePatterns.some((pattern) => patternRules[pattern].inPattern(spot.stringIndex, spot.fret) && patternRules[pattern].chordAllowed(spot.stringIndex, spot.fret));

      let isActive = false;
      let tone = "muted";
      if (mode === "training") {
        if (trainingView === "scale") {
          isActive = scaleNotes.has(spot.note);
          tone = "scale";
        } else {
          isActive = chordNoteSet.has(spot.note) && voicedChordFrets.get(spot.stringIndex) === spot.fret;
          tone = "chord";
        }
      } else if (practice.showCaged) {
        isActive = activePatterns.length ? chordNoteSet.has(spot.note) && cagedAllowed : chordNoteSet.has(spot.note);
        tone = "chord";
      } else {
        isActive = inPattern && scaleNotes.has(spot.note);
        tone = "scale";
      }

      return {
        ...spot,
        isActive,
        isRoot: isActive && spot.note === root,
        tone,
        isPatterned: inPattern,
        isChordTone: chordNoteSet.has(spot.note),
        degree: isActive && chordNoteSet.has(spot.note) ? degreeMap.get(spot.note) || "" : "",
      };
    }),
  }));

  return {
    root,
    scaleType,
    trainingView,
    chordType,
    chordPosition,
    strings,
    scaleNotes: Array.from(scaleNotes),
    chordNotes,
    voicedChordMidis: strings
      .flatMap((string) => string.notes)
      .filter((spot) => spot.isActive && (trainingView === "chord" || practice.showCaged))
      .map((spot) => spot.midi),
  };
}

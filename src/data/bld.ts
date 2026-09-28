/**
 * Blindfolded execution — how each letter is solved, per method (Speffz
 * letters, the cubecore/bld scheme):
 *
 *  - Old Pochmann edges: buffer UR (B), swap with UL (D) by T-perm; A (UB)
 *    and C (UF) straight with a J-perm (they swap the same two corners as
 *    the T-perm, so pairs still cancel).
 *  - Old Pochmann corners: buffer ULB (A), swap with RDF (P) by the modified
 *    Y-perm.
 *  - M2 edges: buffer DF (U), swap with UB (A) by M2. UF / DB (C, W) and
 *    FU / BD (I, S) swap round on a pair's second letter — the first M2
 *    moved them; BU (Q) has its own algorithm.
 *
 * The setups keep the buffer and whatever the swap algorithm moves on the
 * side; they were found by search and every pair is checked on the cube
 * model (bld.test.ts) — solving letters X then Y from solved leaves exactly
 * the buffer → X → Y cycle, nothing else moved.
 */

import { CORNER_BUFFER, EDGE_BUFFER, SPEFFZ } from "@wodzik/cubecore/bld";
import { FRAMES, type State, formatAlg, invert, parseAlg, view } from "@wodzik/cubecore/core";

export type BldMethodId = "op-edges" | "op-corners" | "m2";

export interface BldMethod {
  id: BldMethodId;
  name: string;
  kind: "edge" | "corner";
  /** Buffer sticker (facelet index) and its letter(s) — the buffer piece's letters are never targets. */
  buffer: number;
  bufferLetters: string[];
  /** The swap everything is set up to. */
  swap: { name: string; alg: string; target: string };
  /** Letter → setup moves (undone after the swap). */
  setups: Record<string, string>;
  /** Letters done with their own algorithm instead of setup + swap. */
  direct: Record<string, { name: string; alg: string }>;
  /** Letters that swap round when they're a pair's second letter (M2: C ↔ W, I ↔ S). */
  secondOfPair?: Record<string, string>;
  parity: { name: string; alg: string; when: string };
  /**
   * What a setup must do (the setups drill): bring the letter's sticker to
   * `dest`, and leave every sticker in `keep` where it was — the buffer, and
   * what the swap moves on the side (or, for M2, the M slice).
   */
  setupRule: { dest: number; keep: number[] };
}

export const T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'";
export const JA_PERM = "R2 D R D' R F2 r' F r F2"; // = x R2 F R F' R U2 r' U r U2 x', without the rotation
export const JB_PERM = "R U R' F' R U R' U' R' F R2 U' R' U'";
export const MODIFIED_Y = "R U' R' U' R U R' F' R U R' U' R' F R";
export const RA_PARITY = "R U' R' U' R U R D R' U' R D' R' U2 R' U'";
export const M2_PARITY = "D' L2 D M2 D' L2 D";

export const OP_EDGES: BldMethod = {
  id: "op-edges",
  name: "Old Pochmann edges",
  kind: "edge",
  buffer: EDGE_BUFFER,
  bufferLetters: ["B", "M"],
  swap: { name: "T-perm", alg: T_PERM, target: "D" },
  setups: {
    D: "",
    E: "L d' L",
    F: "d' L",
    G: "L d L'",
    H: "d L'",
    I: "l D' L2",
    J: "d2 L",
    K: "F L' F'",
    L: "L'",
    N: "d L",
    O: "D B' L B",
    P: "d' L'",
    Q: "l' D L2",
    R: "L",
    S: "B' L B",
    T: "d2 L'",
    U: "D' L2",
    V: "D2 L2",
    W: "D L2",
    X: "L2",
  },
  direct: {
    A: { name: "Ja-perm", alg: JA_PERM },
    C: { name: "Jb-perm", alg: JB_PERM },
  },
  parity: { name: "Ra-perm", alg: RA_PARITY, when: "an odd number of edge letters: after the edges, before the corners" },
  // UL; keep UR (buffer) and the corners the T-perm swaps (UBR, UFR).
  setupRule: { dest: 3, keep: [5, 10, 2, 45, 11, 8, 9, 20] },
};

export const OP_CORNERS: BldMethod = {
  id: "op-corners",
  name: "Old Pochmann corners",
  kind: "corner",
  buffer: CORNER_BUFFER,
  bufferLetters: ["A", "E", "R"],
  swap: { name: "modified Y-perm", alg: MODIFIED_Y, target: "P" },
  setups: {
    B: "R D'",
    C: "F",
    D: "F R'",
    F: "F2",
    G: "D2 R",
    H: "D2",
    I: "F' D",
    J: "R2 D'",
    K: "R F",
    L: "D",
    M: "R'",
    N: "R2",
    O: "R",
    P: "",
    Q: "R' F",
    S: "D' R",
    T: "D'",
    U: "F'",
    V: "R' D'",
    W: "R2 F",
    X: "D F'",
  },
  direct: {},
  parity: { name: "Ra-perm", alg: RA_PARITY, when: "an odd number of edge letters: between the edges and the corners" },
  // RDF; keep ULB (buffer) and the edges the Y-perm swaps (UB, UL).
  setupRule: { dest: 15, keep: [0, 36, 47, 1, 46, 3, 37] },
};

/** DF, U side — the M2 buffer. */
const M2_BUFFER = 28;

export const M2_EDGES: BldMethod = {
  id: "m2",
  name: "M2 edges",
  kind: "edge",
  buffer: M2_BUFFER,
  bufferLetters: ["U", "K"],
  swap: { name: "M2", alg: "M2", target: "A" },
  setups: {
    A: "",
    B: "F U' F'",
    D: "F U F'",
    E: "B L' B'",
    F: "F U2 F'",
    G: "B L B'",
    H: "D B' D'",
    J: "U R U'",
    L: "U' L' U",
    M: "B' R B",
    N: "D B D'",
    O: "B' R' B",
    P: "F' U2 F",
    R: "U' L U",
    T: "U R' U'",
    V: "U R2 U'",
    X: "U' L2 U",
  },
  direct: {
    C: { name: "UF", alg: "U2 M' U2 M'" },
    W: { name: "DB", alg: "M U2 M U2" },
    I: { name: "FU", alg: "D M' U R2 U' M U R2 U' D' M2" },
    S: { name: "BD", alg: "M2 D U R2 U' M' U R2 U' M D'" },
    Q: { name: "BU", alg: "U B' R U' B M2 B' U R' B U'" },
  },
  secondOfPair: { C: "W", W: "C", I: "S", S: "I" },
  parity: { name: "M2 parity", alg: M2_PARITY, when: "an odd number of edge letters: after the edges (then solve corners with UB and UL swapped)" },
  // UB; keep the M slice's other edges (UF, DF, DB).
  setupRule: { dest: 1, keep: [7, 19, 28, 25, 34, 52] },
};

export const BLD_METHODS: Record<BldMethodId, BldMethod> = { "op-edges": OP_EDGES, "op-corners": OP_CORNERS, m2: M2_EDGES };

/** Every letter of the method's kind — the scheme's, in order. */
export function methodLetters(method: BldMethod): string[] {
  const table = method.kind === "edge" ? SPEFFZ.edges : SPEFFZ.corners;
  return Object.values(table).sort();
}

/** Letters that can be shot to (not on the buffer piece). */
export const targetLetters = (method: BldMethod): string[] => methodLetters(method).filter((l) => !method.bufferLetters.includes(l));

/** Sticker position of a letter. */
export function letterPosition(method: BldMethod, letter: string): number {
  const table = method.kind === "edge" ? SPEFFZ.edges : SPEFFZ.corners;
  const hit = Object.entries(table).find(([, l]) => l === letter);
  if (!hit) throw new Error(`No ${method.kind} letter ${letter}`);
  return Number(hit[0]);
}

const undo = (alg: string) => (alg.trim() ? formatAlg(invert(parseAlg(alg))) : "");

export interface LetterSolution {
  letter: string;
  /** The algorithm used for it ("T-perm", "Ja-perm", "M2"…). */
  name: string;
  setup: string;
  alg: string;
  undo: string;
  /** setup + alg + undo, one line. */
  full: string;
  /** A pair's second letter swapped round (M2): the letter actually shot to. */
  shotAs?: string;
}

/** How to solve `letter` — `second`: it's the second letter of a pair (M2 swaps some round). */
export function solveLetter(method: BldMethod, letter: string, second = false): LetterSolution {
  const shotAs = second ? method.secondOfPair?.[letter] : undefined;
  const l = shotAs ?? letter;
  const direct = method.direct[l];
  if (direct) return { letter, name: direct.name, setup: "", alg: direct.alg, undo: "", full: direct.alg, ...(shotAs ? { shotAs } : {}) };
  const setup = method.setups[l];
  if (setup === undefined) throw new Error(`${method.name}: no way for ${letter}`);
  const u = undo(setup);
  return {
    letter,
    name: method.swap.name,
    setup,
    alg: method.swap.alg,
    undo: u,
    full: [setup, method.swap.alg, u].filter(Boolean).join(" "),
    ...(shotAs ? { shotAs } : {}),
  };
}

/** Both letters of a pair. */
export const solvePair = (method: BldMethod, first: string, second: string): [LetterSolution, LetterSolution] => [
  solveLetter(method, first),
  solveLetter(method, second, true),
];

/** Where each Speffz letter is: the sticker's face first (edge "LU" = the L sticker of the UL edge). */
export const EDGE_STICKER: Record<string, string> = {
  A: "UB", B: "UR", C: "UF", D: "UL", E: "LU", F: "LF", G: "LD", H: "LB", I: "FU", J: "FR", K: "FD", L: "FL",
  M: "RU", N: "RB", O: "RD", P: "RF", Q: "BU", R: "BL", S: "BD", T: "BR", U: "DF", V: "DR", W: "DB", X: "DL",
};
export const CORNER_STICKER: Record<string, string> = {
  A: "UBL", B: "UBR", C: "UFR", D: "UFL", E: "LUB", F: "LUF", G: "LDF", H: "LDB", I: "FUL", J: "FUR", K: "FDR", L: "FDL",
  M: "RUF", N: "RUB", O: "RDB", P: "RDF", Q: "BUR", R: "BUL", S: "BDL", T: "BDR", U: "DFL", V: "DFR", W: "DBR", X: "DBL",
};
export const stickerName = (method: BldMethod, letter: string): string => (method.kind === "edge" ? EDGE_STICKER : CORNER_STICKER)[letter] ?? letter;

/** Letters drilled as setups: those with setup moves (not the swap spot itself, not the ones with their own algorithm). */
export const setupLetters = (method: BldMethod): string[] => targetLetters(method).filter((l) => !!method.setups[l]);

/**
 * `current` (from `start`) is a finished setup for `letter`: its sticker on
 * the swap spot, nothing in `keep` moved. Any setup counts, not only the
 * table's. Checked in every whole-cube frame — a wide move (d, l) turns the
 * cube's core, and with it the frame the smart cube reports in.
 */
export function setupDone(method: BldMethod, start: State, current: State, letter: string): boolean {
  const p = letterPosition(method, letter);
  const { dest, keep } = method.setupRule;
  return FRAMES.some((f) => {
    const v = view(current, f);
    return v[dest] === start[p] && keep.every((k) => v[k] === start[k]);
  });
}

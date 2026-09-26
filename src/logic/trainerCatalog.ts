/**
 * The skill trainers, on cubecore: what each one practises (a StageDef the
 * solver worker runs — exact optimal lengths, all optimal solutions), its
 * variants (slot, side…), levels (optimal move counts), mask and how "done"
 * is checked.
 *
 * Everything is written for cubecore's canonical frame (cross / first layer
 * on D, Roux blocks on L / R) and placed on the cube by a FRAME: the colour
 * you build on goes down (white by default for CFOP / ZZ — held white down,
 * green front — yellow for Roux). Scrambles are physical moves (applied
 * holding the cube white up, green front, as always); what the solver says
 * back (hints, solutions) is re-lettered for the cube as held.
 */

import {
  type AnyStageDef,
  FACELETS,
  type Face,
  type Frame,
  type MaskRule,
  PIECE,
  type Piece,
  type State,
  type StageDef,
  type Vec3,
  checks,
  frameFor,
  isLseStage,
  view,
} from "@cubecore/core";
import { CFOP_MASKS, CFOP_TRAINERS, type F2LSlot } from "@cubecore/cfop";
import { CMLL_CASES, ROUX_MASKS, ROUX_TRAINERS, cmll } from "@cubecore/roux";
import { ZZ_TRAINERS } from "@cubecore/zz";
import type { TrainerType } from "../types/trainer";

export type Family = "cross" | "f2l" | "roux" | "zz";

export const FAMILIES: { id: Family; label: string }[] = [
  { id: "cross", label: "Cross+" },
  { id: "f2l", label: "F2L" },
  { id: "roux", label: "Roux" },
  { id: "zz", label: "ZZ" },
];

export interface Variants {
  /** Label in the header ("Slot", "Side"…). */
  label: string;
  options: readonly (readonly [value: string, label: string])[];
  default: string;
}

export interface TrainerDef {
  id: TrainerType;
  family: Family;
  label: string;
  /** What to do, shown while solving ({v} = the variant's label). */
  goal: string;
  variants?: Variants;
  /** Optimal-length levels (null: none — random cases, F2L from scramble / CMLL). */
  levels: { min: number; max: number; default: number } | null;
  /** The solver stage (null: no exact solver — F2L with 3+ slots). */
  stage: (variant: string, slots: readonly F2LSlot[]) => AnyStageDef | null;
  mask: (variant: string, slots: readonly F2LSlot[]) => MaskRule;
  /** Moves counted in slice turns (M = 1) — Roux. */
  stm?: boolean;
}

export const SLOTS: readonly F2LSlot[] = ["FR", "FL", "BR", "BL"];
const SLOT_VARIANTS: Variants = { label: "Slot", options: SLOTS.map((s) => [s, s] as const), default: "FR" };
const PAIRS = [["FR+FL", "FR+FL"], ["FR+BR", "FR+BR"], ["FL+BL", "FL+BL"], ["BR+BL", "BR+BL"], ["FR+BL", "FR+BL"], ["FL+BR", "FL+BR"]] as const;
const SIDES: Variants = { label: "Square", options: [["front", "front"], ["back", "back"]], default: "front" };
const CMLL_GROUPS = ["all", ...new Set(CMLL_CASES.map((c) => c.group).filter((g) => g !== "Solved"))];

const CROSS: readonly Piece[] = [PIECE.DR, PIECE.DF, PIECE.DL, PIECE.DB];
const SLOT_PIECES: Record<F2LSlot, readonly [Piece, Piece]> = {
  FR: [PIECE.FR, PIECE.DFR],
  FL: [PIECE.FL, PIECE.DLF],
  BL: [PIECE.BL, PIECE.DBL],
  BR: [PIECE.BR, PIECE.DRB],
};

/** F2L of chosen slots: the cross and the other slots stay (they're solved in the case), these get paired and inserted. */
export function f2lStage(slots: readonly F2LSlot[]): StageDef {
  const order = SLOTS.filter((s) => slots.includes(s));
  const rest = SLOTS.filter((s) => !slots.includes(s));
  const pieces = [...CROSS, ...order.flatMap((s) => SLOT_PIECES[s]), ...rest.flatMap((s) => SLOT_PIECES[s])];
  const trained = order.length * 2;
  return {
    name: `f2l-${order.join("")}`,
    pieces,
    groups: Array.from({ length: trained }, (_, i) => [0, 1, 2, 3, 4 + i]),
    keep: [0, 1, 2, 3, ...Array.from({ length: rest.length * 2 }, (_, i) => 4 + trained + i)],
  };
}
/** Pieces the F2L drill keeps solved: the slots not being practised (the cross comes with the scramble preset). */
export const f2lKeep = (slots: readonly F2LSlot[]): Piece[] => SLOTS.filter((s) => !slots.includes(s)).flatMap((s) => SLOT_PIECES[s]);

const inSlot = (slots: readonly F2LSlot[]) => {
  const at = { FR: [1, 1], FL: [-1, 1], BR: [1, -1], BL: [-1, -1] } as const;
  return (p: readonly number[]) => slots.some((s) => p[0] === at[s][0] && p[2] === at[s][1]);
};

export const TRAINERS: readonly TrainerDef[] = [
  { id: "cross", family: "cross", label: "Cross", goal: "Solve the cross!", levels: { min: 1, max: 8, default: 5 }, stage: () => CFOP_TRAINERS.cross(), mask: () => CFOP_MASKS.cross },
  {
    id: "xcross",
    family: "cross",
    label: "XCross",
    goal: "Solve the cross + {v} pair!",
    variants: SLOT_VARIANTS,
    levels: { min: 2, max: 10, default: 7 },
    stage: (v) => CFOP_TRAINERS.xcross(v as F2LSlot),
    mask: (v) => stageMaskRule(CFOP_TRAINERS.xcross(v as F2LSlot)),
  },
  {
    id: "xxcross",
    family: "cross",
    label: "XXCross",
    goal: "Solve the cross + {v} pairs!",
    variants: { label: "Slots", options: PAIRS, default: "FR+FL" },
    levels: { min: 3, max: 10, default: 7 },
    stage: (v) => CFOP_TRAINERS.xxcross(...(v.split("+") as [F2LSlot, F2LSlot])),
    mask: (v) => stageMaskRule(CFOP_TRAINERS.xxcross(...(v.split("+") as [F2LSlot, F2LSlot]))),
  },
  {
    id: "pair",
    family: "cross",
    label: "Pair",
    goal: "Form the {v} pair (cross stays)!",
    variants: SLOT_VARIANTS,
    levels: { min: 1, max: 9, default: 5 },
    stage: (v) => CFOP_TRAINERS.pair(v as F2LSlot),
    mask: (v) => stageMaskRule(CFOP_TRAINERS.pair(v as F2LSlot)),
  },
  {
    id: "f2l",
    family: "f2l",
    label: "Slots",
    goal: "Insert the {v} (cross stays)!",
    levels: null,
    // Exact solutions only while it's small enough to search (1–2 slots).
    stage: (_v, slots) => (slots.length <= 2 ? f2lStage(slots) : null),
    mask: (_v, slots) => {
      const trained = inSlot(slots);
      return (_f, c) => (c.kind === "center" || (c.kind === "edge" && c.pos[1] === -1) || (c.pos[1] <= 0 && trained(c.pos)) ? "regular" : c.pos[1] <= 0 ? "dim" : "ignored");
    },
  },
  { id: "fs", family: "roux", label: "FS", goal: "Build the {v} first square!", variants: SIDES, levels: { min: 2, max: 6, default: 4 }, stage: (v) => ROUX_TRAINERS.fs(v as "front"), mask: (v) => stageMaskRule(ROUX_TRAINERS.fs(v as "front")), stm: true },
  { id: "fb", family: "roux", label: "FB", goal: "Build the first block (left 1×2×3)!", levels: { min: 3, max: 8, default: 6 }, stage: () => ROUX_TRAINERS.fb(), mask: () => ROUX_MASKS.fb, stm: true },
  {
    id: "fbdr",
    family: "roux",
    label: "FB+DR",
    goal: "Finish the first block + DR edge!",
    variants: { ...SIDES, label: "Solved FS" },
    levels: { min: 2, max: 7, default: 5 },
    stage: (v) => ROUX_TRAINERS.fbdr(v as "front"),
    mask: (v) => stageMaskRule(ROUX_TRAINERS.fbdr(v as "front")),
    stm: true,
  },
  { id: "ss", family: "roux", label: "SS", goal: "Solve the {v} second square (FB stays)!", variants: SIDES, levels: { min: 3, max: 10, default: 7 }, stage: (v) => ROUX_TRAINERS.ss(v as "front"), mask: (v) => stageMaskRule(ROUX_TRAINERS.ss(v as "front")), stm: true },
  {
    id: "cmll",
    family: "roux",
    label: "CMLL",
    goal: "Recognise and solve the CMLL case!",
    variants: { label: "Cases", options: CMLL_GROUPS.map((g) => [g, g === "all" ? "all" : g] as const), default: "all" },
    levels: null,
    stage: () => null,
    mask: () => ROUX_MASKS.cmll,
    stm: true,
  },
  { id: "eolr", family: "roux", label: "EOLR", goal: "Orient the edges and prepare UL / UR!", levels: { min: 3, max: 10, default: 6 }, stage: () => ROUX_TRAINERS.eolr(), mask: () => ROUX_MASKS.eo, stm: true },
  { id: "lse", family: "roux", label: "LSE", goal: "Solve the last six edges (M / U)!", levels: { min: 3, max: 12, default: 8 }, stage: () => ROUX_TRAINERS.lse(), mask: () => ROUX_MASKS.lse, stm: true },
  { id: "eoline", family: "zz", label: "EOLine", goal: "Orient every edge and place DF + DB!", levels: { min: 2, max: 9, default: 5 }, stage: () => ZZ_TRAINERS.eoline(), mask: () => eoMask(ZZ_TRAINERS.eoline()) },
  { id: "eocross", family: "zz", label: "EOCross", goal: "Solve the cross with every edge oriented!", levels: { min: 3, max: 10, default: 6 }, stage: () => ZZ_TRAINERS.eocross(), mask: () => eoMask(ZZ_TRAINERS.eocross()) },
  {
    id: "zz-block",
    family: "zz",
    label: "Block",
    goal: "Build the {v} block (R U L only)!",
    variants: { label: "Block", options: [["left", "left"], ["right", "right"]], default: "left" },
    levels: { min: 3, max: 10, default: 6 },
    stage: (v) => ZZ_TRAINERS.block(v as "left"),
    mask: (v) => stageMaskRule(ZZ_TRAINERS.block(v as "left")),
  },
];

/** EO stages: the stage's pieces in colour, the other edges as orientation material. */
function eoMask(def: AnyStageDef): MaskRule {
  const base = stageMaskRule(def);
  return (f, c) => {
    const s = base(f, c);
    return s === "regular" || c.kind !== "edge" ? s : "oriented";
  };
}

export const trainerById = (id: string): TrainerDef | undefined => TRAINERS.find((t) => t.id === id);

/** Colours to build on: the face whose colour goes down (home colour scheme). */
export const BOTTOM_COLOURS: readonly (readonly [Face, string, string])[] = [
  ["U", "White", "#f4f4f5"],
  ["D", "Yellow", "#facc15"],
  ["F", "Green", "#22c55e"],
  ["B", "Blue", "#3b82f6"],
  ["R", "Red", "#ef4444"],
  ["L", "Orange", "#f97316"],
];
export const DEFAULT_BOTTOM: Record<Family, Face> = { cross: "U", f2l: "U", zz: "U", roux: "D" };

/** How the cube is held for `bottom` down: green in front when it can be, else white (U). */
export function frameForBottom(bottom: Face): Frame {
  return frameFor(bottom, bottom === "F" || bottom === "B" ? "U" : "F");
}

/**
 * Is the practised step done (state: the cube's physical state)? F2L and
 * CMLL checked right here; the solver stages say it with distance 0 (see
 * the page — asked of the worker).
 */
export function doneLocally(def: TrainerDef, state: State, frame: Frame): boolean | null {
  if (def.id === "f2l") return checks.f2lSolved(view(state, frame));
  if (def.id === "cmll") return cmll(view(state, frame));
  return null;
}

const LL_EDGES: readonly Piece[] = [PIECE.UF, PIECE.UR, PIECE.UB, PIECE.UL, PIECE.DF, PIECE.DB];

// Kociemba piece ids → the cubie's position (sum of its faces' normals).
const EDGE_NAMES = ["UR", "UF", "UL", "UB", "DR", "DF", "DL", "DB", "FR", "FL", "BL", "BR"];
const CORNER_NAMES = ["URF", "UFL", "ULB", "UBR", "DFR", "DLF", "DBL", "DRB"];
const NORMAL: Record<string, Vec3> = Object.fromEntries(FACELETS.filter((f) => f.index % 9 === 4).map((f) => [f.face, f.normal]));
const posOf = (p: Piece): string =>
  [...(p.kind === "edge" ? EDGE_NAMES : CORNER_NAMES)[p.id]].reduce<number[]>((v, c) => v.map((x, k) => x + NORMAL[c][k]), [0, 0, 0]).join(",");

/** A mask for the stage (canonical frame): its pieces and the centres in colour, the rest grey. */
export function stageMaskRule(def: AnyStageDef): MaskRule {
  const pieces = new Set((isLseStage(def) ? LL_EDGES : def.pieces).map(posOf));
  return (_f, cubie) => (cubie.kind === "center" || pieces.has(cubie.pos.join(",")) ? "regular" : "ignored");
}

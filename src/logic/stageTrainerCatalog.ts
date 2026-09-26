/**
 * The trainers, as cubecore stages: what to practise (a StageDef the solver
 * runs), its levels (optimal move counts) and variants (slot, side…).
 * Canonical frame: cross / first layer on D, Roux blocks on L / R — the
 * player picks the colour (a frame) on top of it.
 */

import { type AnyStageDef, FACELETS, type Face, type MaskRule, PIECE, type Piece, type Vec3, isLseStage } from "@cubecore/core";
import { CFOP_TRAINERS } from "@cubecore/cfop";
import { ROUX_TRAINERS } from "@cubecore/roux";
import { ZZ_TRAINERS } from "@cubecore/zz";

export type MethodId = "cfop" | "roux" | "zz";

export interface StageTrainer {
  id: string;
  method: MethodId;
  label: string;
  hint: string;
  levels: { min: number; max: number; start: number };
  /** Variant choice (slot / side), if any: [value, label]. */
  variants?: readonly (readonly [string, string])[];
  stage: (variant: string) => AnyStageDef;
}

const SLOTS = [["FR", "FR"], ["FL", "FL"], ["BR", "BR"], ["BL", "BL"]] as const;
const SIDES = [["front", "front"], ["back", "back"]] as const;

export const STAGE_TRAINERS: readonly StageTrainer[] = [
  { id: "cross", method: "cfop", label: "Cross", hint: "Solve the cross in the optimal number of moves.", levels: { min: 1, max: 8, start: 4 }, stage: () => CFOP_TRAINERS.cross() },
  { id: "xcross", method: "cfop", label: "XCross", hint: "Cross and one F2L pair together.", levels: { min: 2, max: 10, start: 7 }, variants: SLOTS, stage: (v) => CFOP_TRAINERS.xcross(v as "FR") },
  {
    id: "xxcross",
    method: "cfop",
    label: "XXCross",
    hint: "Cross and two F2L pairs.",
    levels: { min: 3, max: 10, start: 8 },
    variants: [["adj", "adjacent (FR + FL)"], ["opp", "opposite (FR + BL)"]],
    stage: (v) => (v === "opp" ? CFOP_TRAINERS.xxcross("FR", "BL") : CFOP_TRAINERS.xxcross("FR", "FL")),
  },
  { id: "pair", method: "cfop", label: "Pair", hint: "Cross solved: form the pair, one insert away.", levels: { min: 1, max: 9, start: 5 }, variants: SLOTS, stage: (v) => CFOP_TRAINERS.pair(v as "FR") },
  { id: "fb", method: "roux", label: "First block", hint: "Roux first block (any bottom colour on the left).", levels: { min: 3, max: 8, start: 6 }, stage: () => ROUX_TRAINERS.fb() },
  { id: "fs", method: "roux", label: "First square", hint: "The first 2×2×1 square of the first block.", levels: { min: 2, max: 6, start: 4 }, variants: SIDES, stage: (v) => ROUX_TRAINERS.fs(v as "front") },
  { id: "fbdr", method: "roux", label: "FB + DR", hint: "From a first square: finish the block and place DR.", levels: { min: 2, max: 7, start: 5 }, variants: SIDES, stage: (v) => ROUX_TRAINERS.fbdr(v as "front") },
  { id: "ss", method: "roux", label: "Second square", hint: "First block solved: the second block's first square.", levels: { min: 3, max: 10, start: 6 }, variants: SIDES, stage: (v) => ROUX_TRAINERS.ss(v as "front") },
  { id: "eolr", method: "roux", label: "EOLR", hint: "Last six edges: orient them and set up UL / UR (M / U only).", levels: { min: 3, max: 10, start: 6 }, stage: () => ROUX_TRAINERS.eolr() },
  { id: "lse", method: "roux", label: "LSE", hint: "The whole last six edges (M / U only).", levels: { min: 3, max: 12, start: 8 }, stage: () => ROUX_TRAINERS.lse() },
  { id: "eocross", method: "zz", label: "EOCross", hint: "Cross on D with every edge oriented.", levels: { min: 3, max: 10, start: 7 }, stage: () => ZZ_TRAINERS.eocross() },
  { id: "eoline", method: "zz", label: "EOLine", hint: "Every edge oriented and DF + DB in place.", levels: { min: 2, max: 9, start: 6 }, stage: () => ZZ_TRAINERS.eoline() },
];

export const METHOD_LABELS: Record<MethodId, string> = { cfop: "CFOP", roux: "Roux", zz: "ZZ" };

/** Colours to build on (bottom face in the home colour scheme): white = U's colour down, etc. */
export const BOTTOM_COLOURS: readonly (readonly [Face, string])[] = [
  ["U", "White"],
  ["D", "Yellow"],
  ["F", "Green"],
  ["B", "Blue"],
  ["R", "Red"],
  ["L", "Orange"],
];

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

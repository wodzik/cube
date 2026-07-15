/**
 * Roux case-trainer targets: stop predicates + masks for FB (first block)
 * and SS (second square).
 *
 * FRAME/NEUTRALITY: the vendored solver's FB optimum is the minimum over
 * x/x'/x2 premoves (orientation-neutral about the L-R axis). Detection gets
 * the SAME freedom for free from rouxStages' offsetStates machinery:
 * "some x^k of the state has the canonical block home" ⇔ "one of the four
 * x-variant physical blocks is solved" — which is also exactly the
 * tolerance needed for smart-cube M-move reporting (a physical M arrives
 * as an opposite face-turn pair, rotating blocks vs centers in the fixed
 * frame; see rouxStages.ts). One mechanism, both jobs.
 *
 * SS (second square) = the DR edge + one right-block square:
 *   front: DFR corner + FR edge   |   back: DRB corner + BR edge
 * The trainer's SS scrambles keep FB solved, so the predicate requires
 * FB ∧ square under a SHARED offset k (both sit rigid in the same grip).
 *
 * The trainer deliberately requires the block on the LEFT (matching the
 * solver's metric); a mirrored right-side FB is a different case with a
 * different optimum, so detecting it would make verdicts wrong.
 */

import { LEFT_BLOCK, RIGHT_BLOCK, isBlockSolved, offsetStates } from "../stageDetection/rouxStages";
import type { LiveCubeState } from "../stageDetection/liveCubeState";
import { isSlotSolved } from "../stageDetection/liveCubeState";
import type { KPuzzle } from "cubing/kpuzzle";
import type { FaceletMask, StickeringMaskOrbits } from "../../types/cube";

export type RouxSsSide = "front" | "back";
export const ROUX_SS_SIDES: readonly RouxSsSide[] = ["front", "back"];

// Slot indices per liveCubeState.ts: corners 4=DFR 7=DRB; edges 5=DR 8=FR 10=BR.
const SS_SQUARE: Record<RouxSsSide, { corners: number[]; edges: number[] }> = {
  front: { corners: [4], edges: [5, 8] },
  back: { corners: [7], edges: [5, 10] },
};

/**
 * First squares (1×2×2 halves of the first block).
 * Corners 5=DLF 6=DBL; edges 7=DL 9=FL 11=BL.
 */
const FS_SQUARE: Record<RouxSsSide, { corners: number[]; edges: number[] }> = {
  front: { corners: [5], edges: [7, 9] },
  back: { corners: [6], edges: [7, 11] },
};

const DR_EDGE = 5;

function piecesSolved(s: LiveCubeState, set: { corners: number[]; edges: number[] }): boolean {
  return (
    set.corners.every((slot) => isSlotSolved(s.patternData.CORNERS, slot)) &&
    set.edges.every((slot) => isSlotSolved(s.patternData.EDGES, slot))
  );
}

export function isFbSolved(state: LiveCubeState): boolean {
  return offsetStates(state).some((s) => isBlockSolved(s, LEFT_BLOCK));
}

export function isFbSsSolved(state: LiveCubeState, side: RouxSsSide): boolean {
  return offsetStates(state).some((s) => isBlockSolved(s, LEFT_BLOCK) && piecesSolved(s, SS_SQUARE[side]));
}

export function isFsSolved(state: LiveCubeState, side: RouxSsSide): boolean {
  return offsetStates(state).some((s) => piecesSolved(s, FS_SQUARE[side]));
}

/** FBDR target: the whole first block + the DR edge (shared offset). */
export function isFbdrSolved(state: LiveCubeState): boolean {
  return offsetStates(state).some(
    (s) => isBlockSolved(s, LEFT_BLOCK) && isSlotSolved(s.patternData.EDGES, DR_EDGE)
  );
}

const ALL_CORNERS = [0, 1, 2, 3, 4, 5, 6, 7];

/** CMLL target: both blocks intact + all 8 corners placed and oriented (shared offset) — LSE stays scrambled. */
export function isCmllSolved(state: LiveCubeState): boolean {
  return offsetStates(state).some(
    (s) =>
      isBlockSolved(s, LEFT_BLOCK) &&
      isBlockSolved(s, RIGHT_BLOCK) &&
      ALL_CORNERS.every((slot) => isSlotSolved(s.patternData.CORNERS, slot))
  );
}

// ─── EOLR ───

/**
 * The EOLR "done" states, exactly as the vendored solver defines them: NOT
 * fully solved LSE, but the pre-insertion states one `[U/U'] M2 [AUF]`
 * (aligned-center) or `M' [U/U'] M2 [AUF]` (misaligned-center) away from
 * solved — 16 goal generators total, applied FROM solved. Detection and
 * solver share this goal set, so the movecount verdict is metric-exact.
 */
const EOLR_GOAL_GENERATORS: readonly string[] = (() => {
  const out: string[] = [];
  for (const head of ["U' M2", "U M2", "M' U M2", "M' U' M2"]) {
    for (const auf of ["", "U", "U'", "U2"]) {
      out.push(`${head} ${auf}`.trim());
    }
  }
  return out;
})();

/** Edge slots the EOLR encoding leaves FREE (the 4c remainder is untouched by EOLR): UF, UB, DF, DB. */
const EOLR_LSE_SLOTS = [0, 1, 2, 3, 4, 6];
const EOLR_BLOCK_EDGE_SLOTS = [5, 7, 8, 9, 10, 11];
const UL_PIECE = 3;
const UR_PIECE = 1;

/**
 * Mirror of the vendored solver's EOLR encoding: corners fully placed,
 * block edges fully placed, EO of the six LSE edges per slot, positions of
 * ONLY the UL/UR pieces (the other four LSE pieces' permutation is the 4c
 * step, deliberately free), and center POSITIONS (orientation is invisible
 * on a real cube). Full-pattern equality would never fire — the state after
 * EOLR still has a scrambled 4c.
 */
function eolrEncodingMatch(a: LiveCubeState, b: LiveCubeState): boolean {
  const ca = a.patternData.CORNERS;
  const cb = b.patternData.CORNERS;
  if (ca.pieces.join() !== cb.pieces.join() || ca.orientation.join() !== cb.orientation.join()) return false;
  const ea = a.patternData.EDGES;
  const eb = b.patternData.EDGES;
  for (const slot of EOLR_BLOCK_EDGE_SLOTS) {
    if (ea.pieces[slot] !== eb.pieces[slot] || ea.orientation[slot] !== eb.orientation[slot]) return false;
  }
  for (const slot of EOLR_LSE_SLOTS) {
    if (ea.orientation[slot] !== eb.orientation[slot]) return false;
  }
  if (ea.pieces.indexOf(UL_PIECE) !== eb.pieces.indexOf(UL_PIECE)) return false;
  if (ea.pieces.indexOf(UR_PIECE) !== eb.pieces.indexOf(UR_PIECE)) return false;
  return a.patternData.CENTERS.pieces.join() === b.patternData.CENTERS.pieces.join();
}

let eolrGoalsCache: LiveCubeState[] | null = null;

export function eolrGoalPatterns(kpuzzle: KPuzzle): LiveCubeState[] {
  if (!eolrGoalsCache) {
    eolrGoalsCache = EOLR_GOAL_GENERATORS.map((g) => kpuzzle.defaultPattern().applyAlg(g));
  }
  return eolrGoalsCache;
}

/**
 * EOLR reached: the live state matches one of the goal states, on the
 * solver's own encoded features, up to the shared x^k offset (M-move
 * reporting drift). Including center POSITIONS keeps the aligned/
 * misaligned-center distinction honest: both sides' centers only ever
 * cycle along the L-R axis here (M in the goals, x^k in the offsets).
 */
export function isEolrSolved(state: LiveCubeState, goals: LiveCubeState[]): boolean {
  return offsetStates(state).some((s) => goals.some((g) => eolrEncodingMatch(s, g)));
}

// ─── Masks ───

function rouxMask(regularEdges: number[], regularCorners: number[], dimEdges: number[] = [], dimCorners: number[] = []): StickeringMaskOrbits {
  const edge = (p: number): FaceletMask => (regularEdges.includes(p) ? "regular" : dimEdges.includes(p) ? "dim" : "ignored");
  const corner = (p: number): FaceletMask =>
    regularCorners.includes(p) ? "regular" : dimCorners.includes(p) ? "dim" : "ignored";
  return {
    orbits: {
      EDGES: { pieces: Array.from({ length: 12 }, (_, p) => ({ facelets: [edge(p), edge(p)] })) },
      CORNERS: { pieces: Array.from({ length: 8 }, (_, p) => ({ facelets: [corner(p), corner(p), corner(p)] })) },
      CENTERS: { pieces: Array.from({ length: 6 }, () => ({ facelets: ["dim", "dim", "dim", "dim"] })) },
    },
  };
}

export function fbStickeringMask(): StickeringMaskOrbits {
  return rouxMask(LEFT_BLOCK.edges, LEFT_BLOCK.corners);
}

/** SS pieces in full color, the (already solved) FB dimmed for context. */
export function ssStickeringMask(side: RouxSsSide): StickeringMaskOrbits {
  const square = SS_SQUARE[side];
  return rouxMask(square.edges, square.corners, LEFT_BLOCK.edges, LEFT_BLOCK.corners);
}

export function fsStickeringMask(side: RouxSsSide): StickeringMaskOrbits {
  const square = FS_SQUARE[side];
  return rouxMask(square.edges, square.corners);
}

/** The trained remainder (other FS square + DR) in full color, the pre-solved FS dimmed. `solvedSide` = which FS the scramble keeps solved. */
export function fbdrStickeringMask(solvedSide: RouxSsSide): StickeringMaskOrbits {
  const solved = FS_SQUARE[solvedSide];
  const remaining = FS_SQUARE[solvedSide === "front" ? "back" : "front"];
  return rouxMask(
    [...remaining.edges.filter((e) => !solved.edges.includes(e)), DR_EDGE],
    remaining.corners,
    solved.edges,
    solved.corners
  );
}

const U_CORNERS = [0, 1, 2, 3];
const BLOCK_EDGES = [...LEFT_BLOCK.edges, ...RIGHT_BLOCK.edges];
const BLOCK_CORNERS = [...LEFT_BLOCK.corners, ...RIGHT_BLOCK.corners];
/** LSE edge slots: UF, UR, UB, UL, DF, DB. */
const LSE_EDGES = [0, 1, 2, 3, 4, 6];
const UL_UR_EDGES = [3, 1];

/** The 4 last-layer corners in full color; both (solved) blocks dimmed for context. */
export function cmllStickeringMask(): StickeringMaskOrbits {
  return rouxMask([], U_CORNERS, BLOCK_EDGES, BLOCK_CORNERS);
}

/** UL/UR in full color, the other LSE edges orientation-only; blocks + corners dimmed. */
export function eolrStickeringMask(): StickeringMaskOrbits {
  const mask = rouxMask(UL_UR_EDGES, [], BLOCK_EDGES, [...BLOCK_CORNERS, ...U_CORNERS]);
  for (const piece of LSE_EDGES) {
    if (!UL_UR_EDGES.includes(piece)) {
      mask.orbits.EDGES.pieces[piece] = { facelets: ["oriented", "oriented"] };
    }
  }
  return mask;
}

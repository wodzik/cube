/**
 * CFOP stage detector: cross -> F2L (4 pairs) -> OLL -> PLL -> AUF.
 *
 * Cross (and therefore everything downstream) is FACE-AGNOSTIC — solvers
 * build their cross on whichever face they find easiest for a given
 * scramble, not always the same physical face. v1 of this detector hardcoded
 * the D face, which silently failed to detect any progress at all for a
 * solver whose cross ended up elsewhere. Fixed by checking all 6 faces and
 * using whichever one currently has a solved cross — matching the old
 * cube_trainer app's CFOPAnalyzer (`crossFace` auto-detected from the
 * pattern, not assumed).
 *
 * That face is auto-detected ONCE, the moment cross first solves, then
 * LOCKED for the rest of the solve (see lastLayerShared.ts's
 * LockedFaceContext/resolveFace) — f2l/oll/pll/auf all check against that
 * same locked face, never re-run the search. v2 re-detected fresh on every
 * single stage check instead, which is unsafe: a short move sequence can
 * coincidentally line up a completely different face's 4 cross edges too,
 * silently flipping which axis everything downstream (OLL/PLL/AUF) gets
 * attributed to mid-solve.
 *
 * Cross/OLL/PLL/AUF detection itself lives in lastLayerShared.ts, not here —
 * it's identical for any face-agnostic-cross method (a future beginner
 * Layer-By-Layer detector would reuse it verbatim). This file only adds
 * what's actually CFOP-specific: pairing each first-layer corner with its
 * middle-layer edge into F2L slots, tracked by count.
 *
 * F2L pairs are tracked by COUNT, not by which specific pair — they can be
 * solved in any order, so "f2l-2" means "any 2 of the 4 pairs are solved",
 * not "the 2nd pair specifically". Since the count only increases as the
 * solve progresses, this is a safe monotonic stage sequence for the live
 * tracker (see methodTracker.ts).
 *
 * PLL and AUF are split, matching the old app's CFOP_STAGE_ORDER: "pll" is
 * satisfied as soon as the permutation is correct UP TO whole-layer rotation
 * (isPllSolvedOnFace — "does some 0-3 quarter turn of the last layer fully
 * solve the cube"), "auf" only once the cube is ACTUALLY fully solved (the
 * literal final adjustment turn, if any, has been performed). Folding both
 * into one "pll" stage (the v1 approach) attributed the trailing AUF turn's
 * time to PLL, which is fine for total time but wrong for a move-by-move
 * breakdown / player scrubbing, since PLL's own execution genuinely ends
 * before that turn.
 */

import { isFullySolved, isSlotSolved, type LiveCubeState } from "./liveCubeState";
import {
  detectCrossFace,
  isOllSolvedOnFace,
  isPllSolvedOnFace,
  lockFaceIfUnset,
  resolveFace,
  FACES,
  FACE_SLOTS,
  MIDDLE_LAYER_EDGE_SLOTS,
  type Face,
  type LockedFaceContext,
} from "./lastLayerShared";
import type { StageDetector } from "./types";

/**
 * Each face's 4 first-layer corners paired with the middle-layer edge that
 * completes its F2L slot — built from the shared, positionally-matched
 * FACE_SLOTS.cornerSlots / MIDDLE_LAYER_EDGE_SLOTS tables (see
 * lastLayerShared.ts) rather than a second hand-written table, so the two
 * can't drift out of sync.
 */
const F2L_PAIRS: Record<Face, { corner: number; edge: number }[]> = Object.fromEntries(
  FACES.map((face) => [
    face,
    FACE_SLOTS[face].cornerSlots.map((corner, i) => ({ corner, edge: MIDDLE_LAYER_EDGE_SLOTS[face][i] })),
  ])
) as Record<Face, { corner: number; edge: number }[]>;

function solvedF2LPairCount(state: LiveCubeState, face: Face): number {
  const corners = state.patternData.CORNERS;
  const edges = state.patternData.EDGES;
  return F2L_PAIRS[face].filter(({ corner, edge }) => isSlotSolved(corners, corner) && isSlotSolved(edges, edge)).length;
}

/** The cross face for which F2L is fully complete (all 4 pairs), or null. */
function detectF2LCompleteFace(state: LiveCubeState): Face | null {
  return FACES.find((face) => solvedF2LPairCount(state, face) === 4) ?? null;
}

/** Best-effort "which face is the solver's cross/F2L layer" — prefers a fully F2L-complete face, falls back to any cross-intact face. Only used as a fallback when no locked-face context is available (see resolveFace). */
function detectActiveFace(state: LiveCubeState): Face | null {
  return detectF2LCompleteFace(state) ?? detectCrossFace(state);
}

export const cfopStageDetector: StageDetector = {
  method: "CFOP",
  stages: ["cross", "f2l-1", "f2l-2", "f2l-3", "f2l-4", "oll", "pll", "auf"],
  createContext: (): LockedFaceContext => ({ lockedFace: null }),
  isStageSolved(stage, state, context) {
    switch (stage) {
      case "cross": {
        const face = detectCrossFace(state);
        // Lock in the moment cross first solves — every later stage in this
        // same walk checks THIS face, never re-detects.
        lockFaceIfUnset(context, face);
        return face !== null;
      }
      case "f2l-1":
      case "f2l-2":
      case "f2l-3":
      case "f2l-4": {
        const face = resolveFace(context, state, detectActiveFace);
        if (!face) return false;
        const target = Number(stage.split("-")[1]);
        return solvedF2LPairCount(state, face) >= target;
      }
      case "oll": {
        const face = resolveFace(context, state, detectActiveFace);
        return face !== null && isOllSolvedOnFace(state, face);
      }
      case "pll": {
        const face = resolveFace(context, state, detectActiveFace);
        return face !== null && isPllSolvedOnFace(state, face);
      }
      case "auf":
        return isFullySolved(state);
      default:
        return false;
    }
  },
};

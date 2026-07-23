/**
 * LBL (beginner Layer-By-Layer) stage detector: cross -> first layer (4
 * corners placed, no pairing) -> second layer (4 middle edges placed,
 * separately from corners) -> OLL -> PLL -> AUF.
 *
 * Face-agnostic cross/OLL/PLL/AUF detection is IDENTICAL to CFOP's — both
 * import it from lastLayerShared.ts rather than duplicating it (see that
 * file's doc comment). The only real difference from CFOP is the middle
 * section: CFOP pairs each first-layer corner with its adjoining edge and
 * solves both together (F2L); LBL solves all 4 first-layer corners first
 * (completing the whole first layer with no middle-layer edges placed
 * yet), then places the 4 middle-layer edges separately — geometrically
 * the exact same 16 pieces as CFOP's F2L-4 by the end of "second-layer-4",
 * just reached via a different path.
 *
 * Both the corner and edge halves are tracked by COUNT, not by which
 * specific piece — a beginner inserts them in whatever order is easiest
 * for a given scramble, exactly like CFOP's F2L pairs (see cfopStages.ts).
 * "first-layer-2" means "any 2 of the 4 first-layer corners are placed",
 * not "the 2nd corner specifically" — the count only increases as the
 * solve progresses, so this is a safe monotonic stage sequence for the
 * live tracker (see methodTracker.ts).
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

function solvedFirstLayerCornerCount(state: LiveCubeState, face: Face): number {
  const corners = state.patternData.CORNERS;
  return FACE_SLOTS[face].cornerSlots.filter((slot) => isSlotSolved(corners, slot)).length;
}

function solvedSecondLayerEdgeCount(state: LiveCubeState, face: Face): number {
  const edges = state.patternData.EDGES;
  return MIDDLE_LAYER_EDGE_SLOTS[face].filter((slot) => isSlotSolved(edges, slot)).length;
}

/** The cross face for which the first layer (all 4 corners) is complete, or null. */
function detectFirstLayerCompleteFace(state: LiveCubeState): Face | null {
  return FACES.find((face) => solvedFirstLayerCornerCount(state, face) === 4) ?? null;
}

/** Best-effort "which face is the solver's layer" — prefers a first-layer-complete face, falls back to any cross-intact face. Only used as a fallback when no locked-face context is available (see resolveFace). */
function detectActiveFace(state: LiveCubeState): Face | null {
  return detectFirstLayerCompleteFace(state) ?? detectCrossFace(state);
}

export const lblStageDetector: StageDetector = {
  method: "LBL",
  stages: [
    "cross",
    "first-layer-1",
    "first-layer-2",
    "first-layer-3",
    "first-layer-4",
    "second-layer-1",
    "second-layer-2",
    "second-layer-3",
    "second-layer-4",
    "oll",
    "pll",
    "auf",
  ],
  createContext: (): LockedFaceContext => ({ lockedFace: null }),
  isStageSolved(stage, state, context) {
    switch (stage) {
      case "cross": {
        const face = detectCrossFace(state);
        lockFaceIfUnset(context, face);
        return face !== null;
      }
      case "first-layer-1":
      case "first-layer-2":
      case "first-layer-3":
      case "first-layer-4": {
        const face = resolveFace(context, state, detectActiveFace);
        if (!face) return false;
        const target = Number(stage.split("-")[2]);
        return solvedFirstLayerCornerCount(state, face) >= target;
      }
      case "second-layer-1":
      case "second-layer-2":
      case "second-layer-3":
      case "second-layer-4": {
        const face = resolveFace(context, state, detectActiveFace);
        if (!face) return false;
        const target = Number(stage.split("-")[2]);
        return solvedSecondLayerEdgeCount(state, face) >= target;
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

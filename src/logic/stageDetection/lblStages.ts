/**
 * LBL (beginner Layer-By-Layer) stage detector: cross -> first layer (4
 * corners placed, no pairing) -> second layer (4 middle edges placed,
 * separately from corners) -> OLL -> PLL -> AUF.
 *
 * Face-agnostic cross/OLL/PLL/AUF detection is IDENTICAL to CFOP's — both
 * import it from lastLayerShared.ts rather than duplicating it (see that
 * file's doc comment). The only real difference from CFOP is the middle
 * section: CFOP pairs each first-layer corner with its adjoining edge and
 * solves both together (F2L), tracked by pair COUNT; LBL solves all 4
 * first-layer corners first (completing the whole first layer with no
 * middle-layer edges placed yet), then places the 4 middle-layer edges
 * separately — geometrically the exact same 16 pieces as CFOP's F2L-4 by
 * the end of "second-layer", just reached via a different path, which is
 * why both stages check MIDDLE_LAYER_EDGE_SLOTS "all 4 done" as a set
 * rather than a partial count (LBL doesn't have a meaningful "N of 4 edges"
 * milestone the way CFOP has "N of 4 pairs" — a beginner typically inserts
 * edges in a fixed order until all 4 are placed).
 */

import { isFullySolved, isSlotSolved, type LiveCubeState } from "./liveCubeState";
import {
  detectCrossFace,
  isOllSolvedOnFace,
  isPllSolvedOnFace,
  lockFaceIfUnset,
  resolveFace,
  FACE_SLOTS,
  MIDDLE_LAYER_EDGE_SLOTS,
  type Face,
  type LockedFaceContext,
} from "./lastLayerShared";
import type { StageDetector } from "./types";

function isFirstLayerSolvedOnFace(state: LiveCubeState, face: Face): boolean {
  const corners = state.patternData.CORNERS;
  return FACE_SLOTS[face].cornerSlots.every((slot) => isSlotSolved(corners, slot));
}

function isSecondLayerSolvedOnFace(state: LiveCubeState, face: Face): boolean {
  const edges = state.patternData.EDGES;
  return MIDDLE_LAYER_EDGE_SLOTS[face].every((slot) => isSlotSolved(edges, slot));
}

export const lblStageDetector: StageDetector = {
  method: "LBL",
  stages: ["cross", "first-layer", "second-layer", "oll", "pll", "auf"],
  createContext: (): LockedFaceContext => ({ lockedFace: null }),
  isStageSolved(stage, state, context) {
    switch (stage) {
      case "cross": {
        const face = detectCrossFace(state);
        lockFaceIfUnset(context, face);
        return face !== null;
      }
      case "first-layer": {
        const face = resolveFace(context, state, detectCrossFace);
        return face !== null && isFirstLayerSolvedOnFace(state, face);
      }
      case "second-layer": {
        const face = resolveFace(context, state, detectCrossFace);
        return face !== null && isSecondLayerSolvedOnFace(state, face);
      }
      case "oll": {
        const face = resolveFace(context, state, detectCrossFace);
        return face !== null && isOllSolvedOnFace(state, face);
      }
      case "pll": {
        const face = resolveFace(context, state, detectCrossFace);
        return face !== null && isPllSolvedOnFace(state, face);
      }
      case "auf":
        return isFullySolved(state);
      default:
        return false;
    }
  },
};

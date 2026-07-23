/**
 * LBL (beginner Layer-By-Layer) stage detector: cross -> first layer (4
 * corners placed, no pairing) -> second layer (4 middle edges placed,
 * separately from corners) -> OLL (2-look: orient corners/edges, either
 * order) -> PLL (2-look: permute corners, then edges) -> AUF.
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
 * The corner/edge halves of first-layer and second-layer are tracked by
 * COUNT, not by which specific piece — a beginner inserts them in whatever
 * order is easiest, exactly like CFOP's F2L pairs (see cfopStages.ts).
 * "first-layer-2" means "any 2 of the 4 first-layer corners are placed",
 * not "the 2nd corner specifically" — the count only increases as the
 * solve progresses, so this is a safe monotonic stage sequence for the
 * live tracker (see methodTracker.ts).
 *
 * OLL's two halves ("oll-first"/"oll-second") are DIFFERENT: 2-look OLL is
 * commonly taught either order (orient corners first, or edges first), so
 * unlike first-layer/second-layer there's no single fixed identity for
 * "the first OLL milestone" — it's corners for some solvers, edges for
 * others, potentially even varying solve to solve for the same solver.
 * "oll-first"/"oll-second" are still a FIXED, STABLE PAIR OF IDS in the
 * stages array (StageWalker only ever advances to the next id in order,
 * see methodTracker.ts — a genuinely varying id would break that), but
 * each carries a `stageDetail` ("corners" or "edges") recorded at the
 * moment it actually completes, so the DISPLAY can show what specifically
 * happened even though the ID can't. oll-second's detail is always the
 * complement of oll-first's (remembered via context — see LblContext).
 *
 * PLL's two halves are NOT order-flexible — corners are permuted first,
 * then edges (2-look PLL is always taught this way) — so "pll-corners"
 * and "pll-edges" have fixed, unambiguous identities and need no detail
 * tracking; "pll-edges" (not just "pll") also avoids colliding with
 * CFOP's own "pll" stage id in the shared stageDescriptions.ts display
 * mapping, which otherwise couldn't tell "LBL's edges-only completion"
 * from "CFOP's full PLL" apart.
 */

import { isFullySolved, isSlotSolved, type LiveCubeState } from "./liveCubeState";
import {
  detectCrossFace,
  isOllCornersOrientedOnFace,
  isOllEdgesOrientedOnFace,
  isOllSolvedOnFace,
  isPllCornersSolvedOnFace,
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

interface LblContext extends LockedFaceContext {
  /** Which half oll-first turned out to be, once recorded — so oll-second's stageDetail can report the complement. */
  ollFirstDetail: "corners" | "edges" | null;
}

function isLblContext(context: unknown): context is LblContext {
  return typeof context === "object" && context !== null && "ollFirstDetail" in context;
}

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
    "oll-first",
    "oll-second",
    "pll-corners",
    "pll-edges",
    "auf",
  ],
  createContext: (): LblContext => ({ lockedFace: null, ollFirstDetail: null }),
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
      case "oll-first": {
        const face = resolveFace(context, state, detectActiveFace);
        return face !== null && (isOllCornersOrientedOnFace(state, face) || isOllEdgesOrientedOnFace(state, face));
      }
      case "oll-second": {
        const face = resolveFace(context, state, detectActiveFace);
        return face !== null && isOllSolvedOnFace(state, face);
      }
      case "pll-corners": {
        const face = resolveFace(context, state, detectActiveFace);
        return face !== null && isPllCornersSolvedOnFace(state, face);
      }
      case "pll-edges": {
        const face = resolveFace(context, state, detectActiveFace);
        return face !== null && isPllSolvedOnFace(state, face);
      }
      case "auf":
        return isFullySolved(state);
      default:
        return false;
    }
  },
  stageDetail(stage, state, context) {
    if (stage === "oll-first") {
      const face = resolveFace(context, state, detectActiveFace);
      if (!face) return undefined;
      // Priority is an arbitrary but harmless tiebreak for the rare case
      // where a single move completes BOTH halves at once (isStageSolved
      // for oll-first and oll-second would both fire in the same
      // checkStages pass) — corners wins the label, edges (via
      // ollFirstDetail's complement below) is still reported for oll-second.
      const detail = isOllCornersOrientedOnFace(state, face) ? "corners" : "edges";
      if (isLblContext(context)) context.ollFirstDetail = detail;
      return detail;
    }
    if (stage === "oll-second") {
      if (isLblContext(context) && context.ollFirstDetail) {
        return context.ollFirstDetail === "corners" ? "edges" : "corners";
      }
      return undefined;
    }
    return undefined;
  },
};

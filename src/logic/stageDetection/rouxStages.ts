/**
 * Roux stage detector: FB (first block) -> SB (second block) -> CMLL
 * (orient + permute last-layer corners) -> LSE (last six edges).
 *
 * Blocks are checked on the L/R faces (the standard Roux grip, matching how
 * the app's 3D view displays the cube), but with ROTATION-OFFSET TOLERANCE
 * about the L-R axis — the M-move problem: a physical M/M' slice turn
 * reaches the move log as an L + opposite-direction R pair, because smart
 * cubes report outer-layer rotations relative to the core and the core
 * turns WITH the slice. In the simulated fixed frame that pair spins BOTH
 * outer layers while the centers stay put, so from mid-solve through all of
 * LSE the (physically untouched, rigid-in-hand) blocks sit rotated about
 * the L-R axis relative to their "home" slots, by an offset that changes
 * with every M. A block therefore counts as solved if SOME whole-cube
 * rotation x^k (k = 0-3) brings its pieces home — and the k is SHARED
 * between both blocks and CMLL's corners, because physically both blocks
 * sit rigid in the same grip while only the centers spin: independent
 * per-block offsets would wrongly accept two blocks twisted relative to
 * each other (e.g. a lone R away from being mutually aligned).
 *
 * DELIBERATE SCOPE: a solver gripping the cube so their blocks land on a
 * DIFFERENT sim-frame axis (U/D or F/B), or with a flipped "floor" color,
 * builds their blocks out of different physical pieces — detecting that
 * would need per-axis/per-floor piece-set tables (24 block positions), not
 * just rotated checks (a whole-cube rotation can't turn the UL piece into
 * the DL piece). Not implemented: with the live 3D mirror on screen,
 * solvers hold the cube matching the display, which puts Roux blocks on
 * L/R with a D floor — the canonical tables below.
 *
 * LSE completion needs no tolerance: it's literal isFullySolved, and
 * realigning the slice/centers to neutral IS part of finishing LSE.
 */

import { applyMoveToState, isFullySolved, isSlotSolved, type LiveCubeState } from "./liveCubeState";
import type { StageDetector } from "./types";

// Slot indices — see liveCubeState.ts doc comment for the verified mapping.
// Exported for the Roux case trainer (logic/trainer/rouxTargets.ts), which
// reuses these piece sets and the offset machinery for its stop predicates.
export const LEFT_BLOCK = { corners: [5, 6], edges: [7, 9, 11] }; // DLF, DBL / DL, FL, BL
export const RIGHT_BLOCK = { corners: [4, 7], edges: [5, 8, 10] }; // DFR, DRB / DR, FR, BR
const ALL_CORNER_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7];

export function isBlockSolved(state: LiveCubeState, block: { corners: number[]; edges: number[] }): boolean {
  const corners = state.patternData.CORNERS;
  const edges = state.patternData.EDGES;
  return (
    block.corners.every((slot) => isSlotSolved(corners, slot)) &&
    block.edges.every((slot) => isSlotSolved(edges, slot))
  );
}

function allCornersSolved(state: LiveCubeState): boolean {
  const corners = state.patternData.CORNERS;
  return ALL_CORNER_SLOTS.every((slot) => isSlotSolved(corners, slot));
}

/**
 * The 4 rotational offsets of `state` about the L-R axis — index k = state
 * rotated by x^k. A predicate holding for ANY of these = "true up to the
 * centers-vs-grip offset that M-move reporting introduces" (see file doc
 * comment). Checking a piece SUBSET (a block, the corners) against absolute
 * slots on a whole-cube-rotated state asks exactly "does x^k bring these
 * pieces home" — i.e. the subset is intact, just rotated about the axis.
 */
export function offsetStates(state: LiveCubeState): LiveCubeState[] {
  let s = state;
  const out = [s];
  for (let k = 1; k < 4; k++) {
    s = applyMoveToState(s, "x");
    out.push(s);
  }
  return out;
}

export const rouxStageDetector: StageDetector = {
  method: "Roux",
  stages: ["fb", "sb", "cmll", "lse"],
  isStageSolved(stage, state) {
    switch (stage) {
      case "fb":
        // Either side counts as "first" — left vs right is the solver's
        // choice (mirror-grip Roux), invisible in the fixed frame.
        return offsetStates(state).some((s) => isBlockSolved(s, LEFT_BLOCK) || isBlockSolved(s, RIGHT_BLOCK));
      case "sb":
        // Both blocks under ONE shared offset k (see file doc comment).
        return offsetStates(state).some((s) => isBlockSolved(s, LEFT_BLOCK) && isBlockSolved(s, RIGHT_BLOCK));
      case "cmll":
        // Blocks intact + all 8 corners placed and oriented, same shared offset.
        return offsetStates(state).some(
          (s) => isBlockSolved(s, LEFT_BLOCK) && isBlockSolved(s, RIGHT_BLOCK) && allCornersSolved(s)
        );
      case "lse":
        return isFullySolved(state);
      default:
        return false;
    }
  },
};

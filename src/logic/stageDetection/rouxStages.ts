/**
 * Roux stage detector: FB (first block) -> SB (second block) -> CMLL
 * (orient + permute last-layer corners) -> LSE (last six edges).
 *
 * ORIENTATION-AGNOSTIC. Smart cubes report outer-layer turns relative to
 * the core and never report rotations, so two things put a solver's blocks
 * on arbitrary sim-frame faces:
 *
 *  1. Inspection/mid-solve rotations (`y x'`, `z x`, wide moves like `r`)
 *     are invisible to the log — the solver's "left block with a D floor"
 *     is then built out of a DIFFERENT physical piece set than the sim
 *     frame's L block (e.g. after `y x'` it's the F face's R-side column).
 *     Every reco.nz Roux solve does this; see rouxStages.reco.test.ts.
 *  2. The M-move problem: a physical M/M' reaches the log as an L + R'
 *     pair (core turns with the slice), so in the fixed sim frame the
 *     rigid-in-hand blocks sit rotated relative to their slots by an
 *     offset that changes with every M.
 *
 * So a block pair counts as solved when, for SOME block-pair position h
 * (the canonical L/R pair carried onto any of the 24 orientations — 24
 * distinct piece-sets, since a 1x2x3 block isn't symmetric in side/floor)
 * and SOME whole-cube offset g (24 rotations), both blocks of h sit at
 * their home slots in g(state). g is SHARED between both blocks and CMLL's
 * corners: physically everything sits rigid in the same grip while only the
 * centers spin, so independent per-block offsets would wrongly accept two
 * blocks twisted relative to each other (e.g. a lone R away from aligned).
 *
 * LSE completion needs no tolerance: it's literal isFullySolved (ignoring
 * whole-cube orientation), and realigning the slice/centers IS part of
 * finishing LSE.
 */

import { applyMoveToState, isFullySolved, isSlotSolved, type LiveCubeState } from "./liveCubeState";
import type { StageDetector } from "./types";

// Slot indices — see liveCubeState.ts doc comment for the verified mapping.
// Exported for the Roux case trainer (logic/trainer/rouxTargets.ts), which
// reuses these piece sets and the x-offset machinery for its stop predicates
// (its cases are set up in the canonical L/R grip, so the 4 x^k offsets are
// all it needs).
export const LEFT_BLOCK = { corners: [5, 6], edges: [7, 9, 11] }; // DLF, DBL / DL, FL, BL
export const RIGHT_BLOCK = { corners: [4, 7], edges: [5, 8, 10] }; // DFR, DRB / DR, FR, BR
const ALL_CORNER_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7];

type Block = { corners: number[]; edges: number[] };

export function isBlockSolved(state: LiveCubeState, block: Block): boolean {
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
 * rotated by x^k. Kept for the Roux case trainer; the detector itself uses
 * the full 24-rotation allOrientations below.
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

/** All 24 whole-cube rotations as move sequences: 6 choices of which face is up × 4 spins about it. */
const ROTATIONS: string[][] = (["", "x", "x2", "x'", "z", "z'"] as const).flatMap((tilt) =>
  (["", "y", "y2", "y'"] as const).map((spin) => [tilt, spin].filter(Boolean))
);

function rotate(state: LiveCubeState, rotation: string[]): LiveCubeState {
  return rotation.reduce((s, m) => applyMoveToState(s, m), state);
}

/** `state` under every one of the 24 whole-cube rotations (index 0 = identity). */
function allOrientations(state: LiveCubeState): LiveCubeState[] {
  return ROTATIONS.map((r) => rotate(state, r));
}

/**
 * The 24 positions a block pair can occupy: the canonical L/R pair carried
 * by each rotation. A block is defined by SLOTS (a solved block at that
 * position = those slots hold their own pieces), so position h's slots are
 * read off a solved cube rotated by h — the piece that lives at home slot
 * s now sits at slot h(s). Built lazily from the first state seen (its
 * kpuzzle gives a synchronous solved pattern); detection is a sync API.
 */
interface BlockPairPosition {
  left: Block;
  right: Block;
  /** The face turn of this pair's last layer (its "U") in the sim frame — the AUF axis for CMLL. */
  aufFace: string;
}

let blockPairPositions: BlockPairPosition[] | null = null;

function getBlockPairPositions(state: LiveCubeState): BlockPairPosition[] {
  if (blockPairPositions) return blockPairPositions;
  const solved = state.kpuzzle.defaultPattern();
  const slotsOf = (pieces: number[], targets: number[]) => targets.map((piece) => pieces.indexOf(piece));
  const carry = (rotated: LiveCubeState, block: Block): Block => ({
    corners: slotsOf(rotated.patternData.CORNERS.pieces, block.corners),
    edges: slotsOf(rotated.patternData.EDGES.pieces, block.edges),
  });
  // Which corner slots each face turn moves — to name a face by the corner
  // slots it owns without depending on the CENTERS orbit's slot order.
  const cornerSlotsOfFace = new Map<string, string>(
    ["U", "D", "L", "R", "F", "B"].map((face) => {
      const turned = applyMoveToState(solved, face).patternData.CORNERS.pieces;
      const moved = ALL_CORNER_SLOTS.filter((slot) => turned[slot] !== slot);
      return [moved.sort((a, b) => a - b).join(","), face];
    })
  );
  const U_CORNERS = [0, 1, 2, 3];
  blockPairPositions = ROTATIONS.map((r) => {
    const rotated = rotate(solved, r);
    const uCornerSlots = slotsOf(rotated.patternData.CORNERS.pieces, U_CORNERS).sort((a, b) => a - b).join(",");
    const aufFace = cornerSlotsOfFace.get(uCornerSlots);
    if (!aufFace) throw new Error(`rouxStages: no face owns corner slots ${uCornerSlots}`);
    return { left: carry(rotated, LEFT_BLOCK), right: carry(rotated, RIGHT_BLOCK), aufFace };
  });
  return blockPairPositions;
}

function bothBlocksSolved(state: LiveCubeState, p: BlockPairPosition): boolean {
  return isBlockSolved(state, p.left) && isBlockSolved(state, p.right);
}

/**
 * CMLL is done once all 8 corners are placed and oriented relative to the
 * blocks UP TO an AUF: Roux convention (and every reco.nz reconstruction)
 * counts the trailing U-layer adjustment as the start of LSE, not the end
 * of CMLL. The AUF layer holds none of the pair's pieces, so turning it
 * can't disturb the block check.
 */
function cornersSolvedUpToAuf(state: LiveCubeState, p: BlockPairPosition): boolean {
  let s = state;
  for (let k = 0; k < 4; k++) {
    if (allCornersSolved(s)) return true;
    s = applyMoveToState(s, p.aufFace);
  }
  return false;
}

export const rouxStageDetector: StageDetector = {
  method: "Roux",
  stages: ["fb", "sb", "cmll", "lse"],
  isStageSolved(stage, state) {
    if (stage === "lse") return isFullySolved(state);
    const positions = getBlockPairPositions(state);
    const orientations = allOrientations(state);
    switch (stage) {
      case "fb":
        // Either side counts as "first" — left vs right is the solver's
        // choice (mirror-grip Roux). Positions already cover every face pair.
        return orientations.some((s) => positions.some((p) => isBlockSolved(s, p.left) || isBlockSolved(s, p.right)));
      case "sb":
        // Both blocks of ONE pair position under ONE shared offset.
        return orientations.some((s) => positions.some((p) => bothBlocksSolved(s, p)));
      case "cmll":
        return orientations.some((s) => positions.some((p) => bothBlocksSolved(s, p) && cornersSolvedUpToAuf(s, p)));
      default:
        return false;
    }
  },
};

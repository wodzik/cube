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
import { CORNER_SLOT_FACES, OPPOSITE_FACE, type Face } from "./lastLayerShared";
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
  /** The real face this position's blocks sit on ("D" in the canonical grip) — opposite aufFace. For cube-coloring the timing bar (components/cubeColors.ts). */
  floorFace: Face;
  /** The real side-wall face of the left/right block at this position ("L"/"R" in the canonical grip) — for cube-coloring. */
  leftFace: Face;
  rightFace: Face;
}

/** The 1-2 real faces two corner slots have in common — a block's two corners always share the floor face and, for one block, its own side-wall face. */
function sharedCornerFaces(slots: number[]): Set<Face> {
  const [a, b] = slots;
  return new Set(CORNER_SLOT_FACES[a].filter((f) => (CORNER_SLOT_FACES[b] as readonly Face[]).includes(f)));
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
    const left = carry(rotated, LEFT_BLOCK);
    const right = carry(rotated, RIGHT_BLOCK);
    const floorFace = OPPOSITE_FACE[aufFace as Face];
    const leftFace = [...sharedCornerFaces(left.corners)].find((f) => f !== floorFace);
    const rightFace = [...sharedCornerFaces(right.corners)].find((f) => f !== floorFace);
    if (!leftFace || !rightFace) throw new Error(`rouxStages: could not resolve side faces for rotation ${r.join(" ") || "identity"}`);
    return { left, right, aufFace, floorFace, leftFace, rightFace };
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

/** Per-walk context: remembers which block-pair position SB/CMLL solved at, so CMLL/LSE's stageDetail can report the same real faces rather than re-searching (and risking a different, equally-valid position). */
interface RouxContext {
  lockedPosition: BlockPairPosition | null;
}

function isRouxContext(context: unknown): context is RouxContext {
  return typeof context === "object" && context !== null && "lockedPosition" in context;
}

function lockPositionIfUnset(context: unknown, position: BlockPairPosition): void {
  if (isRouxContext(context) && !context.lockedPosition) context.lockedPosition = position;
}

/** First (orientation, position) pair satisfying `predicate` — same iteration order as the equivalent `.some(...)` check, so it returns the exact position that made isStageSolved true. */
function findBlockPosition(
  orientations: LiveCubeState[],
  positions: BlockPairPosition[],
  predicate: (s: LiveCubeState, p: BlockPairPosition) => boolean
): BlockPairPosition | null {
  for (const s of orientations) {
    for (const p of positions) {
      if (predicate(s, p)) return p;
    }
  }
  return null;
}

/** The locked position from context if this call is part of a tracked walk, otherwise a fresh best-effort search (standalone/test calls with no context). */
function resolvePosition(
  context: unknown,
  orientations: LiveCubeState[],
  positions: BlockPairPosition[],
  predicate: (s: LiveCubeState, p: BlockPairPosition) => boolean
): BlockPairPosition | null {
  if (isRouxContext(context) && context.lockedPosition) return context.lockedPosition;
  return findBlockPosition(orientations, positions, predicate);
}

const isCmllPosition = (s: LiveCubeState, p: BlockPairPosition) => bothBlocksSolved(s, p) && cornersSolvedUpToAuf(s, p);

export const rouxStageDetector: StageDetector = {
  method: "Roux",
  stages: ["fb", "sb", "cmll", "lse"],
  createContext: (): RouxContext => ({ lockedPosition: null }),
  isStageSolved(stage, state, context) {
    if (stage === "lse") return isFullySolved(state);
    const positions = getBlockPairPositions(state);
    const orientations = allOrientations(state);
    switch (stage) {
      case "fb":
        // Either side counts as "first" — left vs right is the solver's
        // choice (mirror-grip Roux). Positions already cover every face pair.
        return orientations.some((s) => positions.some((p) => isBlockSolved(s, p.left) || isBlockSolved(s, p.right)));
      case "sb": {
        // Both blocks of ONE pair position under ONE shared offset.
        const found = findBlockPosition(orientations, positions, bothBlocksSolved);
        if (found) lockPositionIfUnset(context, found);
        return found !== null;
      }
      case "cmll": {
        const found = findBlockPosition(orientations, positions, isCmllPosition);
        if (found) lockPositionIfUnset(context, found);
        return found !== null;
      }
      default:
        return false;
    }
  },
  // Details name the physical faces behind fb/sb/cmll/lse so a display can
  // color stages by cube colors (components/cubeColors.ts): fb/sb get the
  // floor + side-wall colors of whichever block(s) just completed, cmll/lse
  // get just the floor face (the display derives the opposite/last-layer
  // color from it, same as CFOP's cross-face convention).
  stageDetail(stage, state, context) {
    const positions = getBlockPairPositions(state);
    const orientations = allOrientations(state);
    switch (stage) {
      case "fb": {
        for (const s of orientations) {
          for (const p of positions) {
            if (isBlockSolved(s, p.left)) return p.floorFace + p.leftFace;
            if (isBlockSolved(s, p.right)) return p.floorFace + p.rightFace;
          }
        }
        return undefined;
      }
      case "sb": {
        const p = resolvePosition(context, orientations, positions, bothBlocksSolved);
        return p ? p.leftFace + p.rightFace : undefined;
      }
      case "cmll":
      case "lse": {
        const p = resolvePosition(context, orientations, positions, isCmllPosition);
        return p?.floorFace;
      }
      default:
        return undefined;
    }
  },
};

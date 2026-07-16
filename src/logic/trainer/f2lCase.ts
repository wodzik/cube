/**
 * F2L pair case sampler — the "F2L" trainer family.
 *
 * A case: the trained slot's CORNER and EDGE are placed at uniformly random
 * positions and orientations anywhere on the cube EXCEPT the cross (the
 * U-face edge slots in the app frame — white cross up). The pair may not be
 * fully solved in its own slot: when both pieces land at home, at least one
 * is misoriented (the sampler resamples otherwise).
 *
 * The rest of the cube stays as solved as the laws of the cube allow:
 *  - a displaced occupant returns to the pair piece's home slot
 *    (a transposition), upgraded to a 3-cycle through a D-layer piece when
 *    a lone transposition would break permutation parity (corner and edge
 *    permutation parities must match);
 *  - orientation sums (edges mod 2, corners mod 3) are compensated on the
 *    moved pieces, or on one random D-layer piece when a pair piece merely
 *    twists in place.
 *
 * These cases have no computed optimal length — the trainer records only
 * move count and time.
 */

import { KPattern, type KPuzzle } from "cubing/kpuzzle";
import { FACE_SLOTS } from "../stageDetection/lastLayerShared";
import { XCROSS_CROSS_FACE, XCROSS_SLOT_FRAMES, type XCrossSlot } from "./xcrossFrames";

export interface F2LCaseSpec {
  /** CORNERS orbit position (0..7) the slot's corner is placed at. */
  cornerPos: number;
  cornerOri: number;
  /** EDGES orbit position (4..11 — never a cross slot) the slot's edge is placed at. */
  edgePos: number;
  edgeOri: number;
}

const CROSS_EDGE_SLOTS = new Set(FACE_SLOTS[XCROSS_CROSS_FACE].edgeSlots);
const ALLOWED_EDGE_POSITIONS = Array.from({ length: 12 }, (_, i) => i).filter((i) => !CROSS_EDGE_SLOTS.has(i));
const ALLOWED_CORNER_POSITIONS = Array.from({ length: 8 }, (_, i) => i);
// D layer = the last layer in this frame — parity/orientation repair pool.
const LL_EDGE_POOL = FACE_SLOTS.D.edgeSlots;
const LL_CORNER_POOL = FACE_SLOTS.D.cornerSlots;

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function sampleF2LCase(slot: XCrossSlot, rng: () => number = Math.random): F2LCaseSpec {
  const frame = XCROSS_SLOT_FRAMES[slot];
  for (;;) {
    const spec: F2LCaseSpec = {
      cornerPos: pick(ALLOWED_CORNER_POSITIONS, rng),
      cornerOri: Math.floor(rng() * 3),
      edgePos: pick(ALLOWED_EDGE_POSITIONS, rng),
      edgeOri: Math.floor(rng() * 2),
    };
    const solvedInSlot =
      spec.cornerPos === frame.cornerSlot &&
      spec.cornerOri === 0 &&
      spec.edgePos === frame.edgeSlot &&
      spec.edgeOri === 0;
    if (!solvedInSlot) return spec;
  }
}

interface OrbitPlan {
  pieces: number[];
  orientation: number[];
  /** True when the placement is a lone transposition (odd permutation). */
  odd: boolean;
  home: number;
  target: number;
  targetOri: number;
  mod: number;
}

function placePiece(
  size: number,
  mod: number,
  home: number,
  target: number,
  targetOri: number,
  repairPool: readonly number[],
  rng: () => number
): OrbitPlan {
  const pieces = Array.from({ length: size }, (_, i) => i);
  const orientation = Array.from({ length: size }, () => 0);
  let odd = false;
  if (target === home) {
    orientation[home] = targetOri;
    if (targetOri !== 0) {
      const comp = pick(repairPool.filter((p) => p !== home), rng);
      orientation[comp] = (mod - targetOri) % mod;
    }
  } else {
    pieces[target] = home;
    pieces[home] = target;
    orientation[target] = targetOri;
    orientation[home] = (mod - targetOri) % mod;
    odd = true;
  }
  return { pieces, orientation, odd, home, target, targetOri, mod };
}

/** Upgrade a transposition plan to a 3-cycle through `third` (even parity). */
function toThreeCycle(plan: OrbitPlan, third: number): void {
  const { pieces, orientation, home, target, targetOri, mod } = plan;
  pieces[target] = home; // trained piece to its sampled spot
  pieces[third] = target; // displaced occupant parks on the D layer
  pieces[home] = third; // the D-layer piece fills the home slot
  orientation[target] = targetOri;
  orientation[third] = 0;
  orientation[home] = (mod - targetOri) % mod;
  plan.odd = false;
}

/** Build the full-cube pattern for a sampled case (solved centers). */
export function f2lCasePattern(kpuzzle: KPuzzle, slot: XCrossSlot, spec: F2LCaseSpec, rng: () => number = Math.random): KPattern {
  const frame = XCROSS_SLOT_FRAMES[slot];
  const corners = placePiece(8, 3, frame.cornerSlot, spec.cornerPos, spec.cornerOri, LL_CORNER_POOL, rng);
  const edges = placePiece(12, 2, frame.edgeSlot, spec.edgePos, spec.edgeOri, LL_EDGE_POOL, rng);

  // Corner and edge permutation parities must match; a lone transposition
  // becomes a 3-cycle through a D-layer piece.
  if (corners.odd !== edges.odd) {
    const plan = corners.odd ? corners : edges;
    const pool = corners.odd ? LL_CORNER_POOL : LL_EDGE_POOL;
    toThreeCycle(plan, pick(pool.filter((p) => p !== plan.target && p !== plan.home), rng));
  }

  const base = kpuzzle.defaultPattern().patternData;
  return new KPattern(kpuzzle, {
    CORNERS: { pieces: corners.pieces, orientation: corners.orientation },
    EDGES: { pieces: edges.pieces, orientation: edges.orientation },
    CENTERS: { pieces: [...base.CENTERS.pieces], orientation: [...base.CENTERS.orientation] },
  });
}

/**
 * F2L pair case sampler — the "F2L" trainer family.
 *
 * A case: the trained slots' CORNERS and EDGES (1–4 pairs) are placed at
 * uniformly random, mutually distinct positions and orientations anywhere
 * on the cube EXCEPT the cross (the U-face edge slots in the app frame —
 * white cross up). No pair may be fully solved in its own slot: when both
 * of a pair's pieces land at home, at least one is misoriented (the
 * sampler resamples otherwise).
 *
 * The rest of the cube stays as solved as the laws of the cube allow:
 *  - untrained pieces keep their home position whenever it isn't taken
 *    (identity-first fill); displaced occupants park on the leftover
 *    positions;
 *  - corner and edge permutation parities must match — when they don't,
 *    two spare (untrained, non-cross) assignments in one orbit are
 *    swapped;
 *  - orientation sums (edges mod 2, corners mod 3) are compensated on one
 *    spare position per orbit.
 *
 * These cases have no computed optimal length — the trainer records only
 * move count and time.
 */

import { KPattern, type KPuzzle } from "cubing/kpuzzle";
import { FACE_SLOTS } from "../stageDetection/lastLayerShared";
import { XCROSS_CROSS_FACE, XCROSS_SLOT_FRAMES, type XCrossSlot } from "./xcrossFrames";

export interface F2LPlacement {
  slot: XCrossSlot;
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

/** Fisher–Yates sample of `n` distinct elements. */
function sampleDistinct<T>(arr: readonly T[], n: number, rng: () => number): T[] {
  const pool = [...arr];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

export function sampleF2LPlacements(slots: readonly XCrossSlot[], rng: () => number = Math.random): F2LPlacement[] {
  for (;;) {
    const cornerPositions = sampleDistinct(ALLOWED_CORNER_POSITIONS, slots.length, rng);
    const edgePositions = sampleDistinct(ALLOWED_EDGE_POSITIONS, slots.length, rng);
    const placements = slots.map((slot, i) => ({
      slot,
      cornerPos: cornerPositions[i],
      cornerOri: Math.floor(rng() * 3),
      edgePos: edgePositions[i],
      edgeOri: Math.floor(rng() * 2),
    }));
    const anyFullySolved = placements.some((p) => {
      const frame = XCROSS_SLOT_FRAMES[p.slot];
      return p.cornerPos === frame.cornerSlot && p.cornerOri === 0 && p.edgePos === frame.edgeSlot && p.edgeOri === 0;
    });
    if (!anyFullySolved) return placements;
  }
}

/** Back-compat single-pair sampler (f2l-case drill). */
export function sampleF2LCase(slot: XCrossSlot, rng: () => number = Math.random): F2LPlacement {
  return sampleF2LPlacements([slot], rng)[0];
}

interface OrbitPlan {
  pieces: number[];
  orientation: number[];
  /** Positions not holding a trained piece and legal to repurpose (non-cross). */
  sparePositions: number[];
}

function buildOrbit(
  size: number,
  mod: number,
  placed: { piece: number; pos: number; ori: number }[],
  /** Positions that must keep their own piece (the cross). */
  frozen: ReadonlySet<number>,
  rng: () => number
): OrbitPlan {
  const pieces = Array.from({ length: size }, () => -1);
  const orientation = Array.from({ length: size }, () => 0);
  const placedPieces = new Set(placed.map((p) => p.piece));
  const takenPositions = new Set(placed.map((p) => p.pos));
  for (const p of placed) {
    pieces[p.pos] = p.piece;
    orientation[p.pos] = p.ori;
  }
  // Identity-first fill for everything untrained…
  for (let pos = 0; pos < size; pos++) {
    if (pieces[pos] === -1 && !placedPieces.has(pos)) pieces[pos] = pos;
  }
  // …then park the displaced occupants on the leftover positions.
  const leftoverPositions = [];
  for (let pos = 0; pos < size; pos++) if (pieces[pos] === -1) leftoverPositions.push(pos);
  const used = new Set(pieces.filter((x) => x !== -1));
  const leftoverPieces = sampleDistinct(
    Array.from({ length: size }, (_, i) => i).filter((i) => !used.has(i)),
    size,
    rng
  );
  leftoverPositions.forEach((pos, i) => (pieces[pos] = leftoverPieces[i]));

  const sparePositions = Array.from({ length: size }, (_, pos) => pos).filter(
    (pos) => !takenPositions.has(pos) && !frozen.has(pos)
  );

  // Orientation sum invariant (mod `mod`) — compensate on one spare position.
  const sum = orientation.reduce((a, b) => a + b, 0) % mod;
  if (sum !== 0) {
    const comp = sparePositions[Math.floor(rng() * sparePositions.length)];
    orientation[comp] = (mod - sum) % mod;
  }

  return { pieces, orientation, sparePositions };
}

function permutationParity(pieces: readonly number[]): number {
  let parity = 0;
  const seen = new Set<number>();
  for (let i = 0; i < pieces.length; i++) {
    if (seen.has(i)) continue;
    let j = i;
    let len = 0;
    while (!seen.has(j)) {
      seen.add(j);
      j = pieces[j];
      len++;
    }
    parity ^= (len - 1) % 2;
  }
  return parity;
}

/** Build the full-cube pattern for sampled placements (solved centers). */
export function f2lCasePattern(
  kpuzzle: KPuzzle,
  placements: readonly F2LPlacement[],
  rng: () => number = Math.random
): KPattern {
  const corners = buildOrbit(
    8,
    3,
    placements.map((p) => ({ piece: XCROSS_SLOT_FRAMES[p.slot].cornerSlot, pos: p.cornerPos, ori: p.cornerOri })),
    new Set(),
    rng
  );
  const edges = buildOrbit(
    12,
    2,
    placements.map((p) => ({ piece: XCROSS_SLOT_FRAMES[p.slot].edgeSlot, pos: p.edgePos, ori: p.edgeOri })),
    CROSS_EDGE_SLOTS,
    rng
  );

  // Corner and edge permutation parities must match — swap two spare edge
  // assignments when they don't (edges always have ≥4 spares).
  if (permutationParity(corners.pieces) !== permutationParity(edges.pieces)) {
    const [a, b] = sampleDistinct(edges.sparePositions, 2, rng);
    [edges.pieces[a], edges.pieces[b]] = [edges.pieces[b], edges.pieces[a]];
    [edges.orientation[a], edges.orientation[b]] = [edges.orientation[b], edges.orientation[a]];
  }

  const base = kpuzzle.defaultPattern().patternData;
  return new KPattern(kpuzzle, {
    CORNERS: { pieces: corners.pieces, orientation: corners.orientation },
    EDGES: { pieces: edges.pieces, orientation: edges.orientation },
    CENTERS: { pieces: [...base.CENTERS.pieces], orientation: [...base.CENTERS.orientation] },
  });
}

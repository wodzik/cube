/**
 * Unified sequence tracker — used for BOTH scramble tracking and algorithm
 * execution tracking. These used to be two separate engines
 * (scrambleTracker.ts + algorithmProgress.ts's AlgorithmTracker class); they
 * solve the identical problem: match incoming physical moves against a known
 * target sequence, tolerate adjacent opposite-face reordering, accumulate
 * partial power, detect wrong moves, and build a repair sequence.
 *
 * KEY INSIGHT enabling the merge: a scramble is known in full before tracking
 * starts, exactly like an algorithm — so both can be precomputed into the
 * same PhysicalMove[] shape via algToPhysicalMoves (wide/slice/rotation
 * decomposition, orientation-frame shifts) and walked by one engine. There is
 * no need for scrambleTracker's old incremental "apply rotations as we go"
 * pass; a single upfront conversion is equivalent and simpler.
 *
 * STATELESS BY DESIGN: computeSequenceProgress takes the full move history
 * and recomputes progress from scratch every call. Move counts here are
 * always small (scrambles ~20-25 moves, algorithms usually <15), so this is
 * cheap — and it means the reducer/session state doesn't need to carry any
 * tracker-internal fields (accumulated power, pending composite parts,
 * skipped-move indices, wrong-move stack) between moves. All of that is
 * derived on demand from `moveLog`, the same way sessionSelectors already
 * derives other display data.
 *
 * PURE FUNCTIONS — zero side-effects, zero React imports.
 */

import type { Face, Orientation, PhysicalMove } from "../types/cube";
import { algToPhysicalMoves, createMoveStr, parseMove, reducePhysicalMoves } from "./moveParser";

const FACE_OPPOSITES: Record<Face, Face> = {
  U: "D", D: "U",
  R: "L", L: "R",
  F: "B", B: "F",
};

/**
 * A target sequence (scramble OR algorithm), precomputed once from its
 * notation string. Build with buildSequenceTarget, then reuse across calls
 * to computeSequenceProgress as the user's moves come in.
 */
export interface SequenceTarget {
  /** Physical moves the tracker expects, in order, each tagged with its original token index. */
  physicalMoves: PhysicalMove[];
  /** Token indices in the original sequence that are pure rotations (x/y/z) — auto-completed, never physically matched. */
  rotationIndices: number[];
  /** Total token count in the original sequence (physical + rotation tokens). */
  tokenCount: number;
}

export function buildSequenceTarget(
  sequence: string,
  initialOrientation?: Orientation
): SequenceTarget {
  const tokens = sequence.trim().split(/\s+/).filter(Boolean);
  const physicalMoves = algToPhysicalMoves(sequence, initialOrientation);
  const rotationIndices: number[] = [];
  tokens.forEach((token, i) => {
    if (parseMove(token)?.isRotation) rotationIndices.push(i);
  });
  return { physicalMoves, rotationIndices, tokenCount: tokens.length };
}

/**
 * Snapshot of progress through a SequenceTarget, given everything the user
 * has done so far.
 */
export interface SequenceProgress {
  /** Original-token indices fully completed, sorted ascending (includes auto-completed rotation tokens). */
  completedIndices: number[];
  completedCount: number;
  /** Token index the tracker expects next; null if blocked by an uncorrected wrong move, or already done. */
  nextIndex: number | null;
  /** Token indices "started" but not finished within the current block (max 2, for UI highlighting). */
  startedIndices: number[];
  isCompleted: boolean;
  /** True if a wrong move occurred at ANY point, even if it has since been corrected. */
  hadErrors: boolean;
  /** Moves needed right now to undo the current uncorrected wrong moves. Empty if none. */
  correctionSequence: string[];
  /** Moves needed to undo "started" partial moves within the current block. */
  startedCorrectionSequence: string[];
}

const EMPTY_PROGRESS: SequenceProgress = {
  completedIndices: [],
  completedCount: 0,
  nextIndex: null,
  startedIndices: [],
  isCompleted: true,
  hadErrors: false,
  correctionSequence: [],
  startedCorrectionSequence: [],
};

/**
 * Compute progress through `target` given the full ordered list of physical
 * moves the user has performed (e.g. state.moveLog for the current phase,
 * mapped to `.move` strings).
 */
export function computeSequenceProgress(
  target: SequenceTarget,
  userMoves: string[]
): SequenceProgress {
  if (target.physicalMoves.length === 0) {
    return EMPTY_PROGRESS;
  }

  const blocks = groupIntoBlocks(target.physicalMoves);
  const rawUserPhysical = algToPhysicalMoves(userMoves.join(" "));
  const reducedUserMoves = reducePhysicalMoves(rawUserPhysical);

  // Incremental scan solely to capture "an error occurred at some point" —
  // even if later cancelled out by reduction (e.g. a wrong move immediately
  // undone). Cheap: these move counts are always small.
  let hadErrors = false;
  for (let i = 1; i <= rawUserPhysical.length && !hadErrors; i++) {
    const prefix = reducePhysicalMoves(rawUserPhysical.slice(0, i));
    if (matchAgainstBlocks(blocks, prefix).wrongMoves.length > 0) hadErrors = true;
  }

  const { blockIndex, completedAlgIndices, blockAccumulated, wrongMoves } =
    matchAgainstBlocks(blocks, reducedUserMoves);

  const correctionSequence = buildCorrectionSequence(wrongMoves);
  hadErrors = hadErrors || correctionSequence.length > 0;

  const currentBlock = blockIndex < blocks.length ? blocks[blockIndex] : [];
  const completedInCurrentBlock = movesCompletedInBlock(currentBlock, blockAccumulated, completedAlgIndices);
  const startedInCurrentBlock = movesStartedInBlock(currentBlock, blockAccumulated, completedAlgIndices);

  const physicalCompleted = [...completedAlgIndices, ...completedInCurrentBlock].sort((a, b) => a - b);
  const startedIndices = startedInCurrentBlock.slice(0, 2);

  const isBlocked = wrongMoves.length > 0;
  const pendingInBlock = currentBlock.filter((m) => !physicalCompleted.includes(m.algIndex));
  const nextIndex =
    isBlocked || blockIndex >= blocks.length || pendingInBlock.length === 0
      ? null
      : Math.min(...pendingInBlock.map((m) => m.algIndex));

  // Rotation tokens (x, y, z) auto-complete once every physical move before them is done —
  // they never produce a PhysicalMove themselves (algToPhysicalMoves only emits the
  // orientation shift), so they can't be "matched" the normal way.
  const minPendingPhysical = target.physicalMoves
    .filter((m) => !physicalCompleted.includes(m.algIndex))
    .reduce((min, m) => Math.min(min, m.algIndex), Infinity);
  const autoCompletedRotations = target.rotationIndices.filter((r) => r < minPendingPhysical);

  // Dedupe: a slice/wide token (e.g. "M", "Rw") decomposes into MULTIPLE
  // physical moves that all share the same original algIndex — without this,
  // completing one such token would count as 2+ completed tokens.
  const completedIndices = Array.from(
    new Set([...physicalCompleted, ...autoCompletedRotations])
  ).sort((a, b) => a - b);
  const isCompleted = blockIndex >= blocks.length && wrongMoves.length === 0;
  const startedCorrectionSequence = buildStartedCorrections(blockAccumulated);

  return {
    completedIndices,
    completedCount: completedIndices.length,
    nextIndex,
    startedIndices,
    isCompleted,
    hadErrors,
    correctionSequence,
    startedCorrectionSequence,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL — block grouping and matching
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Group physical moves into maximal runs that share a face (or its opposite).
 * Moves within a block may be completed in any order — this is what lets the
 * tracker accept e.g. "L R" for a target of "R L" (adjacent opposite-face
 * moves commute). A block breaks the moment a move on an unrelated face
 * appears — reordering is only tolerated for LOCALLY adjacent runs, not
 * arbitrarily far apart in the sequence. This intentionally narrows the old
 * scrambleTracker's behavior, which let ANY previously-skipped move be
 * completed arbitrarily later in the scramble; that flexibility was an
 * artifact of its incremental implementation, not something solvers actually
 * rely on (real out-of-order execution is always local — e.g. grabbing two
 * opposite faces at once).
 */
function groupIntoBlocks(moves: PhysicalMove[]): PhysicalMove[][] {
  if (moves.length === 0) return [];

  const blocks: PhysicalMove[][] = [];
  let currentBlock: PhysicalMove[] = [moves[0]];

  for (let i = 1; i < moves.length; i++) {
    const move = moves[i];
    const canJoin = currentBlock.every(
      (m) => m.face === move.face || FACE_OPPOSITES[m.face] === move.face
    );
    if (canJoin) {
      currentBlock.push(move);
    } else {
      blocks.push(currentBlock);
      currentBlock = [move];
    }
  }
  blocks.push(currentBlock);

  return blocks;
}

interface BlockMatchResult {
  blockIndex: number;
  completedAlgIndices: number[];
  blockAccumulated: Map<Face, number>;
  wrongMoves: PhysicalMove[];
}

function matchAgainstBlocks(
  blocks: PhysicalMove[][],
  reducedMoves: PhysicalMove[]
): BlockMatchResult {
  const completedAlgIndices: number[] = [];
  let blockIndex = 0;
  let userMoveIdx = 0;
  const blockAccumulated = new Map<Face, number>();

  while (userMoveIdx < reducedMoves.length && blockIndex < blocks.length) {
    const block = blocks[blockIndex];
    const move = reducedMoves[userMoveIdx];
    const blockFaces = new Set(block.map((m) => m.face));

    if (!blockFaces.has(move.face)) break;

    const current = blockAccumulated.get(move.face) || 0;
    const newTotal = (current + move.power) % 4;
    if (newTotal === 0) blockAccumulated.delete(move.face);
    else blockAccumulated.set(move.face, newTotal);
    userMoveIdx++;

    if (isBlockComplete(block, blockAccumulated)) {
      completedAlgIndices.push(...block.map((m) => m.algIndex));
      blockAccumulated.clear();
      blockIndex++;
    }
  }

  return {
    blockIndex,
    completedAlgIndices,
    blockAccumulated,
    wrongMoves: reducedMoves.slice(userMoveIdx),
  };
}

function isBlockComplete(block: PhysicalMove[], accumulated: Map<Face, number>): boolean {
  const expected = new Map<Face, number>();
  for (const move of block) {
    const current = expected.get(move.face) || 0;
    expected.set(move.face, (current + move.power) % 4);
  }
  for (const [face, power] of expected) if (power === 0) expected.delete(face);

  if (accumulated.size !== expected.size) return false;
  for (const [face, power] of expected) {
    if (accumulated.get(face) !== power) return false;
  }
  return true;
}

function movesCompletedInBlock(
  block: PhysicalMove[],
  accumulated: Map<Face, number>,
  alreadyCompleted: number[]
): number[] {
  const completed: number[] = [];
  const byFace = groupByFace(block);

  for (const [face, { indices, totalPower }] of byFace) {
    const done = accumulated.get(face) || 0;
    if (done === totalPower) {
      for (const idx of indices) {
        if (!alreadyCompleted.includes(block[idx].algIndex)) completed.push(block[idx].algIndex);
      }
    }
  }
  return completed;
}

function movesStartedInBlock(
  block: PhysicalMove[],
  accumulated: Map<Face, number>,
  alreadyCompleted: number[]
): number[] {
  const started: number[] = [];
  const byFace = groupByFace(block);

  for (const [face, { indices, totalPower }] of byFace) {
    const done = accumulated.get(face) || 0;
    if (done > 0 && done !== totalPower) {
      for (const idx of indices) {
        if (!alreadyCompleted.includes(block[idx].algIndex)) started.push(block[idx].algIndex);
      }
    }
  }
  return started.sort((a, b) => a - b);
}

function groupByFace(
  block: PhysicalMove[]
): Map<Face, { indices: number[]; totalPower: number }> {
  const byFace = new Map<Face, { indices: number[]; totalPower: number }>();
  for (let i = 0; i < block.length; i++) {
    const move = block[i];
    if (!byFace.has(move.face)) byFace.set(move.face, { indices: [], totalPower: 0 });
    const entry = byFace.get(move.face)!;
    entry.indices.push(i);
    entry.totalPower = (entry.totalPower + move.power) % 4;
  }
  return byFace;
}

function buildCorrectionSequence(wrongMoves: PhysicalMove[]): string[] {
  const corrections: string[] = [];
  for (const move of wrongMoves) {
    const invPower = (4 - move.power) % 4;
    const moveStr = createMoveStr(move.face, invPower);
    if (moveStr) corrections.unshift(moveStr);
  }
  return corrections;
}

function buildStartedCorrections(accumulated: Map<Face, number>): string[] {
  const corrections: string[] = [];
  accumulated.forEach((power, face) => {
    if (power > 0) {
      const invPower = (4 - power) % 4;
      const moveStr = createMoveStr(face, invPower);
      if (moveStr) corrections.push(moveStr);
    }
  });
  return corrections;
}

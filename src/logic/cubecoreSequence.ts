/**
 * Following a target sequence (scramble or algorithm) with cubecore's
 * SequenceTracker — the same engine the <cube-scramble> / <cube-alg-practice>
 * elements run, so the session's verdict and what the bar shows agree.
 *
 * Tracking is by cube STATE from where the cube was when the target was set
 * (not from a solved cube): half turns as quarters either way, opposite
 * faces in any order, slices / wide moves / rotations as the face turns a
 * smart cube reports, and `frame` for how the cube is held at the start
 * (after an algorithm with a net rotation).
 *
 * PURE FUNCTIONS — recomputed from the move log on demand (cheap: a few
 * dozen moves).
 */

import { FACES, FRAMES, type Frame, IDENTITY_FRAME, type SequenceProgress, SequenceTracker, type State, parseAlg, solvedState } from "@cubecore/core";
import type { Orientation } from "../types/cube";

export type { SequenceProgress };

/** Where a target is followed from: the cube's state and grip when it was set. */
export interface SequenceTarget {
  start: State;
  frame: Frame;
}

/** act's Orientation (logical position → physical face there) as a cubecore frame. */
export function orientationToFrame(o?: Orientation): Frame {
  if (!o) return IDENTITY_FRAME;
  return FRAMES.find((f) => FACES.every((face) => f.face[face] === o[face])) ?? IDENTITY_FRAME;
}

export function sequenceTarget(start?: State | null, orientation?: Orientation): SequenceTarget {
  return { start: start ?? solvedState(), frame: orientationToFrame(orientation) };
}

export interface TrackedProgress extends SequenceProgress {
  /** Went off the path at some point (even if fixed since). */
  hadErrors: boolean;
}

/** Progress through `notation` after `moves` (face turns as reported, e.g. "R", "U'"); null for an empty target. */
export function sequenceProgress(notation: string, target: SequenceTarget, moves: readonly string[]): TrackedProgress | null {
  if (!notation.trim()) return null;
  const tracker = new SequenceTracker(notation, target.start, { frame: target.frame });
  let hadErrors = false;
  for (const m of moves) for (const move of parseAlg(m)) hadErrors = tracker.push(move).undo.length > 0 || hadErrors;
  return { ...tracker.progress, hadErrors };
}

/** Indices of the written moves fully done. */
export const doneTokens = (p: SequenceProgress): number[] => p.tokens.flatMap((t, i) => (t === "done" ? [i] : []));

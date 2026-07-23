/**
 * Generic engine: replays a move sequence through the shared LiveCubeState
 * once per StageDetector, producing StageBoundary[] — the moment each stage
 * was first satisfied. Used identically for CFOP and Roux; call once per
 * detector to track both in parallel, non-destructively (neither overwrites
 * the other — see plan.md §6.3).
 *
 * StageWalker is the actual engine — a stateful object fed ONE move at a
 * time (feedMove), O(1) amortized per move. computeStageBoundaries is a
 * thin batch wrapper over it (construct + feed the whole array + return
 * boundaries) for callers that already have the full move list up front
 * (post-solve analysis, tests). LIVE tracking during an active solve
 * (hooks/useMethodProgress.ts) holds a StageWalker directly and feeds it
 * moves as they happen, instead of replaying the whole history from
 * scratch on every new move — the old fully-stateless "recompute is cheap"
 * approach was fine for a one-shot post-solve computation, but re-running
 * from move 0 on every single new move during a live solve is O(n^2) over
 * the solve. (methodResolution.ts also holds a StageWalker per candidate
 * the same way, but is currently dormant — see its doc comment.)
 */

import { applyMoveToState, type LiveCubeState } from "./liveCubeState";
import type { StageBoundary, StageDetector } from "./types";

export interface TimedMove {
  move: string;
  relativeMs: number;
}

export class StageWalker {
  private state: LiveCubeState;
  private stageIdx = 0;
  // One context for the whole walk — see StageDetector's doc comment for
  // why this exists (CFOP locks its cross face here the moment it's first
  // detected, instead of re-detecting it fresh on every subsequent stage).
  private readonly context: unknown;
  private readonly detector: StageDetector;
  private readonly _boundaries: StageBoundary[] = [];

  constructor(detector: StageDetector, startState: LiveCubeState) {
    this.detector = detector;
    this.state = startState;
    this.context = detector.createContext?.();
    // Handle the (rare but possible) case where a stage is already
    // satisfied by the starting state before any move is made — e.g. the
    // cross happens to already be solved right as solving begins.
    this.checkStages(-1, 0);
  }

  /** Applies one more move and records any stage(s) it completes. O(1) amortized — never re-walks earlier moves. */
  feedMove(move: TimedMove, moveIndex: number): void {
    if (this.isComplete) return;
    this.state = applyMoveToState(this.state, move.move);
    this.checkStages(moveIndex, move.relativeMs);
  }

  private checkStages(moveIndex: number, timestampMs: number): void {
    const { detector, context } = this;
    while (this.stageIdx < detector.stages.length && detector.isStageSolved(detector.stages[this.stageIdx], this.state, context)) {
      const stage = detector.stages[this.stageIdx];
      const detail = detector.stageDetail?.(stage, this.state, context);
      this._boundaries.push(detail !== undefined ? { stage, moveIndex, timestampMs, detail } : { stage, moveIndex, timestampMs });
      this.stageIdx++;
    }
  }

  get boundaries(): readonly StageBoundary[] {
    return this._boundaries;
  }

  get isComplete(): boolean {
    return this.stageIdx >= this.detector.stages.length;
  }
}

export function computeStageBoundaries(
  detector: StageDetector,
  moves: readonly TimedMove[],
  /** State BEFORE `moves` are applied — for a normal solve this is the post-scramble state, not the truly-solved one. */
  startState: LiveCubeState
): StageBoundary[] {
  const walker = new StageWalker(detector, startState);
  for (let i = 0; i < moves.length && !walker.isComplete; i++) {
    walker.feedMove(moves[i], i);
  }
  return [...walker.boundaries];
}

export { cfopStageDetector } from "./cfopStages";
export { rouxStageDetector } from "./rouxStages";
export { createSolvedState, type LiveCubeState } from "./liveCubeState";
export type { StageBoundary, StageDetector } from "./types";

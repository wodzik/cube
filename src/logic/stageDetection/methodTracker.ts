/**
 * Stage boundaries of a solve — cubecore's MethodTracker (every stage
 * checked by stickers in all 24 orientations; the orientation that gets
 * furthest, earliest, wins — so a cross / block on any colour is followed,
 * and an accidental one elsewhere can't take over) mapped to the app's
 * stage ids and details (see types.ts).
 *
 * StageWalker is fed one move at a time (live, hooks/useMethodProgress);
 * computeStageBoundaries replays a whole solve (analysis, saving).
 */

import { type Frame, MethodTracker, type State, applyMoves, solvedState } from "@wodzik/cubecore/core";
import type { StageBoundary, StageDetector } from "./types";

export interface TimedMove {
  move: string;
  relativeMs: number;
}

/** The state a solve starts from: its scramble applied to a solved cube. */
export const startStateOf = (scramble: string): State => applyMoves(solvedState(), scramble.trim());

/** cubecore's boundaries (moves applied when reached) → the app's (index of the completing move; −1 = before the first). */
function toBoundaries(detector: StageDetector, tracker: MethodTracker): StageBoundary[] {
  const frame: Frame | null = tracker.current.frame;
  const out: StageBoundary[] = [];
  for (const b of tracker.boundaries) {
    const stage = detector.stageId(b.stage);
    if (!stage) continue;
    const detail = detector.detail(stage, b.detail, frame, out);
    out.push({ stage, moveIndex: b.moveIndex - 1, timestampMs: b.moveIndex === 0 ? 0 : (b.time ?? 0), ...(detail !== undefined ? { detail } : {}) });
  }
  return out;
}

export class StageWalker {
  private readonly tracker: MethodTracker;

  constructor(
    private readonly detector: StageDetector,
    startState: State
  ) {
    this.tracker = new MethodTracker(detector.cubecore, startState);
  }

  /** One more move (the index is its position in the solve — the tracker counts them itself). */
  feedMove(move: TimedMove, _moveIndex?: number): void {
    if (this.isComplete) return;
    this.tracker.push(move.move, move.relativeMs);
  }

  get boundaries(): readonly StageBoundary[] {
    return toBoundaries(this.detector, this.tracker);
  }

  get isComplete(): boolean {
    return this.tracker.current.done;
  }
}

export function computeStageBoundaries(
  detector: StageDetector,
  moves: readonly TimedMove[],
  /** State BEFORE `moves` — for a solve, the scrambled state (startStateOf). */
  startState: State
): StageBoundary[] {
  const walker = new StageWalker(detector, startState);
  for (let i = 0; i < moves.length && !walker.isComplete; i++) walker.feedMove(moves[i], i);
  return [...walker.boundaries];
}

export { cfopStageDetector } from "./cfopStages";
export { rouxStageDetector } from "./rouxStages";
export type { StageBoundary, StageDetector } from "./types";

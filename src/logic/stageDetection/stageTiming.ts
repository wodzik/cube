/**
 * Per-stage timing breakdown for a completed solve.
 *
 * Splits each stage's time window into:
 *   - recognitionMs — from the previous stage's completing move to the FIRST
 *                     move of this stage (pause before acting)
 *   - executionMs   — from that first move to this stage's completing move
 *   - totalMs       — recognitionMs + executionMs (== boundary gap)
 *
 * Plus the move count and the actual moves performed during the stage
 * (collapsed for display via collapseIdenticalMoves, same as SolveRecord's
 * top-level reducedMoves).
 *
 * Pure — no React. StageBoundary.moveIndex indexes into the SAME raw move
 * array (SolveRecord.moves / state.moveLog) that produced it, see
 * useMethodProgress/methodTracker.
 */

import { collapseIdenticalMoves } from "../moveReduction";
import type { MoveRecord } from "../../types/session";
import type { StageBoundary } from "./types";

export interface StageTiming {
  stage: string;
  /** Raw (quarter-turn) move count performed during this stage; 0 if the stage was already solved before the solve started or hasn't been reached yet. */
  moveCount: number;
  /** Display moves for this stage (e.g. R,R -> R2; R,R' stays separate). */
  moves: string[];
  recognitionMs: number;
  executionMs: number;
  totalMs: number;
  /** Raw-move index of this stage's first move (for jumping a player to the start of the stage), or null if it contributed no moves. */
  startMoveIndex: number | null;
  /** Raw-move index of the move that completed this stage, or null if not reached / already solved pre-solve. */
  endMoveIndex: number | null;
}

export function computeStageTimings(
  stages: readonly string[],
  boundaries: readonly StageBoundary[],
  moves: readonly MoveRecord[]
): StageTiming[] {
  const byStage = new Map(boundaries.map((b) => [b.stage, b]));
  const timings: StageTiming[] = [];

  let prevTimestampMs = 0;
  let prevMoveIndex = -1;

  for (const stage of stages) {
    const boundary = byStage.get(stage);
    if (!boundary) {
      timings.push({ stage, moveCount: 0, moves: [], recognitionMs: 0, executionMs: 0, totalMs: 0, startMoveIndex: null, endMoveIndex: null });
      continue;
    }

    const moveCount = Math.max(0, boundary.moveIndex - prevMoveIndex);
    let recognitionMs = 0;
    let executionMs = 0;
    let stageMoves: string[] = [];

    if (moveCount > 0) {
      const stageRawMoves = moves.slice(prevMoveIndex + 1, boundary.moveIndex + 1);
      stageMoves = collapseIdenticalMoves(stageRawMoves.map((m) => m.move));
      const firstMove = stageRawMoves[0];
      const firstMoveTimestampMs = firstMove ? firstMove.relativeMs : boundary.timestampMs;
      recognitionMs = Math.max(0, firstMoveTimestampMs - prevTimestampMs);
      executionMs = Math.max(0, boundary.timestampMs - firstMoveTimestampMs);
    }

    timings.push({
      stage,
      moveCount,
      moves: stageMoves,
      recognitionMs,
      executionMs,
      totalMs: boundary.timestampMs - prevTimestampMs,
      startMoveIndex: moveCount > 0 ? prevMoveIndex + 1 : null,
      endMoveIndex: boundary.moveIndex >= 0 ? boundary.moveIndex : null,
    });

    prevTimestampMs = boundary.timestampMs;
    prevMoveIndex = boundary.moveIndex;
  }

  return timings;
}

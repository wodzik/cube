/**
 * Derived data selectors for SessionState.
 * Pure functions — no React, no side effects.
 */

import { computeSequenceProgress, type SequenceProgress } from "../logic/sequenceTracker";
import { collapseIdenticalMoves } from "../logic/moveReduction";
import type { SessionState } from "../types/session";

/**
 * Progress through the current target sequence — scramble (solve's "setup")
 * or algorithm (algorithm/attack's "active"). null when there's nothing to
 * track (no target set, or solve mode's free-form "active" phase).
 */
export function selectCurrentProgress(state: SessionState): SequenceProgress | null {
  if (!state.target) return null;
  // Empty target (manual/hand-setup starting stage, see ActionType.
  // MANUAL_SETUP_DONE) has nothing to track — computeSequenceProgress
  // treats an empty target as trivially "completed", which would otherwise
  // surface as a misleading "Complete!" banner the instant setup begins.
  if (state.target.physicalMoves.length === 0) return null;
  const isTrackedPhase =
    state.phase === "setup" ||
    (state.phase === "active" && state.config.mode !== "solve");
  if (!isTrackedPhase) return null;

  return computeSequenceProgress(state.target, state.moveLog.map((m) => m.move));
}

/** Elapsed time since the timer started, clamped to endTime once stopped. null if not started. */
export function selectElapsedMs(state: SessionState, now: number): number | null {
  if (state.startTime === null) return null;
  const end = state.endTime ?? now;
  return end - state.startTime;
}

/** Final solve/attempt time — only defined once both start and end are set. */
export function selectSolveTimeMs(state: SessionState): number | null {
  if (state.startTime === null || state.endTime === null) return null;
  return state.endTime - state.startTime;
}

/** Move count for display/TPS — uses collapseIdenticalMoves (R,R → R2), NOT sequence-tracker reduction. */
export function selectMoveCount(state: SessionState): number {
  return collapseIdenticalMoves(state.moveLog.map((m) => m.move)).length;
}

export function selectTPS(state: SessionState): number | null {
  const timeMs = selectSolveTimeMs(state);
  if (timeMs === null || timeMs === 0) return null;
  return selectMoveCount(state) / (timeMs / 1000);
}

/** Seconds remaining in WCA inspection; negative once overtime. null if not inspecting. */
export function selectInspectionRemainingSec(state: SessionState, now: number): number | null {
  if (state.inspectionStartTime === null) return null;
  const elapsedSec = (now - state.inspectionStartTime) / 1000;
  return state.config.inspectionSeconds - elapsedSec;
}

/** Time from the timer starting to the first logged move — reaction/pick-up time. */
export function selectTimeToFirstMoveMs(state: SessionState): number | null {
  if (state.startTime === null || state.moveLog.length === 0) return null;
  return state.moveLog[0].timestamp - state.startTime;
}

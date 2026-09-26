/**
 * Derived data selectors for SessionState.
 * Pure functions — no React, no side effects.
 */

import { sequenceProgress, type TrackedProgress } from "../logic/cubecoreSequence";
import { collapseIdenticalMoves } from "../logic/moveReduction";
import type { SessionState } from "../types/session";

/**
 * Progress through the current target sequence — scramble (solve's "setup")
 * or algorithm (algorithm/attack's "active"). null when there's nothing to
 * track (no target set, or solve mode's free-form "active" phase).
 */
export function selectCurrentProgress(state: SessionState): TrackedProgress | null {
  if (!state.target) return null;
  // Empty target (manual/hand-setup starting stage, see ActionType.
  // MANUAL_SETUP_DONE) has nothing to track (sequenceProgress gives null).
  const isTrackedPhase =
    state.phase === "setup" ||
    (state.phase === "active" && state.config.mode !== "solve");
  if (!isTrackedPhase) return null;

  return sequenceProgress(state.targetNotation, state.target, state.moveLog.map((m) => m.move));
}

/**
 * What the sequence bar follows: the target, where it started and the moves
 * made on it — while it's tracked AND right after it's done (so the move
 * that completes it shows too): solve's scramble through "ready" /
 * "inspecting" (the log still holds the scramble moves), an algorithm
 * through "done". null otherwise — the bar keeps showing where it got to
 * (a solve's log holds the solve by then).
 */
export function selectTracking(state: SessionState): { notation: string; target: NonNullable<SessionState["target"]>; moves: SessionState["moveLog"] } | null {
  if (!state.target || !state.targetNotation.trim()) return null;
  const solve = state.config.mode === "solve";
  const follows =
    state.phase === "setup" ||
    (solve ? state.phase === "ready" || state.phase === "inspecting" : state.phase === "active" || state.phase === "done");
  return follows ? { notation: state.targetNotation, target: state.target, moves: state.moveLog } : null;
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

/**
 * Unified session reducer — drives Solve, Algorithm training, and Attack.
 *
 * PRINCIPLES:
 * 1. Pure function — zero side-effects, no external reads.
 * 2. All decision data is in state + action.
 * 3. Move-sequence tracking delegated to logic/sequenceTracker.ts — this
 *    reducer never re-implements match/error/repair logic itself, whether
 *    the phase is "solve scrambling" or "algorithm execution". Same engine,
 *    different target notation (see §6.2 of plan.md).
 *
 * Replaces THREE previously-separate hand-rolled phase machines
 * (SolvePage's sessionReducer, TrainingPage's local DrillPhase state,
 * AttackPage's local AttackPhase state) with one.
 */

import type { MoveRecord, Phase, SessionState } from "../types/session";
import { INITIAL_SESSION_STATE } from "../types/session";
import { ActionType, type SessionAction } from "./sessionActions";
import { buildSequenceTarget, computeSequenceProgress } from "../logic/sequenceTracker";

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case ActionType.CONFIGURE: {
      return { ...INITIAL_SESSION_STATE, phase: "idle", config: action.config };
    }

    // Sets the next thing to track — a scramble (solve mode) or an
    // algorithm (algorithm/attack mode). Same action either way: from the
    // reducer's point of view a scramble IS just a target sequence.
    case ActionType.TARGET_READY: {
      const target = buildSequenceTarget(action.targetNotation, action.initialOrientation);
      return {
        ...state,
        phase: "setup",
        targetNotation: action.targetNotation,
        target,
        moveLog: [],
        startTime: null,
        endTime: null,
        inspectionStartTime: null,
        startedBy: null,
        endedBy: null,
        error: null,
      };
    }

    case ActionType.CUBE_MOVE: {
      return handleCubeMove(state, action.move, action.timestamp);
    }

    // Solve mode only — algorithm/attack always start on the first move (see handleCubeMove).
    case ActionType.START_SIGNAL: {
      if (state.config.mode !== "solve") return state;
      if (!state.config.startMethod.includes(action.source)) return state;
      if (state.phase !== "ready" && state.phase !== "inspecting") return state;
      return { ...state, phase: "active", startTime: action.timestamp, moveLog: [], startedBy: action.source };
    }

    case ActionType.STOP_SIGNAL: {
      if (state.config.mode !== "solve") return state;
      if (!state.config.stopMethod.includes(action.source)) return state;
      if (state.phase !== "active") return state;
      return { ...state, phase: "done", endTime: action.timestamp, endedBy: action.source };
    }

    case ActionType.CUBE_SOLVED: {
      if (state.config.mode !== "solve") return state;
      if (state.phase !== "active") return state;
      if (!state.config.stopMethod.includes("cube-solved")) return state;
      return { ...state, phase: "done", endTime: action.timestamp, endedBy: "cube-solved" };
    }

    case ActionType.INSPECTION_START: {
      if (state.phase !== "ready") return state;
      if (!state.config.useInspection) return state;
      return { ...state, phase: "inspecting", inspectionStartTime: action.timestamp };
    }

    // Solve mode only, during "setup" (scrambling): declares the scramble
    // done regardless of whether it matched the shown notation — for
    // scrambling by hand without following (or without even displaying) a
    // specific sequence. Freezes whatever moves were actually performed as
    // the new targetNotation/target, so record.scramble, "Use this
    // scramble" reuse, and useMethodProgress's CFOP/Roux startState all see
    // the real scramble that happened, not the abandoned suggestion.
    case ActionType.MANUAL_SETUP_DONE: {
      if (state.config.mode !== "solve") return state;
      if (state.phase !== "setup") return state;
      const performedNotation = state.moveLog.map((m) => m.move).join(" ");
      return {
        ...state,
        phase: "ready",
        targetNotation: performedNotation,
        target: buildSequenceTarget(performedNotation),
      };
    }

    case ActionType.RESET: {
      return { ...INITIAL_SESSION_STATE, config: state.config, phase: "idle" };
    }

    case ActionType.ERROR: {
      return { ...state, error: action.message };
    }

    default:
      return state;
  }
}

// ─── Private reducer helpers ───

function handleCubeMove(state: SessionState, move: string, timestamp: number): SessionState {
  const record: MoveRecord = {
    move,
    timestamp,
    relativeMs: state.startTime !== null ? timestamp - state.startTime : 0,
    phase: state.phase,
  };

  switch (state.phase) {
    case "setup":
      // Solve, empty/manual target (e.g. hand-scrambling with no notation to
      // follow, or a non-"scratch" starting stage): computeSequenceProgress
      // treats an empty target as trivially "completed", which would
      // auto-advance to "ready" after just the first move. Bypass matching
      // entirely here — just log moves and wait for the explicit
      // MANUAL_SETUP_DONE action instead.
      if (state.config.mode === "solve" && state.target && state.target.physicalMoves.length === 0) {
        return { ...state, moveLog: [...state.moveLog, record] };
      }
      // Solve: scrambling, tracked against the scramble target, advances to "ready" once matched.
      // Algorithm/attack: this first move starts the attempt AND is tracked from here on.
      return state.config.mode === "solve"
        ? handleTrackedMove(state, record, "ready")
        : handleFirstTrackedMove(state, record);

    case "ready":
    case "inspecting":
      // Only reachable in solve mode. A move only starts the attempt here if
      // cube-move is one of the enabled start methods — for spacebar/
      // timer-device-only configs, the move is ignored until a matching
      // START_SIGNAL arrives.
      return state.config.startMethod.includes("cube-move")
        ? handleFirstFreeSolveMove(state, record)
        : state;

    case "active":
      // Solve: free solving — no known target, just log the move (isSolved() detection is external).
      // Algorithm/attack: keep tracking against the target, advances to "done" once matched.
      return state.config.mode === "solve"
        ? { ...state, moveLog: [...state.moveLog, record] }
        : handleTrackedMove(state, record, "done");

    default:
      // idle / done — moves ignored.
      return state;
  }
}

/**
 * A move during a tracked phase (solve's setup=scrambling, or
 * algorithm/attack's active=executing) — delegates matching entirely to
 * sequenceTracker, advances phase once the target sequence is completed.
 */
function handleTrackedMove(state: SessionState, record: MoveRecord, phaseOnComplete: Phase): SessionState {
  const moveLog = [...state.moveLog, record];
  if (!state.target) return { ...state, moveLog };

  const progress = computeSequenceProgress(state.target, moveLog.map((m) => m.move));
  if (!progress.isCompleted) return { ...state, moveLog };

  return {
    ...state,
    moveLog,
    phase: phaseOnComplete,
    endTime: phaseOnComplete === "done" ? record.timestamp : state.endTime,
  };
}

/** Algorithm/attack "setup" phase: the first move starts the timer and is immediately tracked. */
function handleFirstTrackedMove(state: SessionState, record: MoveRecord): SessionState {
  const startedRecord: MoveRecord = { ...record, phase: "active", relativeMs: 0 };
  const started: SessionState = {
    ...state,
    phase: "active",
    startTime: record.timestamp,
    moveLog: [startedRecord],
  };
  if (!started.target) return started;

  const progress = computeSequenceProgress(started.target, [startedRecord.move]);
  return progress.isCompleted
    ? { ...started, phase: "done", endTime: record.timestamp }
    : started;
}

/** Solve "ready"/"inspecting" phase with "cube-move" enabled as a start method: the first move starts the (untracked) solve. */
function handleFirstFreeSolveMove(state: SessionState, record: MoveRecord): SessionState {
  const startedRecord: MoveRecord = { ...record, phase: "active", relativeMs: 0 };
  return { ...state, phase: "active", startTime: record.timestamp, moveLog: [startedRecord], startedBy: "cube-move" };
}

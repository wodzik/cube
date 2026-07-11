/**
 * Central types for the unified session state machine.
 * One reducer drives all three modes — Solve, Algorithm training, Attack.
 */

import type { SequenceTarget } from "../logic/sequenceTracker";

// ─── Mode ───

/** Which of the three app modes this session is running. */
export type Mode = "solve" | "algorithm" | "attack";

// ─── Phase ───

/**
 * idle        — no active attempt
 * setup       — solve: scrambling, tracked against the scramble target.
 *               algorithm/attack: target displayed on the cube, waiting for
 *               the first physical move (not tracked yet).
 * ready       — solve only: scramble completed, waiting for start signal.
 * inspecting  — solve only, optional: WCA inspection countdown.
 * active      — solve: free solving (no target, isSolved() polling).
 *               algorithm/attack: executing the target algorithm, tracked.
 * done        — attempt finished, timer stopped.
 */
export type Phase = "idle" | "setup" | "ready" | "inspecting" | "active" | "done";

// ─── Start/Stop methods (solve mode only — algorithm/attack always start on first move) ───

export type StartMethod = "cube-move" | "spacebar" | "timer-device";
export type StopMethod = "cube-solved" | "spacebar" | "timer-device";

/**
 * Per-session start/stop input choice — exclusive, not a set: whichever one
 * starts an attempt is also the one that stops it, so behavior stays
 * symmetric and predictable (start with spacebar -> stop with spacebar, not
 * by solving the cube). "cube" is the one exception, since a physical cube
 * has no discrete "stop" signal of its own — it pairs with cube-solved
 * auto-detection. See logic/inputMethod.ts's sessionMethodsForInput for the
 * mapping into the StartMethod[]/StopMethod[] arrays SessionConfig expects.
 */
export type InputMethod = "cube" | "spacebar" | "timer";

// ─── Session config ───

export interface SessionConfig {
  mode: Mode;
  /** Any of these can start an attempt — not exclusive. E.g. ["cube-move", "spacebar", "timer-device"] lets whichever the solver reaches for first trigger the timer. */
  startMethod: StartMethod[];
  /** Any of these can stop an attempt — not exclusive. */
  stopMethod: StopMethod[];
  useInspection: boolean;
  inspectionSeconds: number;
}

export const DEFAULT_CONFIG: SessionConfig = {
  mode: "solve",
  startMethod: ["cube-move"],
  stopMethod: ["cube-solved"],
  useInspection: false,
  inspectionSeconds: 15,
};

// ─── Move record ───

/**
 * Every physical move is logged with full timing context. This is the raw,
 * unreduced log — one entry per real quarter-turn from hardware. Display
 * reduction (R,R → R2) and counting happen downstream via
 * logic/moveReduction.ts's collapseIdenticalMoves, never here.
 */
export interface MoveRecord {
  /** Move notation, always a single physical face quarter-turn, e.g. "R", "U'". */
  move: string;
  /** Absolute timestamp — performance.now() at the moment of the move. */
  timestamp: number;
  /** Relative time from startTime in ms. 0 if startTime not yet set. */
  relativeMs: number;
  /** Session phase at the moment of the move. */
  phase: Phase;
}

// ─── Session state ───

/**
 * Full transient session state. Managed exclusively by sessionReducer.
 *
 * Deliberately does NOT store per-move tracking internals (accumulated
 * power, pending composite parts, wrong-move stack, orientation) — those are
 * all derived on demand from `target` + `moveLog` via
 * logic/sequenceTracker.ts's computeSequenceProgress, which is a pure,
 * stateless, cheap-to-recompute function (see sessionSelectors.ts).
 */
export interface SessionState {
  phase: Phase;
  config: SessionConfig;

  /** Scramble or algorithm notation currently being tracked/displayed. "" if none set. */
  targetNotation: string;
  /** Precomputed physical-move form of targetNotation. null until a target is set. */
  target: SequenceTarget | null;

  /** Full log of every move performed since the current phase group (setup or active) began. */
  moveLog: MoveRecord[];

  startTime: number | null;
  endTime: number | null;
  inspectionStartTime: number | null;

  /** Which of config.startMethod actually triggered THIS attempt — solve mode only, null otherwise/before start. */
  startedBy: StartMethod | null;
  /** Which of config.stopMethod actually ended THIS attempt — solve mode only, null otherwise/before stop. */
  endedBy: StopMethod | null;

  error: string | null;
}

export const INITIAL_SESSION_STATE: SessionState = {
  phase: "idle",
  config: DEFAULT_CONFIG,
  targetNotation: "",
  target: null,
  moveLog: [],
  startTime: null,
  endTime: null,
  inspectionStartTime: null,
  startedBy: null,
  endedBy: null,
  error: null,
};

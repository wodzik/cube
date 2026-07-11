/**
 * Data model for a completed speed solve — see plan.md §7.1.
 * Designed so CFOP and Roux progress are stored side by side, independently
 * (never one overwriting the other), and so display move-counting
 * (reducedMoves) is clearly separate from sequence-tracking reduction.
 */

import type { InputMethod, MoveRecord, StartMethod, StopMethod } from "./session";
import type { StageBoundary } from "../logic/stageDetection/types";

export type SolveMethod = "CFOP" | "Roux" | "LBL" | "unknown";

export interface SolveRecord {
  id: string;
  sessionId: string;

  // Context
  method: SolveMethod;
  startMethod: StartMethod;
  stopMethod: StopMethod;

  // Timing
  timerStartedAt: number;
  firstMoveAt: number | null;
  /** firstMoveAt - timerStartedAt — reaction/pick-up time. */
  timeToFirstMoveMs: number | null;
  endedAt: number;
  timeMs: number;

  // Scramble — starting state
  scramble: string;
  scrambleMoves: string[];

  // Moves
  /** Full raw log, one entry per physical quarter-turn, timestamped. */
  moves: MoveRecord[];
  /** Via collapseIdenticalMoves — for display + counting (R,R -> R2; R,R' stays separate). */
  reducedMoves: string[];
  moveCount: number;
  tps: number;

  // Method tracking — all three always present, independent (see logic/stageDetection).
  cfop: StageBoundary[];
  roux: StageBoundary[];
  lbl: StageBoundary[];

  isDNF: boolean;
}

/**
 * How much of the solve a session's attempts start from. "scratch" is a
 * normal full scramble; the rest are for practicing a specific end segment
 * (e.g. "f2l" = manually set up a solved F2L, then time OLL -> PLL) — see
 * ActionType.MANUAL_SETUP_DONE, the mechanism that lets a hand-set-up
 * partial state become the attempt's frozen "scramble".
 */
export type StartingStage = "scratch" | "cross" | "f2l" | "oll" | "pll";

/** User-created speed solve session — each carries its own input method, starting stage, solving method, and inspection rule. */
export interface StoredSession {
  id: string;
  name: string;
  /** "wca" = official 15s countdown; "custom" = countdown of customInspectionSeconds; "unlimited" = no countdown, inspect freely. */
  inspectionMode: "wca" | "custom" | "unlimited";
  /** Countdown length for inspectionMode "custom" — ignored by the other modes. */
  customInspectionSeconds: number;
  inputMethod: InputMethod;
  startingStage: StartingStage;
  /**
   * Which StageDetector drives the live progress bar and gets recorded as
   * record.method — chosen by the user here rather than auto-detected.
   * Real auto-detection (or a "detected X, but this session is set to Y —
   * switch?" suggestion) is future work; see
   * logic/stageDetection/methodResolvers.ts's doc comment for how it would
   * plug in without touching this field's meaning.
   */
  solveMethod: Exclude<SolveMethod, "unknown">;
}

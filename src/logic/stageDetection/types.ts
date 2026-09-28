import type { Frame, Method } from "@wodzik/cubecore/core";

/**
 * A method (CFOP, Roux, LBL) as the app shows it, on top of cubecore's
 * method engine (MethodTracker: the stages checked in all 24 orientations
 * at once, by stickers — any cross / block colour, any colour scheme):
 * which of cubecore's stages the app shows and under which ids (the ids
 * stored in SolveRecord.cfop / lbl / roux), and the details it stores.
 */
export interface StageDetector {
  method: string;
  /** The app's stage ids, in order. */
  stages: readonly string[];
  /** cubecore's method. */
  cubecore: Method;
  /** cubecore's stage id → the app's, or null for one the app doesn't show. */
  stageId(id: string): string | null;
  /**
   * The detail stored with a stage (the cross face, a slot's faces, which
   * half of OLL came first…) — from cubecore's own detail (physical already)
   * and the frame the solve settled in (canonical D = the cross / floor).
   */
  detail(stage: string, raw: string | undefined, frame: Frame | null, earlier: readonly StageBoundary[]): string | undefined;
}

/** A stage's completion point within a move sequence — boundaries only, no move duplication. */
export interface StageBoundary {
  stage: string;
  /** Index of the move that completed it (−1: done before the first move). */
  moveIndex: number;
  timestampMs: number;
  /** See StageDetector.detail. */
  detail?: string;
}

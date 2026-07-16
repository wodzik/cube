/**
 * Data model for the Case Trainer (plan-trainer.md §5) — targeted sub-state
 * drills (cross for now; xcross/pair/... arrive with later phases).
 *
 * The defining property of an attempt vs. a SolveRecord: the scramble was
 * GENERATED to have a known exact optimal solution length for the trained
 * target, so every attempt carries its own optimal count and the verdict
 * (overhead over optimal) is a stored fact, not a later re-computation.
 */

import type { MoveRecord } from "./session";
import type { Face } from "../logic/stageDetection/lastLayerShared";
import type { XCrossSlot, XXCrossPair } from "../logic/trainer/xcrossFrames";
import type { RouxSsSide } from "../logic/trainer/rouxTargets";

/** Which sub-state the trainer drills. CFOP family: cross…eocross; Roux family: fs (first square), fb (first block), fbdr (FB + DR edge), ss (second square), cmll (last-layer corners, case-based), eolr (EO + LR edges). */
export type TrainerType =
  | "cross"
  | "xcross"
  | "xxcross"
  | "pair"
  | "eocross"
  | "f2l"
  | "f2l-case"
  | "fb"
  | "fs"
  | "fbdr"
  | "ss"
  | "cmll"
  | "eolr";

export interface TrainerAttempt {
  id: string;
  /** Wall-clock end time (Date.now()) — for history display/ordering. */
  endedAt: number;

  // What was trained
  type: TrainerType;
  /** The face whose cross the scramble was generated for (and detection watched). */
  face: Face;
  /** Which F2L slot (xcross/pair), slot pair (xxcross), or SS side (roux ss) was targeted. */
  slot?: XCrossSlot | XXCrossPair | RouxSsSide;
  /** The requested difficulty — scrambles are generated with optimal == this. */
  targetLength: number;
  scramble: string;

  // What happened
  timeMs: number;
  /** Raw physical move log of the solving phase only. */
  moves: MoveRecord[];
  /** Via collapseIdenticalMoves — the honest "how many moves did I use" count. */
  moveCount: number;
  /** == targetLength (kept explicit so records stay meaningful if generation ever changes). */
  optimalLength: number;
  /** moveCount - optimalLength; 0 == solved optimally. */
  overhead: number;
  /** How many (collapsed) moves failed to reduce the exact cross distance — cross attempts only (needs the TS engine's distance table). */
  wastedMoveCount?: number;
  /** True if the on-demand hint was revealed during this attempt. */
  hintUsed?: boolean;

  // ── Retry pinning (see trainerScrambleService.regenerateForTarget) ──
  /** Engine-encoded cross state right after the scramble — cross attempts. */
  startCrossState?: number;
  /** Native-frame optimal solution of the target state — WASM-backed attempts. */
  nativeTargetSolution?: string;
  /** Pairing only: the goal's insert generator paired with nativeTargetSolution. */
  nativeTargetAppl?: string;
  /** Roux types: face-turn generator of the whole target state — the retry pin. */
  targetGenerator?: string;

  isDNF: boolean;
}

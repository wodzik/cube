/**
 * Fluency — what fraction of a solve was spent actually TURNING the cube
 * rather than pausing to recognize: 100 = never paused, executing the
 * whole solve back-to-back; 50 = half the solve was spent looking. Same
 * concept and naming as competing trainer apps' "Fluency" stat. Derived
 * from the same StageTiming[] the analysis modal tabulates, for the
 * method the solve was recorded under.
 */

import type { SolveRecord } from "../../types/solve";
import { detectorForMethod } from "./methodRegistry";
import { computeStageTimings, type StageTiming } from "./stageTiming";

/** Shared wording for the "Fluency" tooltip/help text — every UI spot showing this stat uses the same explanation. */
export const FLUENCY_TOOLTIP = "What proportion of your solve you have been turning instead of pausing";

export function fluencyPercent(timings: readonly StageTiming[], totalMs: number): number | null {
  if (totalMs <= 0) return null;
  const recognitionMs = timings.reduce((sum, t) => sum + t.recognitionMs, 0);
  // Rounds the execution share directly rather than rounding the pause
  // share and subtracting from 100 — that two-step route can be off by 1
  // from what this function alone would produce for the same solve.
  return Math.round(((totalMs - recognitionMs) / totalMs) * 100);
}

/** Null for solves with no usable stage data (unknown method, no boundaries). */
export function recordFluency(record: SolveRecord): number | null {
  if (record.method === "unknown") return null;
  const boundaries = record.method === "Roux" ? record.roux : record.method === "LBL" ? record.lbl : record.cfop;
  if (!boundaries || boundaries.length === 0) return null;
  const detector = detectorForMethod(record.method);
  return fluencyPercent(computeStageTimings(detector.stages, boundaries, record.moves), record.timeMs);
}

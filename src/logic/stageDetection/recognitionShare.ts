/**
 * Recognition share — what fraction of a solve was spent NOT turning: the
 * sum of every stage's recognition pause over the solve's total time, as a
 * whole percentage (50 = half the solve was looking, half turning). Derived
 * from the same StageTiming[] the analysis modal tabulates, for the
 * method the solve was recorded under.
 */

import type { SolveRecord } from "../../types/solve";
import { detectorForMethod } from "./methodRegistry";
import { computeStageTimings, type StageTiming } from "./stageTiming";

export function recognitionSharePercent(timings: readonly StageTiming[], totalMs: number): number | null {
  if (totalMs <= 0) return null;
  const recognitionMs = timings.reduce((sum, t) => sum + t.recognitionMs, 0);
  return Math.round((recognitionMs / totalMs) * 100);
}

/** Null for solves with no usable stage data (unknown method, no boundaries, zero time). */
export function recordRecognitionShare(record: SolveRecord): number | null {
  if (record.method === "unknown") return null;
  const boundaries = record.method === "Roux" ? record.roux : record.method === "LBL" ? record.lbl : record.cfop;
  if (!boundaries || boundaries.length === 0) return null;
  const detector = detectorForMethod(record.method);
  return recognitionSharePercent(computeStageTimings(detector.stages, boundaries, record.moves), record.timeMs);
}

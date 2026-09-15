/**
 * SolveSummary — the just-finished solve, condensed to one line of numbers
 * (TPS · turns · method) with the segmented per-stage SolveTimingBar under
 * it. Rendered directly beneath the big timer (TrainerPanel's `summary`
 * slot) while the last result is being held there, so the freshly
 * generated next scramble stays visible and the solver can roll straight
 * into it. The first move of the next scramble dismisses it (see
 * SolvePage's effect); the wrapping Tap in TrainerPanel opens the full
 * SolveAnalysis modal on click.
 */

import type { SolveRecord } from "../types/solve";
import { detectorForMethod } from "../logic/stageDetection/methodRegistry";
import { computeStageTimings } from "../logic/stageDetection/stageTiming";
import { recognitionSharePercent } from "../logic/stageDetection/recognitionShare";
import { SolveTimingBar } from "./SolveTimingBar";

interface SolveSummaryProps {
  record: SolveRecord;
  /** Hide time-derived stats (TPS, per-stage bar) and show move count only — see StoredSession.moveCountOnly. */
  moveCountOnly?: boolean;
}

export function SolveSummary({ record, moveCountOnly = false }: SolveSummaryProps) {
  const detector = detectorForMethod(record.method);
  const boundaries =
    record.method === "Roux" ? record.roux : record.method === "LBL" ? record.lbl : record.cfop;
  const timings = computeStageTimings(detector.stages, boundaries ?? [], record.moves);
  const recognitionShare = moveCountOnly ? null : recognitionSharePercent(timings, record.timeMs);

  const parts = moveCountOnly
    ? [`${record.moveCount} turns`, record.method]
    : [
        `${record.tps.toFixed(2)} TPS`,
        `${record.moveCount} turns`,
        recognitionShare === null ? null : `${recognitionShare}% recognition`,
        record.method,
      ].filter((p): p is string => p !== null);

  return (
    <div className="w-full max-w-2xl flex flex-col items-center gap-4">
      <p className="text-sm font-mono tabular-nums text-gray-400 tracking-wide">
        {parts.map((p, i) => (
          <span key={p}>
            {i > 0 && <span className="text-gray-700 mx-2.5">|</span>}
            {p}
          </span>
        ))}
      </p>
      {!moveCountOnly && (
        <div className="w-full">
          <SolveTimingBar timings={timings} />
        </div>
      )}
    </div>
  );
}

/**
 * SolveSummary — compact inline stats for the solve that JUST finished,
 * shown in the stats column (between the cube and the session chart)
 * instead of a screen-covering modal, so the freshly generated next
 * scramble stays visible and the solver can roll straight into it. The
 * first move of the next scramble dismisses it (see SolvePage's effect);
 * the full SolveAnalysis modal stays available via the button here and via
 * clicking any solve in the history list.
 */

import { Maximize2 } from "lucide-react";
import type { SolveRecord } from "../types/solve";
import { detectorForMethod } from "../logic/stageDetection/methodRegistry";
import { computeStageTimings } from "../logic/stageDetection/stageTiming";
import { formatTimeMs } from "../logic/statistics";
import { stageDescription } from "./stageDescriptions";

interface SolveSummaryProps {
  record: SolveRecord;
  /** Open the full SolveAnalysis modal (3D playback, method toggle, per-stage jumps). */
  onOpenAnalysis: () => void;
}

function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}`;
}

export function SolveSummary({ record, onOpenAnalysis }: SolveSummaryProps) {
  const detector = detectorForMethod(record.method);
  const boundaries =
    record.method === "Roux" ? record.roux : record.method === "LBL" ? record.lbl : record.cfop;
  const timings = computeStageTimings(detector.stages, boundaries ?? [], record.moves);

  return (
    <div className="panel p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Last solve</p>
          <p className="text-4xl font-mono tabular-nums font-bold text-white mt-1">{formatTimeMs(record.timeMs)}</p>
          <p className="text-sm text-gray-400 mt-1">
            {record.moveCount} moves · {record.tps.toFixed(2)} TPS · {record.method}
          </p>
        </div>
        <button
          onClick={onOpenAnalysis}
          className="shrink-0 p-1.5 text-gray-500 hover:text-gray-200 hover:bg-white/5 rounded-lg transition-colors"
          title="Open full analysis (3D playback, method comparison)"
        >
          <Maximize2 size={15} />
        </button>
      </div>

      {/* flex-1 + h-full on the table lets the rows spread out over the
          whole panel height (which itself stretches to the chart column's
          height) instead of bunching at the top. */}
      <div className="flex-1 min-h-0">
        <table className="w-full h-full text-sm font-mono tabular-nums">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-gray-500">
              <th className="text-left font-semibold pb-1">Stage</th>
              <th className="text-right font-semibold pb-1">Moves</th>
              <th className="text-right font-semibold pb-1">Recog</th>
              <th className="text-right font-semibold pb-1">Exec</th>
              <th className="text-right font-semibold pb-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {timings.map((t) => {
              const skipped = t.moveCount === 0;
              return (
                <tr key={t.stage} className={`border-t border-white/[0.04] ${skipped ? "text-gray-600" : "text-gray-300"}`}>
                  <td className="py-1.5 text-left font-sans font-medium">{stageDescription(t.stage)}</td>
                  {skipped ? (
                    <td colSpan={4} className="py-1.5 text-right text-[10px] uppercase tracking-wider text-amber-400/60">
                      skip
                    </td>
                  ) : (
                    <>
                      <td className="py-1.5 text-right">{t.moveCount}</td>
                      <td className="py-1.5 text-right">{formatMs(t.recognitionMs)}</td>
                      <td className="py-1.5 text-right">{formatMs(t.executionMs)}</td>
                      <td className="py-1.5 text-right text-white">{formatMs(t.totalMs)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

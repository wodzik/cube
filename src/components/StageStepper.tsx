/**
 * Wide, labelled real-time stage stepper — shown under the scramble bar
 * during an active solve (see SolvePage.tsx's sequenceBottom). Styled after
 * the old cube_trainer app's SolveProgress: circular markers connected by a
 * line, checkmark once done, pulsing highlight on the current stage —
 * versus the small unlabelled dots StageProgress.tsx uses for the compact
 * post-solve summary in SolveAnalysis (kept as-is, different context/space
 * budget). This component has the room to show each stage's full name
 * (cross, f2l-1, oll, pll, ...) rather than a single-letter abbreviation.
 */

import { Check } from "lucide-react";
import type { StageBoundary } from "../logic/stageDetection/methodTracker";

interface StageStepperProps {
  stages: readonly string[];
  boundaries: readonly StageBoundary[];
}

const STAGE_LABELS: Record<string, string> = {
  cross: "Cross",
  "f2l-1": "F2L-1",
  "f2l-2": "F2L-2",
  "f2l-3": "F2L-3",
  "f2l-4": "F2L-4",
  "first-layer-1": "FL-1",
  "first-layer-2": "FL-2",
  "first-layer-3": "FL-3",
  "first-layer-4": "FL-4",
  "second-layer-1": "SL-1",
  "second-layer-2": "SL-2",
  "second-layer-3": "SL-3",
  "second-layer-4": "SL-4",
  "oll-partial": "OLL-P",
  oll: "OLL",
  "pll-corners": "PLL-C",
  pll: "PLL",
  auf: "AUF",
  fb: "FB",
  sb: "SB",
  cmll: "CMLL",
  lse: "LSE",
};

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.toUpperCase();
}

export function StageStepper({ stages, boundaries }: StageStepperProps) {
  const completed = new Set(boundaries.map((b) => b.stage));
  const nextIdx = stages.findIndex((s) => !completed.has(s));

  return (
    <div className="flex items-start w-full overflow-x-auto pb-1">
      {stages.map((stage, i) => {
        const isDone = completed.has(stage);
        const isCurrent = i === nextIdx;
        return (
          <div key={stage} className="flex items-start flex-1 min-w-14 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold border transition-all ${
                  isDone
                    ? "bg-emerald-500 border-emerald-400 text-white"
                    : isCurrent
                      ? "bg-amber-500 border-amber-400 text-black animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                      : "bg-gray-800/80 border-gray-700 text-gray-500"
                }`}
              >
                {isDone ? <Check size={14} /> : stageLabel(stage).slice(0, 1)}
              </div>
              <span
                className={`text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap ${
                  isDone ? "text-emerald-400" : isCurrent ? "text-amber-400" : "text-gray-600"
                }`}
              >
                {stageLabel(stage)}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div className={`flex-1 h-0.5 mt-4 mx-1 rounded transition-colors ${isDone ? "bg-emerald-500" : "bg-gray-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

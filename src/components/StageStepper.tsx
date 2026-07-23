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
  "oll-first": "OLL-1",
  "oll-second": "OLL-2",
  "pll-corners": "PLL-C",
  "pll-edges": "PLL-E",
  oll: "OLL",
  pll: "PLL",
  auf: "AUF",
  fb: "FB",
  sb: "SB",
  cmll: "CMLL",
  lse: "LSE",
};

/**
 * LBL's oll-first/oll-second have a fixed id but a per-solve-varying
 * identity (2-look OLL is taught either order — see lblStages.ts) — once
 * the stage actually completes, its boundary carries a `detail` ("corners"
 * or "edges") saying which one it turned out to be; show THAT instead of
 * the generic "OLL-1"/"OLL-2" placeholder. Not yet reached (no boundary,
 * detail undefined) still shows the placeholder — there's nothing to
 * report yet.
 */
function stageLabel(stage: string, detail?: string): string {
  if (stage === "oll-first" || stage === "oll-second") {
    if (detail === "corners") return "Corners";
    if (detail === "edges") return "Edges";
  }
  return STAGE_LABELS[stage] ?? stage.toUpperCase();
}

export function StageStepper({ stages, boundaries }: StageStepperProps) {
  const boundaryByStage = new Map(boundaries.map((b) => [b.stage, b]));
  const nextIdx = stages.findIndex((s) => !boundaryByStage.has(s));

  return (
    <div className="flex items-start w-full overflow-x-auto pb-1">
      {stages.map((stage, i) => {
        const boundary = boundaryByStage.get(stage);
        const isDone = boundary !== undefined;
        const isCurrent = i === nextIdx;
        const label = stageLabel(stage, boundary?.detail);
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
                {isDone ? <Check size={14} /> : label.slice(0, 1)}
              </div>
              <span
                className={`text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap ${
                  isDone ? "text-emerald-400" : isCurrent ? "text-amber-400" : "text-gray-600"
                }`}
              >
                {label}
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

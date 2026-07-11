/**
 * Live stage progress bar — generalized over any method (CFOP, Roux, ...).
 * Same component renders both, side by side, since both are tracked in
 * parallel (see useMethodProgress / logic/stageDetection).
 */

import type { StageBoundary } from "../logic/stageDetection/methodTracker";

interface StageProgressProps {
  label: string;
  stages: readonly string[];
  boundaries: readonly StageBoundary[];
}

export function StageProgress({ label, stages, boundaries }: StageProgressProps) {
  const completed = new Set(boundaries.map((b) => b.stage));
  const nextIdx = stages.findIndex((s) => !completed.has(s));

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest w-10 shrink-0">{label}</span>
      <div className="flex gap-1.5">
        {stages.map((stage, i) => (
          <span
            key={stage}
            title={stage}
            className={`w-2 h-2 rounded-full transition-all ${
              completed.has(stage)
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                : i === nextIdx
                  ? "bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                  : "bg-gray-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

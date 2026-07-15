/**
 * TrainerSummary — inline verdict for the trainer attempt that JUST
 * finished, shown in the stats column (same slot/pattern as SolveSummary):
 * your move count vs the scramble's known optimal, a per-move wasted-move
 * strip from the exact-distance analysis, and the optimal solutions on
 * demand. Dismissed by the first move of the next scramble (see
 * CaseTrainerPage's effect).
 */

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Repeat2 } from "lucide-react";
import type { TrainerAttempt } from "../types/trainer";
import type { CrossMoveAnalysis } from "../logic/trainer/crossEngine";
import { formatTimeMs } from "../logic/statistics";

interface TrainerSummaryProps {
  attempt: TrainerAttempt;
  /** Per-collapsed-move distance verdicts — empty while still computing. */
  analysis: CrossMoveAnalysis[];
  optimalSolutions: string[];
  /** Re-drill this exact case — omitted when the record lacks retry data. */
  onRetry?: () => void;
}

export function TrainerSummary({ attempt, analysis, optimalSolutions, onRetry }: TrainerSummaryProps) {
  const [showSolutions, setShowSolutions] = useState(false);
  const isOptimal = attempt.overhead <= 0;

  // Non-optimal solve with a full solution list (cross — signalled by a
  // non-empty analysis; WASM types only carry one example solution and no
  // analysis): the optimal that shares the longest prefix with what the
  // user actually did — "here's where your line and the best line diverged".
  const closest = useMemo(() => {
    if (isOptimal || analysis.length === 0 || optimalSolutions.length === 0) return null;
    const userMoves = analysis.map((a) => a.move);
    let best: { solution: string; sharedMoves: number } | null = null;
    for (const solution of optimalSolutions) {
      const tokens = solution.split(" ");
      let shared = 0;
      while (shared < tokens.length && shared < userMoves.length && tokens[shared] === userMoves[shared]) shared++;
      if (!best || shared > best.sharedMoves) best = { solution, sharedMoves: shared };
    }
    return best;
  }, [isOptimal, analysis, optimalSolutions]);

  return (
    <div className="panel p-5 h-full flex flex-col gap-3">
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Last attempt</p>
        <p className="text-4xl font-mono tabular-nums font-bold text-white mt-1">{formatTimeMs(attempt.timeMs)}</p>
        <p className="text-sm text-gray-400 mt-1">
          {attempt.moveCount} moves · optimal {attempt.optimalLength}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div
          className={`px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide ${
            isOptimal ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
          }`}
        >
          {isOptimal ? "Optimal!" : `+${attempt.overhead} ${attempt.overhead === 1 ? "move" : "moves"} over optimal`}
        </div>
        {attempt.hintUsed && (
          <div className="px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide bg-sky-500/15 text-sky-300">hint used</div>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
            title="Practice this exact case again (fresh scramble, same target state)"
          >
            <Repeat2 size={12} /> Retry case
          </button>
        )}
      </div>

      {analysis.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Your solution</p>
          <div className="flex flex-wrap gap-1">
            {analysis.map((a, i) => (
              <span
                key={i}
                title={
                  a.wasted
                    ? `Didn't bring the cross closer (distance ${a.distBefore} → ${a.distAfter})`
                    : `Distance ${a.distBefore} → ${a.distAfter}`
                }
                className={`px-1.5 py-0.5 rounded-md text-xs font-mono ${
                  a.wasted ? "bg-red-500/15 text-red-300 line-through decoration-red-400/60" : "bg-white/[0.05] text-gray-300"
                }`}
              >
                {a.move}
              </span>
            ))}
          </div>
          {(attempt.wastedMoveCount ?? 0) > 0 && (
            <p className="text-[11px] text-gray-500 mt-1.5">
              {attempt.wastedMoveCount} {attempt.wastedMoveCount === 1 ? "move" : "moves"} didn't reduce the cross
              distance
            </p>
          )}
        </div>
      )}

      {closest && (
        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
            Closest optimal{closest.sharedMoves > 0 ? ` — diverged after ${closest.sharedMoves} ${closest.sharedMoves === 1 ? "move" : "moves"}` : ""}
          </p>
          <div className="flex flex-wrap gap-1">
            {closest.solution.split(" ").map((move, i) => (
              <span
                key={i}
                className={`px-1.5 py-0.5 rounded-md text-xs font-mono ${
                  i < closest.sharedMoves
                    ? "bg-white/[0.05] text-gray-400"
                    : "bg-emerald-500/15 text-emerald-300 font-bold"
                }`}
              >
                {move}
              </span>
            ))}
          </div>
        </div>
      )}

      {optimalSolutions.length > 0 && (
        <div className="mt-auto">
          <button
            onClick={() => setShowSolutions((v) => !v)}
            className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
          >
            {showSolutions ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Optimal solutions ({optimalSolutions.length})
          </button>
          {showSolutions && (
            <ul className="mt-1.5 space-y-1 max-h-40 overflow-y-auto pr-1">
              {optimalSolutions.map((sol) => (
                <li key={sol} className="text-xs font-mono text-gray-300 bg-white/[0.03] rounded-md px-2 py-1">
                  {sol}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

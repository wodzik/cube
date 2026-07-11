/**
 * SolveAnalysis — modal breakdown of a single completed solve.
 *
 * Shown automatically right after a solve finishes, and reused when clicking
 * any past solve in SolvePage's history list — same component either way,
 * since both cases boil down to "here's a SolveRecord, render it".
 *
 * Content: move count / TPS / time, ONE method's stage progress (dots, reused
 * from the live view) plus a per-stage breakdown (move count, moves,
 * recognition vs execution vs total time — see logic/stageDetection/
 * stageTiming.ts), and a scrubbable 3D playback of the solve (scramble ->
 * solved) via TwistyPlayer's built-in control panel. Clicking a stage row
 * jumps the player's timeline to that stage's first move (ported from the
 * old app's CubeVisualisation.setMoveIndex).
 *
 * IMPORTANT: the player's `alg` is built from the RAW move list
 * (record.moves), not record.reducedMoves. StageBoundary.moveIndex (and
 * therefore StageTiming.startMoveIndex/endMoveIndex) is an index into the
 * raw, one-quarter-turn-per-entry stream that stage detection actually
 * walked — reducedMoves collapses runs (R,R -> R2) purely for display/
 * counting, which shortens and shifts indices. Feeding the player anything
 * other than the raw stream makes every stage-jump land on the wrong move
 * as soon as the solve contains any double/triple turn before that point.
 *
 * CFOP, Roux, and LBL boundaries are always present on the record (tracked
 * in parallel, see logic/stageDetection) — only one is DISPLAYED at a time,
 * defaulting to record.method (the session's configured solving method —
 * see StoredSession.solveMethod, chosen by the user, not auto-detected),
 * with a manual toggle to compare against the other two regardless.
 */

import { useEffect, useRef, useState } from "react";
import { X, Play, RotateCcw, Trash2 } from "lucide-react";
import type { SolveMethod, SolveRecord } from "../types/solve";
import type { StageBoundary } from "../logic/stageDetection/types";
import { CubeVisualisation, type CubeVisualisationRef } from "./CubeVisualisation";
import { StageProgress } from "./StageProgress";
import { METHOD_DETECTORS } from "../logic/stageDetection/methodRegistry";
import { lblStageDetector } from "../logic/stageDetection/lblStages";
import { computeStageBoundaries } from "../logic/stageDetection/methodTracker";
import { applyMoveToState, createSolvedState } from "../logic/stageDetection/liveCubeState";
import { computeStageTimings, type StageTiming } from "../logic/stageDetection/stageTiming";
import { formatTimeMs } from "../logic/statistics";
import { patchSolve } from "../services/solveStore";

interface SolveAnalysisProps {
  record: SolveRecord;
  onClose: () => void;
  /** Re-scramble to this exact solve's scramble and attempt it again — omit to hide the button. */
  onUseScramble?: (scramble: string) => void;
  /** Sessions this solve can be moved to (the caller excludes the one it's already in) — omit/empty to hide the move control. */
  moveTargets?: { id: string; name: string }[];
  onMoveToSession?: (sessionId: string) => void;
  /** "Create a brand-new session and move this solve into it" — appended as the last option of the move select. */
  onMoveToNewSession?: () => void;
  /** Delete this solve permanently (double-click confirmed here) — omit to hide the button. */
  onDelete?: () => void;
}

type DisplayMethod = Exclude<SolveMethod, "unknown">;
const METHODS: DisplayMethod[] = ["CFOP", "LBL", "Roux"];
// Return type is `| undefined` deliberately: solves recorded by a build
// older than a method's tracking lack that field in localStorage, whatever
// the (present-tense) SolveRecord type claims — currently only `lbl`, which
// shipped later than cfop/roux. See the healing effect in the component.
const BOUNDARIES_BY_METHOD: Record<DisplayMethod, (record: SolveRecord) => StageBoundary[] | undefined> = {
  CFOP: (record) => record.cfop,
  Roux: (record) => record.roux,
  LBL: (record) => record.lbl,
};

function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function StageTimingRow({ timing, onJump }: { timing: StageTiming; onJump: (moveIndex: number) => void }) {
  const reached = timing.startMoveIndex !== null;
  // A stage with 0 moves either completed as a side effect of the previous
  // stage's last move (cascade — one turn satisfied two stages at once) or
  // was already done before the solve even started (e.g. cross pre-solved
  // by the scramble). Either way there's no dedicated execution to jump to.
  const skipped = timing.moveCount === 0;

  return (
    <div
      className={`group flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors ${
        reached ? "hover:bg-white/[0.05] cursor-pointer" : "opacity-60"
      }`}
      onClick={reached ? () => onJump(timing.startMoveIndex!) : undefined}
      title={reached ? "Jump the player to this stage" : undefined}
    >
      {reached && (
        <Play size={11} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--accent-bright)" }} fill="currentColor" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-gray-100">{timing.stage}</span>
          {skipped ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">Skip</span>
          ) : (
            <span className="text-[11px] text-gray-400 font-mono tabular-nums">{timing.moveCount} moves</span>
          )}
        </div>
        {timing.moves.length > 0 && <p className="text-[11px] text-gray-400 font-mono truncate mt-0.5">{timing.moves.join(" ")}</p>}
      </div>
      {!skipped && (
        <div className="shrink-0 flex items-center gap-2.5 text-[11px] font-mono tabular-nums text-right">
          <span className="text-gray-400" title="Recognition time">
            recog {formatMs(timing.recognitionMs)}
          </span>
          <span className="text-gray-400" title="Execution time">
            exec {formatMs(timing.executionMs)}
          </span>
          <span className="text-gray-100 font-semibold w-14" title="Total time for this stage">
            {formatMs(timing.totalMs)}
          </span>
        </div>
      )}
    </div>
  );
}

export function SolveAnalysis({ record, onClose, onUseScramble, moveTargets, onMoveToSession, onMoveToNewSession, onDelete }: SolveAnalysisProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Display text: collapsed, compact (R2 instead of R R).
  const displayAlg = record.reducedMoves.join(" ");
  // Player alg: raw, one entry per quarter turn — keeps indices aligned with
  // stage boundaries (see file header comment).
  const playerAlg = record.moves.map((m) => m.move).join(" ");
  const [method, setMethod] = useState<DisplayMethod>(record.method !== "unknown" ? record.method : "CFOP");
  const cubeRef = useRef<CubeVisualisationRef>(null);

  // Self-heal solves recorded before LBL tracking existed: their stored
  // record has no `lbl` field at all (which used to white-screen this modal
  // — undefined.map in computeStageTimings). The full move log + scramble
  // are on the record, so the missing boundaries are recomputed exactly,
  // shown, and written back to storage so it's a one-time cost per record.
  const [healedLbl, setHealedLbl] = useState<StageBoundary[] | null>(null);
  useEffect(() => {
    setHealedLbl(null);
    if (record.lbl !== undefined) return;
    let cancelled = false;
    createSolvedState().then((solved) => {
      if (cancelled) return;
      const startState = record.scramble
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .reduce((s, m) => applyMoveToState(s, m), solved);
      const timedMoves = record.moves.map((m) => ({ move: m.move, relativeMs: m.relativeMs }));
      const lbl = computeStageBoundaries(lblStageDetector, timedMoves, startState);
      setHealedLbl(lbl);
      patchSolve(record.id, { lbl });
    });
    return () => {
      cancelled = true;
    };
  }, [record]);

  const detector = METHOD_DETECTORS[method];
  const boundaries = BOUNDARIES_BY_METHOD[method](record) ?? healedLbl ?? [];
  const timings = computeStageTimings(detector.stages, boundaries, record.moves);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-white font-semibold text-base font-mono tabular-nums">{formatTimeMs(record.timeMs)}</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              {record.moveCount} moves · {record.tps.toFixed(2)} TPS
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 overflow-y-auto flex-col sm:flex-row">
          <div className="flex flex-col items-center gap-3 p-6 sm:border-r border-white/[0.06] sm:w-[26rem] shrink-0">
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-gray-950/50">
              <CubeVisualisation
                ref={cubeRef}
                setupAlg={record.scramble}
                alg={playerAlg}
                visualization="PG3D"
                controlPanel="bottom-row"
                className="size-full"
              />
            </div>
            <p className="text-[11px] text-gray-400 text-center leading-relaxed font-mono break-all">{record.scramble}</p>
            {onUseScramble && (
              <button
                onClick={() => onUseScramble(record.scramble)}
                className="btn-secondary py-1.5 text-[11px] w-full"
                title="Re-scramble to this exact scramble and attempt it again"
              >
                <RotateCcw size={12} /> Use this scramble
              </button>
            )}
          </div>

          <div className="flex-1 p-5 space-y-5 min-w-0">
            <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5 w-fit">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    method === m ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <StageProgress label={method} stages={detector.stages} boundaries={boundaries} />

            <div>
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 px-2.5">{method} steps</h3>
              <div className="flex flex-col gap-0.5">
                {timings.map((t) => (
                  <StageTimingRow key={t.stage} timing={t} onJump={(idx) => cubeRef.current?.setMoveIndex(idx)} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Solve moves</h3>
              <p className="text-xs text-gray-300 font-mono break-all leading-relaxed">{displayAlg || "—"}</p>
            </div>
          </div>
        </div>

        {(onDelete || (onMoveToSession && ((moveTargets?.length ?? 0) > 0 || onMoveToNewSession))) && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-white/[0.06]">
            {onMoveToSession && ((moveTargets?.length ?? 0) > 0 || onMoveToNewSession) ? (
              <select
                value=""
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "__new__") onMoveToNewSession?.();
                  else if (value) onMoveToSession(value);
                }}
                className="bg-gray-950/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-[var(--accent)] transition-colors"
              >
                <option value="" disabled>
                  Move to session…
                </option>
                {(moveTargets ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                {onMoveToNewSession && <option value="__new__">+ New session…</option>}
              </select>
            ) : (
              <span />
            )}
            {onDelete && (
              <button
                onClick={() => {
                  if (confirmDelete) onDelete();
                  else setConfirmDelete(true);
                }}
                className="btn-danger"
              >
                <Trash2 size={13} /> {confirmDelete ? "Click again to delete" : "Delete solve"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

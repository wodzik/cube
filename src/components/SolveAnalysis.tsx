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
import { X, Play, RotateCcw, Trash2, Link2, Check } from "lucide-react";
import type { SolveMethod, SolveRecord } from "../types/solve";
import type { StageBoundary } from "../logic/stageDetection/types";
import { CubeVisualisation, type CubeVisualisationRef } from "./CubeVisualisation";
import { StageProgress } from "./StageProgress";
import { SolveTimingBar } from "./SolveTimingBar";
import { METHOD_DETECTORS } from "../logic/stageDetection/methodRegistry";
import { lblStageDetector } from "../logic/stageDetection/lblStages";
import { cfopStageDetector, rouxStageDetector, computeStageBoundaries } from "../logic/stageDetection/methodTracker";
import { ROUX_DETAIL_VERSION } from "../logic/stageDetection/rouxStages";
import { fluencyPercent, FLUENCY_TOOLTIP } from "../logic/stageDetection/fluency";
import { applyMoveToState, createSolvedState } from "../logic/stageDetection/liveCubeState";
import { computeStageTimings, type StageTiming } from "../logic/stageDetection/stageTiming";
import { formatTimeMs } from "../logic/statistics";
import { patchSolve } from "../services/solveStore";
import { buildShareUrl, shareBlocker } from "../logic/shareLink";
import { copyText } from "../logic/clipboard";
import { stageDescription } from "./stageDescriptions";

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
  /** Hide time (header, TPS, per-stage recog/exec/total) and show move count instead — see StoredSession.moveCountOnly. */
  moveCountOnly?: boolean;
  /** A solve opened from a share link: nothing is written to storage and there is no share button. */
  readOnly?: boolean;
  /** Small label next to the result, e.g. "Shared solve". */
  notice?: string;
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

function StageTimingRow({
  timing,
  onJump,
  moveCountOnly = false,
}: {
  timing: StageTiming;
  onJump: (moveIndex: number) => void;
  moveCountOnly?: boolean;
}) {
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
          <span className="text-sm font-semibold text-gray-100">{stageDescription(timing.stage, timing.detail)}</span>
          {skipped ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">Skip</span>
          ) : (
            <span className="text-[11px] text-gray-400 font-mono tabular-nums">{timing.moveCount} moves</span>
          )}
        </div>
        {timing.moves.length > 0 && <p className="text-[11px] text-gray-400 font-mono truncate mt-0.5">{timing.moves.join(" ")}</p>}
      </div>
      {!skipped && !moveCountOnly && (
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

export function SolveAnalysis({
  record,
  onClose,
  onUseScramble,
  moveTargets,
  onMoveToSession,
  onMoveToNewSession,
  onDelete,
  moveCountOnly = false,
  readOnly = false,
  notice,
}: SolveAnalysisProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  // Shown when the clipboard is unavailable, so the link can still be copied by hand.
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const shareUnavailable = shareBlocker(record) !== null;

  async function handleShare() {
    const url = buildShareUrl(record, { moveCountOnly });
    if (!url) return;
    if (await copyText(url)) {
      setManualUrl(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setManualUrl(url);
    }
  }
  // Display text: collapsed, compact (R2 instead of R R).
  const displayAlg = record.reducedMoves.join(" ");
  // Player alg: raw, one entry per quarter turn — keeps indices aligned with
  // stage boundaries (see file header comment).
  const playerAlg = record.moves.map((m) => m.move).join(" ");
  const [method, setMethod] = useState<DisplayMethod>(record.method !== "unknown" ? record.method : "CFOP");
  const cubeRef = useRef<CubeVisualisationRef>(null);

  // Self-heal solves recorded by older builds: no `lbl` field at all (which
  // used to white-screen this modal — undefined.map in computeStageTimings),
  // or CFOP/LBL boundaries without the face/slot details the timing bar
  // colors by (see cubeColors.ts). Roux's own stageDetail encoding is
  // versioned separately (ROUX_DETAIL_VERSION) rather than presence-checked
  // like cfop/lbl: it has already changed shape twice (detail added, then
  // sb/cmll's exact letters redefined) since the `roux` field itself
  // shipped, and each time, a record already healed under the OLDER shape
  // has real-looking detail strings that a bare "is detail present" check
  // can't tell apart from current data — it would stay stuck on the stale
  // colors forever instead of healing on next open. The full move log +
  // scramble are on the record, so the boundaries are recomputed exactly,
  // shown, and written back to storage (re-stamped with the current
  // version) — a one-time cost per record each time this needs re-running.
  const [healed, setHealed] = useState<{ cfop: StageBoundary[]; lbl: StageBoundary[]; roux: StageBoundary[] } | null>(null);
  useEffect(() => {
    setHealed(null);
    const lacksDetail = (bs: StageBoundary[] | undefined, stage: string) => {
      const b = bs?.find((x) => x.stage === stage);
      return b !== undefined && b.detail === undefined;
    };
    if (
      record.lbl !== undefined &&
      !lacksDetail(record.cfop, "cross") &&
      !lacksDetail(record.lbl, "cross") &&
      record.rouxDetailVersion === ROUX_DETAIL_VERSION
    )
      return;
    let cancelled = false;
    createSolvedState().then((solved) => {
      if (cancelled) return;
      const startState = record.scramble
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .reduce((s, m) => applyMoveToState(s, m), solved);
      const timedMoves = record.moves.map((m) => ({ move: m.move, relativeMs: m.relativeMs }));
      const cfop = computeStageBoundaries(cfopStageDetector, timedMoves, startState);
      const lbl = computeStageBoundaries(lblStageDetector, timedMoves, startState);
      const roux = computeStageBoundaries(rouxStageDetector, timedMoves, startState);
      setHealed({ cfop, lbl, roux });
      if (!readOnly) patchSolve(record.id, { cfop, lbl, roux, rouxDetailVersion: ROUX_DETAIL_VERSION });
    });
    return () => {
      cancelled = true;
    };
  }, [record, readOnly]);

  const detector = METHOD_DETECTORS[method];
  const HEALED_KEY: Record<DisplayMethod, keyof NonNullable<typeof healed>> = { CFOP: "cfop", LBL: "lbl", Roux: "roux" };
  const boundaries = healed?.[HEALED_KEY[method]] ?? BOUNDARIES_BY_METHOD[method](record) ?? [];
  const timings = computeStageTimings(detector.stages, boundaries, record.moves);
  // For the method currently shown (its stage split defines the pauses).
  const fluency = fluencyPercent(timings, record.timeMs);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // z-[80]: above OverlayModal (z-[70]) — this opens FROM the recent-solves
  // popup, so it must stack on top of it.
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-white font-semibold text-base font-mono tabular-nums">
              {moveCountOnly ? `${record.moveCount} moves` : formatTimeMs(record.timeMs)}
            </h2>
            <p className="text-gray-400 text-xs mt-0.5">
              {moveCountOnly ? (
                record.method
              ) : (
                <>
                  {record.moveCount} moves · {record.tps.toFixed(2)} TPS
                  {fluency !== null && (
                    <>
                      {" · "}
                      <span title={FLUENCY_TOOLTIP}>
                        {fluency}% fluency
                      </span>
                    </>
                  )}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {notice && <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 bg-sky-500/10 rounded-md px-2 py-1">{notice}</span>}
            {!readOnly && (
              <button
                onClick={handleShare}
                disabled={shareUnavailable}
                className="btn-secondary text-xs"
                title={shareUnavailable ? "This solve can't be shared (it contains moves a link can't hold)" : "Copy a link that opens this solve in a preview"}
              >
                {copied ? <Check size={13} /> : <Link2 size={13} />} {copied ? "Link copied" : "Share"}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>
        {manualUrl && (
          <div className="px-5 py-2 border-b border-white/[0.06] flex items-center gap-2">
            <span className="text-[11px] text-gray-500 shrink-0">Copy this link:</span>
            <input
              readOnly
              value={manualUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 bg-gray-950/60 border border-white/10 rounded-lg px-2 py-1 text-[11px] font-mono text-gray-300"
            />
          </div>
        )}

        <div className="flex flex-1 overflow-y-auto flex-col sm:flex-row">
          <div className="flex flex-col items-center gap-3 p-6 sm:border-r border-white/[0.06] sm:w-[26rem] shrink-0">
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-gray-950/50">
              <CubeVisualisation
                ref={cubeRef}
                setupAlg={record.scramble}
                alg={playerAlg}
                visualization="3D"
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

            {!moveCountOnly && <SolveTimingBar timings={timings} />}

            <div>
              <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 px-2.5">{method} steps</h3>
              <div className="flex flex-col gap-0.5">
                {timings.map((t) => (
                  <StageTimingRow
                    key={t.stage}
                    timing={t}
                    onJump={(idx) => cubeRef.current?.setMoveIndex(idx)}
                    moveCountOnly={moveCountOnly}
                  />
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

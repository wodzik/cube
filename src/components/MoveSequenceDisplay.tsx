/**
 * MoveSequenceDisplay — the scramble / algorithm bar: cubecore's
 * <cube-scramble> (scrambles) or <cube-alg-practice> (algorithms) inside
 * act's card (loading overlay, eye / refresh / extra controls, complete
 * text, too-far-off reset).
 *
 * The element runs cubecore's SequenceTracker — the same engine the session
 * reducer uses (logic/cubecoreSequence.ts) — fed from the session: the
 * target, the cube's state when it was set, and the moves so far
 * (`tracking`, see selectTracking). While nothing is tracked it keeps
 * showing where it got to.
 *
 * Colouring (act's palette via --cc-seq-* variables): done = green,
 * current = accent, half-done half turn = amber, to do = grey; after a slip
 * the undo line in orange.
 *
 * The eye icon toggles maskMoves: every move becomes a dot (progress colours
 * stay) — for practising from memory; after a slip an algorithm shows the
 * move that was due. A controlled toggle — the parent owns maskMoves /
 * onToggleMask (hooks/useMaskMoves, shared and persisted across pages).
 */

import { useEffect, useRef, type ReactNode } from "react";
import { RefreshCw, Eye, EyeOff } from "lucide-react";
import "@cubecore/element";
import type { CubeAlgPractice, CubeScramble } from "@cubecore/element";
import { parseAlg, solvedState } from "@cubecore/core";
import type { SequenceTarget, TrackedProgress } from "../logic/cubecoreSequence";
import type { MoveRecord } from "../types/session";

export interface SequenceTracking {
  notation: string;
  target: SequenceTarget;
  moves: readonly MoveRecord[];
}

interface MoveSequenceDisplayProps {
  moves: string[];
  /** The session's verdict (null = nothing being tracked, e.g. no target set). */
  progress: TrackedProgress | null;
  /** What the bar follows (null = keep showing where it got to). */
  tracking?: SequenceTracking | null;
  /** "scramble" (default): <cube-scramble>; "alg": <cube-alg-practice>. */
  kind?: "scramble" | "alg";

  onRefresh?: () => void;
  showRefresh?: boolean;
  /** Show the eye icon that toggles maskMoves. Requires onToggleMask. */
  showMaskToggle?: boolean;
  /** Replace each move's letters with a dot — progress coloring stays, identity is hidden. Error-repair hint is unaffected. */
  maskMoves?: boolean;
  onToggleMask?: () => void;
  /** Maximum number of errors before showing the "too many errors" overlay (0 = disabled). */
  maxErrors?: number;
  totalErrorCount?: number;
  onReset?: () => void;
  showErrorCount?: boolean;
  /**
   * Force the loading overlay even when `moves` is non-empty — without this,
   * a regenerating scramble/algorithm keeps showing the PREVIOUS (stale)
   * tokens looking perfectly normal, inviting someone to start performing
   * an about-to-be-replaced sequence. Dims the stale tokens behind a
   * spinner + loadingText instead of just swapping them out blind.
   */
  loading?: boolean;
  loadingText?: string;
  /** Set false when `loadingText` is a static message that isn't actually waiting on anything (e.g. "no scramble for this case type — recognise it on the cube instead") — a spinning icon next to it wrongly suggests more is about to load. Default true (genuine loading/generation states keep the spinner). */
  loadingSpinner?: boolean;
  completeText?: string;
  errorLabel?: string;
  className?: string;
  /**
   * Per-token text rendered around a move (dim, outside the progress
   * coloring) — used by the Academy to show trigger grouping like
   * "F (R U R' U') F'": token 1 gets prefix "(", token 4 suffix ")".
   * Keyed by token index in `moves`.
   */
  decorations?: Partial<Record<number, { prefix?: string; suffix?: string }>>;
  /** Extra buttons appended after the eye/refresh controls — e.g. SolvePage's "paste a custom scramble" button — so every action for this scramble/algorithm lives in one control row instead of scattered around the card. */
  extraControls?: ReactNode;
}

export function MoveSequenceDisplay({
  moves,
  progress,
  tracking = null,
  kind = "scramble",
  onRefresh,
  showRefresh = false,
  showMaskToggle = false,
  maskMoves = false,
  onToggleMask,
  maxErrors = 0,
  totalErrorCount = 0,
  onReset,
  showErrorCount = false,
  loading = false,
  loadingText,
  loadingSpinner = true,
  completeText = "Complete!",
  errorLabel = "Undo:",
  className = "",
  decorations,
  extraControls,
}: MoveSequenceDisplayProps) {
  const isComplete = progress?.complete ?? false;
  const tooManyErrors = !!progress && (progress.needsReset || (maxErrors > 0 && progress.undo.length >= maxErrors));
  const showLoadingOverlay = loadingText !== undefined && (loading || moves.length === 0);
  // Distinct from showLoadingOverlay: only true when there ARE stale moves
  // underneath to dim (vs. the very first load, nothing to overlay onto).
  const dimStaleMoves = showLoadingOverlay && moves.length > 0;

  return (
    <div className={`scramble-card ${className} ${showLoadingOverlay && moves.length === 0 ? "min-h-16" : ""}`}>
      {showLoadingOverlay && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-2xl bg-gray-950/70 backdrop-blur-sm">
          {loadingSpinner && <RefreshCw size={16} className="text-gray-500 animate-spin" />}
          <span className="text-sm font-medium text-gray-400">{loadingText}</span>
        </div>
      )}
      <div className={`scramble-layout ${dimStaleMoves ? "opacity-30 blur-[1px] pointer-events-none select-none" : ""}`}>
        <div className="scramble-display">
          {tooManyErrors && (
            <div className="scramble-error-overlay">
              <span className="error-text">Too many moves to undo — solve the cube and reset.</span>
              {onReset && (
                <button onClick={onReset} className="reset-button">
                  Reset
                </button>
              )}
            </div>
          )}

          {moves.length > 0 && (
            <SequenceElement
              kind={kind}
              notation={moves.join(" ")}
              tracking={tracking}
              masked={maskMoves}
              decorations={decorations}
              undoLabel={errorLabel.replace(/:$/, "")}
            />
          )}

          {isComplete && <span className="scramble-complete">{completeText}</span>}
        </div>

        <div className="scramble-controls">
          {showMaskToggle && onToggleMask && (
            <button
              onClick={onToggleMask}
              className="control-button"
              title={maskMoves ? "Show letters" : "Hide letters (show dots)"}
            >
              {maskMoves ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          )}
          {showRefresh && onRefresh && (
            <button onClick={onRefresh} className="control-button" title="Refresh">
              <RefreshCw size={20} />
            </button>
          )}
          {extraControls}
        </div>
      </div>

      {showErrorCount && totalErrorCount > 0 && (
        <div className="px-4 py-2 text-xs text-red-400 border-t border-gray-800/50">
          Errors: {totalErrorCount}
        </div>
      )}
    </div>
  );
}

type SequenceEl = CubeScramble | CubeAlgPractice;

/**
 * The library element, fed from the session: a new target (or start) sets it
 * up from scratch; more moves of the same attempt are pushed on; anything
 * else (an undone replay, another attempt) replays the log from the start.
 */
function SequenceElement({
  kind,
  notation,
  tracking,
  masked,
  decorations,
  undoLabel,
}: {
  kind: "scramble" | "alg";
  notation: string;
  tracking: SequenceTracking | null;
  masked: boolean;
  decorations?: Partial<Record<number, { prefix?: string; suffix?: string }>>;
  undoLabel: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const el = useRef<SequenceEl | null>(null);
  const fed = useRef<{ notation: string; target: SequenceTarget | null; moves: readonly MoveRecord[] }>({ notation: "", target: null, moves: [] });

  useEffect(() => {
    const e = document.createElement(kind === "alg" ? "cube-alg-practice" : "cube-scramble") as SequenceEl;
    e.setAttribute("controls", "none");
    e.className = "act-sequence";
    if (kind === "alg") {
      e.setAttribute("reveal", "all");
      (e as CubeAlgPractice).formatStats = () => "";
    }
    e.messages = { reset: "", complete: "" };
    host.current?.append(e);
    el.current = e;
    fed.current = { notation: "", target: null, moves: [] };
    return () => {
      e.remove();
      el.current = null;
    };
  }, [kind]);

  useEffect(() => {
    el.current?.setAttribute("masked", "");
    if (!masked) el.current?.removeAttribute("masked");
    if (kind === "alg") el.current?.setAttribute("reveal", masked ? "none" : "all");
  }, [masked, kind]);

  useEffect(() => {
    if (el.current) el.current.messages = { undo: undoLabel };
  }, [undoLabel]);

  useEffect(() => {
    if (el.current) el.current.decorations = decorations ?? null;
  }, [decorations]);

  useEffect(() => {
    const e = el.current;
    if (!e) return;
    const f = fed.current;
    const setUp = (target: SequenceTarget | null) => {
      e.frame = target?.frame ?? null;
      if ("alg" in e) e.alg = notation;
      else e.scramble = notation;
      e.reset(target?.start ?? solvedState());
      fed.current = { notation, target, moves: [] };
    };
    const push = (records: readonly MoveRecord[]) => {
      for (const r of records) for (const m of parseAlg(r.move)) e.push(m, r.timestamp);
    };
    if (!tracking || tracking.notation !== notation) {
      // Nothing tracked: a new sequence starts afresh; the same one stays where it got to.
      if (f.notation !== notation) setUp(null);
      return;
    }
    const sameAttempt = f.notation === notation && f.target === tracking.target;
    const extends_ = sameAttempt && f.moves.length <= tracking.moves.length && f.moves.every((m, i) => m === tracking.moves[i]);
    if (!extends_) {
      setUp(tracking.target);
      push(tracking.moves);
    } else push(tracking.moves.slice(f.moves.length));
    fed.current = { notation, target: tracking.target, moves: tracking.moves };
  }, [notation, tracking]);

  return <div ref={host} className="w-full" />;
}

/**
 * MoveSequenceDisplay — shows a target move sequence (scramble OR algorithm)
 * with progress coloring, driven entirely by a SequenceProgress snapshot
 * from logic/sequenceTracker.ts. Same component, same API, for scrambling,
 * algorithm training, and attack mode — no per-mode branching.
 *
 * Coloring:
 *   green  = completedIndices (correctly executed)
 *   blue   = nextIndex (next expected move, only when no active error)
 *   yellow = startedIndices (correct face, partial power)
 *   gray   = pending (not yet reached)
 *   red    = error indicator with undo sequence, shown separately above
 *
 * The eye icon toggles maskMoves: each move's LETTERS become a "•" dot
 * (same per-token coloring/progress still visible) — for memo-style
 * practice on any page where you want to hide which scramble/algorithm it
 * is without losing the error-repair hint, which always shows real letters
 * regardless (you still need to read it to actually fix a mistake). This is
 * a controlled toggle — the parent owns maskMoves/onToggleMask (via
 * hooks/useMaskMoves, shared/persisted across pages), not local state here.
 */

import { RefreshCw, Eye, EyeOff } from "lucide-react";
import type { SequenceProgress } from "../logic/sequenceTracker";

interface MoveSequenceDisplayProps {
  moves: string[];
  /** null = nothing being tracked yet (e.g. no target set). */
  progress: SequenceProgress | null;

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
}

export function MoveSequenceDisplay({
  moves,
  progress,
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
  completeText = "Complete!",
  errorLabel = "Undo:",
  className = "",
  decorations,
}: MoveSequenceDisplayProps) {
  const hasErrors = (progress?.correctionSequence.length ?? 0) > 0;
  const isComplete = progress?.isCompleted ?? false;
  const tooManyErrors = maxErrors > 0 && (progress?.correctionSequence.length ?? 0) >= maxErrors;
  const showLoadingOverlay = loadingText !== undefined && (loading || moves.length === 0);
  // Distinct from showLoadingOverlay: only true when there ARE stale moves
  // underneath to dim (vs. the very first load, nothing to overlay onto).
  const dimStaleMoves = showLoadingOverlay && moves.length > 0;

  const repairAlgorithm =
    progress && progress.correctionSequence.length > 0 ? progress.correctionSequence.join(" ") : null;

  const getMoveClass = (index: number): string => {
    if (!progress) return "pending";
    if (progress.completedIndices.includes(index)) return "correct";
    if (progress.startedIndices.includes(index)) return "started";
    if (!hasErrors && index === progress.nextIndex) return "current";
    return "pending";
  };

  const showErrorIndicator = hasErrors && !tooManyErrors && repairAlgorithm;

  return (
    <div className={`scramble-card ${className} ${showLoadingOverlay && moves.length === 0 ? "min-h-16" : ""}`}>
      {showLoadingOverlay && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-2xl bg-gray-950/70 backdrop-blur-sm">
          <RefreshCw size={16} className="text-gray-500 animate-spin" />
          <span className="text-sm font-medium text-gray-400">{loadingText}</span>
        </div>
      )}
      <div className={`scramble-layout ${dimStaleMoves ? "opacity-30 blur-[1px] pointer-events-none select-none" : ""}`}>
        <div className="scramble-display">
          {tooManyErrors && (
            <div className="scramble-error-overlay">
              <span className="error-text">Too many errors!</span>
              {onReset && (
                <button onClick={onReset} className="reset-button">
                  Reset
                </button>
              )}
            </div>
          )}

          {showErrorIndicator && (
            <div className="scramble-error-indicator">
              <span className="error-label">{errorLabel}</span>
              <span className="error-algorithm">{repairAlgorithm}</span>
            </div>
          )}

          {moves.length > 0 && (
            <div className="scramble-moves">
              {moves.map((move, index) => {
                const deco = decorations?.[index];
                return (
                  <span key={`${move}-${index}`} className="inline-flex items-center">
                    {deco?.prefix && <span className="font-mono text-3xl font-black text-gray-300 select-none mr-0.5">{deco.prefix}</span>}
                    <span className={`scramble-move ${getMoveClass(index)}`}>{maskMoves ? "•" : move}</span>
                    {deco?.suffix && <span className="font-mono text-3xl font-black text-gray-300 select-none ml-0.5">{deco.suffix}</span>}
                  </span>
                );
              })}
            </div>
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

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
  loadingText?: string;
  completeText?: string;
  errorLabel?: string;
  className?: string;
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
  loadingText,
  completeText = "Complete!",
  errorLabel = "Undo:",
  className = "",
}: MoveSequenceDisplayProps) {
  const hasErrors = (progress?.correctionSequence.length ?? 0) > 0;
  const isComplete = progress?.isCompleted ?? false;
  const tooManyErrors = maxErrors > 0 && (progress?.correctionSequence.length ?? 0) >= maxErrors;
  const isLoading = moves.length === 0 && loadingText !== undefined;

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
    <div className={`scramble-card ${className}`}>
      <div className="scramble-layout">
        <div className="scramble-display">
          {isLoading && <span className="scramble-loading">{loadingText}</span>}

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
              {moves.map((move, index) => (
                <span key={`${move}-${index}`} className={`scramble-move ${getMoveClass(index)}`}>
                  {maskMoves ? "•" : move}
                </span>
              ))}
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

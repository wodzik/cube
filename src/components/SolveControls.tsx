/**
 * Solve controls — abort and reset buttons during an active attempt.
 *
 * Behaviour differs by mode:
 *   algorithm/attack — "Cancel" immediately discards the current attempt.
 *   solve            — "Cancel" opens a small menu: Discard / Save as DNF / Keep solving.
 *
 * "Reset cube" is a separate one-click button — only resets the 3D
 * visualisation (re-sync to the current scramble/algorithm setup), never
 * touches the timer or session state.
 *
 * Renders nothing when isActive === false.
 */

import { useState, useRef, useEffect } from "react";
import { X, RotateCcw } from "lucide-react";

export type ControlsMode = "solve" | "attempt";

interface SolveControlsProps {
  mode: ControlsMode;
  isActive: boolean;
  onDiscard: () => void;
  /** Solve mode only. */
  onSaveAsDNF?: () => void;
  onResetCube?: () => void;
  /**
   * When true, Cancel discards immediately without the dropdown menu — use
   * when the timer stops automatically via the cube (no manual stop, so
   * Save-as-DNF doesn't apply).
   */
  stopByCube?: boolean;
  className?: string;
}

export function SolveControls({
  mode,
  isActive,
  onDiscard,
  onSaveAsDNF,
  onResetCube,
  stopByCube = false,
  className = "",
}: SolveControlsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  useEffect(() => {
    if (!isActive) setMenuOpen(false);
  }, [isActive]);

  if (!isActive) return null;

  const useDirectCancel = mode === "attempt" || stopByCube;

  const handleCancelClick = () => {
    if (useDirectCancel) {
      onDiscard();
    } else {
      setMenuOpen((prev) => !prev);
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {onResetCube && (
        <button
          onClick={onResetCube}
          title="Re-sync cube visualisation"
          className="p-2 rounded-xl text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors"
        >
          <RotateCcw size={14} />
        </button>
      )}

      <div className="relative" ref={menuRef}>
        <button
          onClick={handleCancelClick}
          title={mode === "attempt" ? "Cancel attempt" : "Stop solve"}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
            menuOpen
              ? "bg-red-500/10 text-red-400 border border-red-500/30"
              : "text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent"
          }`}
        >
          <X size={13} />
          <span>Cancel</span>
        </button>

        {menuOpen && !useDirectCancel && (
          <div className="absolute right-0 bottom-full mb-1.5 z-50 min-w-[172px] bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
            <button
              onClick={() => {
                setMenuOpen(false);
                onDiscard();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
            >
              Discard solve
            </button>

            {onSaveAsDNF && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onSaveAsDNF();
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors"
              >
                Save as DNF
              </button>
            )}

            <div className="h-px bg-gray-800" />

            <button
              onClick={() => setMenuOpen(false)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Keep solving
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

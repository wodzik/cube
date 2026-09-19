/**
 * The preview a share link opens: the normal solve analysis (cube replay,
 * stage bar, per-stage table) in read-only mode, or a short notice when the
 * link is invalid or was cut off in transit. Lazy-loaded from App — it pulls
 * in the cube player, which most visits never need.
 */

import { AlertTriangle } from "lucide-react";
import { SolveAnalysis } from "./SolveAnalysis";
import type { SharedSolveState } from "../hooks/useSharedSolve";

interface SharedSolveViewProps {
  state: NonNullable<SharedSolveState>;
  onClose: () => void;
}

export default function SharedSolveView({ state, onClose }: SharedSolveViewProps) {
  if (state.status === "ok") {
    return <SolveAnalysis record={state.shared.record} moveCountOnly={state.shared.moveCountOnly} readOnly notice="Shared solve" onClose={onClose} />;
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-white/15 rounded-2xl shadow-2xl shadow-black/80 p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
        <AlertTriangle size={22} className="mx-auto text-amber-400 mb-2" />
        <h2 className="text-white font-semibold text-lg">This link doesn't open</h2>
        <p className="text-sm text-gray-400 mt-1.5 mb-5">The shared solve is damaged or was cut off — messaging apps sometimes shorten long links. Ask for the link again.</p>
        <button onClick={onClose} className="btn-primary w-full justify-center">
          Close
        </button>
      </div>
    </div>
  );
}

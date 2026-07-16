/**
 * AlgPlaybackModal — "show me how" popup: a TwistyPlayer with its built-in
 * play / pause / step / scrub controls (controlPanel "bottom-row") that
 * animates the algorithm from its case state to solved. Made for learners
 * who don't read notation fluently yet (Academy), but offered next to
 * every algorithm card and variant.
 *
 * The cube starts at setup = inverse(alg) — the case this algorithm solves
 * — so playing the timeline executes the algorithm exactly as you would on
 * a real cube. Slow tempo and floating hint facelets so every move is easy
 * to follow; the cube itself can be dragged to change the viewing angle.
 *
 * z-[60]: must stack above CaseEdit's z-50 overlay when opened from a
 * variant row.
 */

import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { CubeVisualisation } from "./CubeVisualisation";
import { invertSequence } from "../logic/moveParser";
import { parseDecoratedAlg } from "../data/academy";
import type { StickeringMaskOrbits } from "../types/cube";

interface AlgPlaybackModalProps {
  title: string;
  subtitle?: string;
  /** Display notation — may contain trigger parentheses. */
  alg: string;
  /** Inherit the case's display mode: named stickering (Practice groups)… */
  stickering?: string;
  /** …or custom mask (Academy step views). Takes precedence over `stickering`. */
  stickeringMaskOrbits?: StickeringMaskOrbits;
  onClose: () => void;
}

export function AlgPlaybackModal({ title, subtitle, alg, stickering, stickeringMaskOrbits, onClose }: AlgPlaybackModalProps) {
  const { plain, setup } = useMemo(() => {
    const { tokens } = parseDecoratedAlg(alg);
    return {
      plain: tokens.join(" "),
      setup: tokens.length > 0 ? invertSequence(tokens).join(" ") : "",
    };
  }, [alg]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="min-w-0">
            <h2 className="text-white font-semibold text-base truncate">{title}</h2>
            {subtitle && <p className="text-gray-500 text-xs mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-200 transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="w-full aspect-square min-h-0 bg-gray-950/50">
          <CubeVisualisation
            alg={plain}
            setupAlg={setup}
            setupAnchor="start"
            visualization="PG3D"
            stickering={stickering}
            stickeringMaskOrbits={stickeringMaskOrbits}
            controlPanel="bottom-row"
            hintFacelets="floating"
            tempoScale={1}
            cameraLatitude={35}
            cameraLongitude={30}
            className="size-full"
          />
        </div>

        <div className="px-5 py-4 border-t border-white/[0.06]">
          <p className="font-mono text-sm text-gray-200 break-words">{alg}</p>
          <p className="text-[11px] text-gray-600 mt-1.5">
            Press play or step through the moves with the controls under the cube. Drag the cube to change the view.
          </p>
        </div>
      </div>
    </div>
  );
}

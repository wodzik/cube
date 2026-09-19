/**
 * AcademyAlgCard — grid card for one Academy algorithm, mirroring
 * CaseCard's look (2D case preview, name, alg text, selection checkbox,
 * practice-now play button) minus everything Academy deliberately lacks:
 * no learning status, no editing, no persisted stats. A colored dot next
 * to the name shows the curriculum weight instead (green = required,
 * blue = nice to know) — the cards are small enough that a text badge
 * would crowd the name out.
 */

import { useState } from "react";
import { Play, Video } from "lucide-react";
import { AlgCaseVisualisation } from "./AlgCaseVisualisation";
import { AlgPlaybackModal } from "./AlgPlaybackModal";
import { parseDecoratedAlg, type AcademyAlg } from "../data/academy";
import type { StickeringMaskOrbits } from "../types/cube";
import type { VisualizationMode } from "../types/cube";

interface AcademyAlgCardProps {
  alg: AcademyAlg;
  /** Step view mask (trainerMasks.academyStepMask) applied to the preview. */
  stickeringMaskOrbits: StickeringMaskOrbits;
  /**
   * Preview angle — the flat top-down "experimental-2D-LL" reads fine for
   * last-layer steps (everything relevant faces up), but the first-layer
   * and second-layer steps need the FRONT of the cube visible too (a
   * corner's white sticker pointing at you vs. up vs. right isn't
   * distinguishable from directly above) — those steps pass "3D" instead.
   */
  visualization?: VisualizationMode;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  onPractice: () => void;
}

export function AcademyAlgCard({ alg, stickeringMaskOrbits, visualization = "experimental-2D-LL", selected, onSelectedChange, onPractice }: AcademyAlgCardProps) {
  const plainAlg = parseDecoratedAlg(alg.alg).tokens.join(" ");
  const [showPlayback, setShowPlayback] = useState(false);

  return (
    <div
      className={`group relative flex flex-col rounded-xl overflow-hidden transition-all select-none border ${
        selected
          ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.06]"
          : "border-white/[0.06] bg-gray-900/40 hover:border-white/15"
      }`}
    >
      <div className="flex items-center gap-1.5 px-2 pt-1.5 pb-0 min-w-0">
        <span
          className={`shrink-0 w-1.5 h-1.5 rounded-full ${alg.required ? "bg-emerald-400" : "bg-sky-400"}`}
          title={alg.required ? "Required" : "Nice to know"}
        />
        <span
          className="flex-1 min-w-0 text-[11px] font-semibold text-white truncate leading-tight cursor-pointer hover:underline"
          onClick={onPractice}
          title={`${alg.name} — practice this now`}
        >
          {alg.name}
        </span>
        <button
          onClick={() => setShowPlayback(true)}
          title="Show how to perform this algorithm"
          className="shrink-0 p-0.5 rounded text-gray-500 hover:text-white transition-colors"
        >
          <Video size={11} />
        </button>
        <button
          onClick={onPractice}
          title="Practice this now"
          className="shrink-0 p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100"
          style={{ color: "var(--accent-bright)" }}
        >
          <Play size={11} fill="currentColor" />
        </button>
      </div>

      <div className="px-2 py-1 flex items-center justify-center cursor-pointer" onClick={onPractice} title="Practice this now">
        <div className="w-full aspect-square">
          <AlgCaseVisualisation
            alg={plainAlg}
            stickeringMaskOrbits={stickeringMaskOrbits}
            visualization={visualization}
            className="size-full"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-1 px-2 py-1.5 mt-auto">
        <span className="text-[9px] text-gray-600 font-mono truncate" title={alg.alg}>
          {alg.alg}
        </span>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelectedChange(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 w-3.5 h-3.5 rounded cursor-pointer"
          style={{ accentColor: "var(--accent)" }}
        />
      </div>

      {showPlayback && (
        <AlgPlaybackModal
          title={alg.name}
          subtitle={alg.description}
          alg={alg.alg}
          stickeringMaskOrbits={stickeringMaskOrbits}
          onClose={() => setShowPlayback(false)}
        />
      )}
    </div>
  );
}

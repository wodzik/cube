/**
 * AcademyAlgCard — grid card for one Academy algorithm, mirroring
 * CaseCard's look (2D case preview, name, alg text, selection checkbox,
 * practice-now play button) minus everything Academy deliberately lacks:
 * no learning status, no editing, no persisted stats. The badge shows the
 * curriculum weight instead (required / nice to know).
 */

import { useState } from "react";
import { Play, Video } from "lucide-react";
import { AlgCaseVisualisation } from "./AlgCaseVisualisation";
import { AlgPlaybackModal } from "./AlgPlaybackModal";
import { parseDecoratedAlg, type AcademyAlg } from "../data/academy";
import type { StickeringMaskOrbits } from "../types/cube";

interface AcademyAlgCardProps {
  alg: AcademyAlg;
  /** Step view mask (trainerMasks.academyStepMask) applied to the preview. */
  stickeringMaskOrbits: StickeringMaskOrbits;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  onPractice: () => void;
}

export function AcademyAlgCard({ alg, stickeringMaskOrbits, selected, onSelectedChange, onPractice }: AcademyAlgCardProps) {
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
      <div className="flex items-center justify-between gap-1 px-2.5 pt-2 pb-0">
        <span
          className="text-[11px] font-semibold text-white truncate leading-tight cursor-pointer hover:underline"
          onClick={onPractice}
          title="Practice this now"
        >
          {alg.name}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
              alg.required ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300"
            }`}
          >
            {alg.required ? "required" : "nice to know"}
          </span>
          <button
            onClick={() => setShowPlayback(true)}
            title="Show how to perform this algorithm"
            className="p-1 rounded text-gray-500 hover:text-white transition-colors"
          >
            <Video size={12} />
          </button>
          <button
            onClick={onPractice}
            title="Practice this now"
            className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
            style={{ color: "var(--accent-bright)" }}
          >
            <Play size={12} fill="currentColor" />
          </button>
        </div>
      </div>

      <div className="px-2 py-1 flex items-center justify-center cursor-pointer" onClick={onPractice} title="Practice this now">
        <div className="w-full aspect-square">
          <AlgCaseVisualisation
            alg={plainAlg}
            stickeringMaskOrbits={stickeringMaskOrbits}
            visualization="experimental-2D-LL"
            className="size-full"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-1 px-2.5 py-2 mt-auto">
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
          onClose={() => setShowPlayback(false)}
        />
      )}
    </div>
  );
}

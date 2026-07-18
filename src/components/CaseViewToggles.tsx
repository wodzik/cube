/**
 * The two view-aid toggle buttons (Back stickers / Flat view) shown next to
 * a big training cube. Pure presentational — state lives in useCaseViewPrefs.
 * Same look as the Case Trainer's original options-row buttons.
 */

import { Eye, Grid3x3 } from "lucide-react";
import type { CaseViewPrefs } from "../hooks/useCaseViewPrefs";

export function CaseViewToggles({ backStickers, flatView, toggleBackStickers, toggleFlatView }: CaseViewPrefs) {
  return (
    <>
      <button
        onClick={toggleBackStickers}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${
          backStickers ? "text-sky-300 bg-sky-500/10" : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]"
        }`}
        title="Show translucent copies of the hidden faces' stickers"
      >
        <Eye size={12} /> Back stickers
      </button>
      <button
        onClick={toggleFlatView}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${
          flatView ? "text-sky-300 bg-sky-500/10" : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]"
        }`}
        title="Show a flat unfolded view of the whole cube under the 3D one"
      >
        <Grid3x3 size={12} /> Flat view
      </button>
    </>
  );
}

/**
 * The view-aid buttons shown next to a big training cube: one button cycling
 * the hidden-faces aid (off / Back stickers / Back view / Back view corner),
 * plus Flat view. Pure presentational — state lives in useCaseViewPrefs.
 * Same look as the Case Trainer's original options-row buttons.
 */

import { Columns2, Eye, Grid3x3, PictureInPicture2 } from "lucide-react";
import {
  MAX_HINT_ELEVATION,
  MIN_HINT_ELEVATION,
  type CaseViewPrefs,
} from "../hooks/useCaseViewPrefs";

const BACK_MODE_LABEL = {
  none: "Back: off",
  stickers: "Back stickers",
  "side-by-side": "Back view",
  "top-right": "Back view (corner)",
} as const;

export function CaseViewToggles({
  backStickers,
  flatView,
  hintElevation,
  backView,
  cycleBackMode,
  toggleFlatView,
  setHintElevation,
}: CaseViewPrefs) {
  const mode = backView !== "none" ? backView : backStickers ? "stickers" : "none";
  const Icon = mode === "side-by-side" ? Columns2 : mode === "top-right" ? PictureInPicture2 : Eye;
  return (
    <>
      <button
        onClick={cycleBackMode}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-colors ${
          mode !== "none" ? "text-sky-300 bg-sky-500/10" : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]"
        }`}
        title="Hidden faces: off → back stickers → back view → back view in the corner"
      >
        <Icon size={12} /> {BACK_MODE_LABEL[mode]}
      </button>
      {backStickers && (
        <input
          type="range"
          min={MIN_HINT_ELEVATION}
          max={MAX_HINT_ELEVATION}
          step={0.05}
          value={hintElevation}
          onChange={(e) => setHintElevation(Number(e.target.value))}
          className="w-20 accent-sky-400"
          title="How far the back stickers float from the cube"
          aria-label="Back sticker distance"
        />
      )}
      <button
        onClick={toggleFlatView}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-colors ${
          flatView ? "text-sky-300 bg-sky-500/10" : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]"
        }`}
        title="Show a flat unfolded view of the whole cube under the 3D one"
      >
        <Grid3x3 size={12} /> Flat view
      </button>
    </>
  );
}

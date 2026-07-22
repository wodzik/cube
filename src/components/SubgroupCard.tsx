/**
 * SubgroupCard — a clickable folder card for one subgroup inside a
 * hasSubgroups group (e.g. one of ZBLL's U/L/T/H/Pi/S/AS folders). Its
 * preview is rendered exactly like a case card's: previewAlg's inverse as
 * the cube setup — no separate preview-rendering path.
 */

import { Settings } from "lucide-react";
import type { AlgSubgroup, DisplayConfig } from "../types/algorithm";
import { AlgCaseVisualisation } from "./AlgCaseVisualisation";
import { resolveStickeringProps } from "../services/algGroupRegistry";

interface SubgroupCardProps {
  subgroup: AlgSubgroup;
  /** The parent group's resolved display config — the subgroup's own override layers on top. */
  groupDisplayConfig: DisplayConfig;
  onOpen: () => void;
  /** Omit to render without the settings gear (e.g. Attack's read-only folder view). */
  onEditSettings?: () => void;
}

export function SubgroupCard({ subgroup, groupDisplayConfig, onOpen, onEditSettings }: SubgroupCardProps) {
  const displayConfig: DisplayConfig = { ...groupDisplayConfig, ...subgroup.displayConfig };
  const cleanAlg = subgroup.previewAlg.replace(/[()]/g, "").replace(/\s+/g, " ").trim();

  return (
    <div
      className="group relative flex flex-col rounded-xl overflow-hidden transition-all select-none border border-white/[0.06] bg-gray-900/40 hover:border-white/15 cursor-pointer"
      onClick={onOpen}
    >
      <div className="flex items-center justify-between gap-1 px-2.5 pt-2 pb-0">
        <span className="text-[11px] font-semibold text-white truncate leading-tight">{subgroup.name}</span>
        {onEditSettings && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditSettings();
            }}
            title="Subgroup settings"
            className="p-1 rounded text-gray-700 hover:text-gray-300 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
          >
            <Settings size={11} />
          </button>
        )}
      </div>

      <div className="px-2 py-1 flex items-center justify-center">
        <div className="w-full aspect-square">
          <AlgCaseVisualisation
            alg={cleanAlg}
            visualization={displayConfig.cardVisualization}
            cameraLatitude={displayConfig.cameraLatitude}
            cameraLongitude={displayConfig.cameraLongitude}
            {...resolveStickeringProps(displayConfig.stickering)}
            className="size-full"
          />
        </div>
      </div>

      <div className="px-2.5 py-2 mt-auto">
        <span className="text-[10px] text-gray-500">
          {subgroup.cases.length} case{subgroup.cases.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

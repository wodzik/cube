/**
 * CaseListItem — horizontal list row for a single algorithm case.
 *
 * Shared between AttackPage's queue (wrapped in SortableQueueItem for DnD)
 * and AlgorithmListView's list-mode rows.
 *
 * Renders: [left slot] [mini preview] [name / alg / stats] [edit button] [right slot].
 * The `left`/`right` slots let callers inject extra controls (drag handle,
 * status badge, checkbox, …) without coupling this component to either use-case.
 */

import { Pencil, Play } from "lucide-react";
import type { AlgGroup, AlgorithmCase, AttemptSource } from "../types/algorithm";
import { AlgCaseVisualisation } from "./AlgCaseVisualisation";
import { STICKERING, VISUALIZATION_MODE, CAMERA, getDefaultVariant } from "../logic/algGroupConfig";
import { formatTime, computeVariantStatsForSource } from "../logic/statistics";

export interface CaseListItemProps {
  case_: AlgorithmCase;
  group: AlgGroup;
  /** Training and Attack track stats separately — which one's PB/Avg/Ao5 to show. */
  statsSource: AttemptSource;
  /** Highlight the row (e.g. currently active case). */
  isActive?: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onEdit?: () => void;
  /** Jump straight to practicing this case now (clicking the name, or the play button). */
  onSelect?: () => void;
  className?: string;
}

export function CaseListItem({ case_, group, statsSource, isActive, left, right, onEdit, onSelect, className = "" }: CaseListItemProps) {
  const defV = getDefaultVariant(case_);
  const stats = defV ? computeVariantStatsForSource(defV.times, statsSource) : null;

  return (
    <div
      className={`group relative flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
        isActive ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"
      } ${className}`}
    >
      {isActive && <span className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: "var(--accent)" }} />}
      {left}

      <div
        className="w-9 h-9 rounded-lg overflow-hidden bg-gray-800/60 shrink-0 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onEdit?.();
        }}
        title="Edit case"
      >
        <AlgCaseVisualisation
          alg={defV?.alg ?? ""}
          stickering={STICKERING[group]}
          visualization={VISUALIZATION_MODE[group]}
          cameraLatitude={CAMERA[group].latitude}
          cameraLongitude={CAMERA[group].longitude}
          className="size-full"
        />
      </div>

      <div
        className={`flex-1 min-w-0 ${onSelect || onEdit ? "cursor-pointer" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          if (onSelect) onSelect();
          else onEdit?.();
        }}
        title={onSelect ? "Practice this now" : onEdit ? "Edit algorithm" : undefined}
      >
        <p className={`text-sm font-medium truncate ${isActive ? "text-white" : "text-gray-300"}`}>{case_.name}</p>
        <p className="text-[10px] text-gray-600 font-mono truncate mt-0.5">{defV?.alg ?? ""}</p>
        {stats && stats.count > 0 && (
          <div className="flex items-center gap-2 mt-0.5">
            {stats.bestTime !== null && <span className="text-[9px] text-emerald-500 font-mono">PB {formatTime(stats.bestTime)}</span>}
            {stats.mean !== null && <span className="text-[9px] text-gray-400 font-mono">Avg {formatTime(stats.mean)}</span>}
            {stats.ao5 !== null && <span className="text-[9px] font-mono" style={{ color: "var(--accent-bright)" }}>Ao5 {formatTime(stats.ao5)}</span>}
          </div>
        )}
      </div>

      {onSelect && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="p-1 shrink-0 transition-colors opacity-0 group-hover:opacity-100"
          style={{ color: "var(--accent-bright)" }}
          title="Practice this now"
        >
          <Play size={12} fill="currentColor" />
        </button>
      )}

      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1 text-gray-700 hover:text-gray-300 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
          title="Edit case"
        >
          <Pencil size={11} />
        </button>
      )}

      {right}
    </div>
  );
}

/**
 * CaseCard — compact grid card for a single algorithm case.
 *
 * Shows: 2D (or 3D for F2L) cube preview, case name, learning-status cycle
 * button, best/Ao5 stats, algorithm text, selection checkbox, edit button.
 */

import { Minus, Bookmark, CheckCircle2, Pencil, Play } from "lucide-react";
import type { AlgGroup, AlgorithmCase, AttemptSource, LearningStatus } from "../types/algorithm";
import { AlgCaseVisualisation } from "./AlgCaseVisualisation";
import { STICKERING, VISUALIZATION_MODE, CAMERA, getDefaultVariant } from "../logic/algGroupConfig";
import { formatTime, computeVariantStatsForSource } from "../logic/statistics";

interface StatusMeta {
  icon: React.ReactNode;
  label: string;
  color: string;
  next: LearningStatus;
}

const STATUS_META: Record<LearningStatus, StatusMeta> = {
  "not-started": { icon: <Minus size={13} />, label: "Not started", color: "text-gray-500 hover:text-gray-300", next: "learning" },
  learning: { icon: <Bookmark size={13} />, label: "Learning", color: "text-amber-400 hover:text-amber-300", next: "learned" },
  learned: { icon: <CheckCircle2 size={13} />, label: "Learned", color: "text-emerald-400 hover:text-emerald-300", next: "not-started" },
};

export interface CaseCardProps {
  case_: AlgorithmCase;
  group: AlgGroup;
  /** Training and Attack track stats separately — which one's PB/Avg/Ao5 to show. */
  statsSource: AttemptSource;
  onStatusChange: (status: LearningStatus) => void;
  onSelectedChange: (selected: boolean) => void;
  onEdit: () => void;
  /** Jump straight to practicing this case now. */
  onSelect?: () => void;
}

export function CaseCard({ case_, group, statsSource, onStatusChange, onSelectedChange, onEdit, onSelect }: CaseCardProps) {
  const defaultVariant = getDefaultVariant(case_);
  const cleanAlg = defaultVariant?.alg.replace(/[()]/g, "").replace(/\s+/g, " ").trim() ?? "";
  const stats = defaultVariant ? computeVariantStatsForSource(defaultVariant.times, statsSource) : null;

  const status: LearningStatus = defaultVariant?.learningStatus ?? "not-started";
  const meta = STATUS_META[status];

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusChange(meta.next);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit();
  };

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.();
  };

  return (
    <div
      className={`group relative flex flex-col rounded-xl overflow-hidden transition-all select-none border ${
        case_.selected
          ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.06]"
          : "border-white/[0.06] bg-gray-900/40 hover:border-white/15"
      }`}
    >
      <div className="flex items-center justify-between gap-1 px-2.5 pt-2 pb-0">
        <span
          className={`text-[11px] font-semibold text-white truncate leading-tight ${onSelect ? "cursor-pointer hover:underline" : ""}`}
          onClick={onSelect ? handleSelectClick : undefined}
          title={onSelect ? "Practice this now" : undefined}
        >
          {case_.name}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          {onSelect && (
            <button onClick={handleSelectClick} title="Practice this now" className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100" style={{ color: "var(--accent-bright)" }}>
              <Play size={12} fill="currentColor" />
            </button>
          )}
          <button onClick={handleStatusClick} title={`Status: ${meta.label} (click to advance)`} className={`p-1 rounded transition-colors ${meta.color}`}>
            {meta.icon}
          </button>
          <button
            onClick={handleEditClick}
            title="Edit variants"
            className="p-1 text-gray-700 hover:text-gray-300 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Pencil size={11} />
          </button>
        </div>
      </div>

      <div className="px-2 py-1 flex items-center justify-center cursor-pointer" onClick={handleEditClick} title="Edit variants">
        <div className="w-full aspect-square">
          <AlgCaseVisualisation
            alg={cleanAlg}
            stickering={STICKERING[group]}
            visualization={VISUALIZATION_MODE[group]}
            cameraLatitude={CAMERA[group].latitude}
            cameraLongitude={CAMERA[group].longitude}
            className="size-full"
          />
        </div>
      </div>

      <div className="px-2.5 flex gap-3 text-[10px] text-gray-500 tabular-nums font-mono">
        <span>
          PB <span className="text-gray-300">{stats?.bestTime != null ? formatTime(stats.bestTime) : "—"}</span>
        </span>
        <span>
          Avg <span className="text-gray-300">{stats?.mean != null ? formatTime(stats.mean) : "—"}</span>
        </span>
        <span>
          Ao5 <span className="text-gray-300">{stats?.ao5 != null ? formatTime(stats.ao5) : "—"}</span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-1 px-2.5 py-2 mt-auto">
        <span className="text-[9px] text-gray-600 font-mono truncate" title={defaultVariant?.alg}>
          {defaultVariant?.alg ?? ""}
        </span>
        <input
          type="checkbox"
          checked={!!case_.selected}
          onChange={(e) => onSelectedChange(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 w-3.5 h-3.5 rounded cursor-pointer"
          style={{ accentColor: "var(--accent)" }}
        />
      </div>
    </div>
  );
}

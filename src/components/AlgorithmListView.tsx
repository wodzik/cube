/**
 * AlgorithmListView — filterable, selectable grid/list of algorithm cases.
 *
 * Category filter pills, status filter, select all/deselect all, per-category
 * select-all, and a grid/list view toggle:
 *   - Grid: CaseCard auto-fill columns (min 148px wide) with a live cube preview.
 *   - List: CaseListItem horizontal rows.
 *
 * All mutations propagate up via callbacks — the parent (TrainingPage) is
 * responsible for persisting to algorithmStore.
 *
 * statsSource is hardcoded to "training" below — this component is only
 * ever used from TrainingPage; Attack renders its queue directly with
 * CaseListItem (see AttackPage.tsx) and passes "attack" there instead.
 */

import { useState, useMemo } from "react";
import { Eye, EyeOff, CheckSquare, Square, LayoutGrid, List, Minus, Bookmark, CheckCircle2, Plus } from "lucide-react";
import type { AlgGroup, AlgorithmCase, DisplayConfig, LearningStatus } from "../types/algorithm";
import { getDefaultVariant } from "../logic/algGroupConfig";
import { getGroupMeta, resolveDisplayConfig } from "../services/algGroupRegistry";
import { CaseCard } from "./CaseCard";
import { CaseListItem } from "./CaseListItem";

type StatusFilter = "all" | LearningStatus;
type ViewMode = "grid" | "list";

export interface AlgorithmListViewProps {
  group: AlgGroup;
  cases: AlgorithmCase[];
  onStatusChange: (caseName: string, variantId: string, status: LearningStatus) => void;
  onSelectedChange: (caseName: string, selected: boolean) => void;
  /** Select/deselect a batch; if caseNames is omitted -> all filtered visible. */
  onSelectAll: (selected: boolean, caseNames?: string[]) => void;
  onEdit: (case_: AlgorithmCase) => void;
  /** Jump straight to practicing a case now (play button / clicking its name). */
  onPractice?: (case_: AlgorithmCase) => void;
  /** Add a brand-new case to this group. */
  onAddCase?: () => void;
  /** A subgroup's own override, layered on top of the group's display config (undefined when not scoped to a subgroup). */
  displayConfigOverride?: Partial<DisplayConfig>;
}

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  "not-started": "Not started",
  learning: "Learning",
  learned: "Learned",
};

const STATUS_PILL_ACTIVE: Record<StatusFilter, string> = {
  all: "bg-gray-700 text-white",
  "not-started": "bg-gray-700 text-gray-200",
  learning: "bg-amber-600 text-white",
  learned: "bg-emerald-600 text-white",
};

const STATUS_ICON: Record<LearningStatus, React.ReactNode> = {
  "not-started": <Minus size={12} />,
  learning: <Bookmark size={12} />,
  learned: <CheckCircle2 size={12} />,
};

const STATUS_NEXT: Record<LearningStatus, LearningStatus> = {
  "not-started": "learning",
  learning: "learned",
  learned: "not-started",
};

const STATUS_COLOR: Record<LearningStatus, string> = {
  "not-started": "text-gray-500 hover:text-gray-300",
  learning: "text-amber-400 hover:text-amber-300",
  learned: "text-emerald-400 hover:text-emerald-300",
};

export function AlgorithmListView({
  group,
  cases,
  onStatusChange,
  onSelectedChange,
  onSelectAll,
  onEdit,
  onPractice,
  onAddCase,
  displayConfigOverride,
}: AlgorithmListViewProps) {
  const allCategories = useMemo(() => Array.from(new Set(cases.map((c) => c.category))), [cases]);
  const groupDisplayConfig = useMemo(
    () => resolveDisplayConfig(getGroupMeta(group), displayConfigOverride),
    [group, displayConfigOverride]
  );

  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (hiddenCategories.has(c.category)) return false;
      if (statusFilter !== "all") {
        const v = getDefaultVariant(c);
        if (v?.learningStatus !== statusFilter) return false;
      }
      return true;
    });
  }, [cases, hiddenCategories, statusFilter]);

  const filteredNames = useMemo(() => filteredCases.map((c) => c.name), [filteredCases]);

  const selectedCount = filteredCases.filter((c) => c.selected).length;
  const allSelected = filteredCases.length > 0 && filteredCases.every((c) => c.selected);

  const toggleCategoryVisibility = (cat: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const isCategoryFullySelected = (cat: string) => {
    const categoryCases = filteredCases.filter((c) => c.category === cat);
    return categoryCases.length > 0 && categoryCases.every((c) => c.selected);
  };

  const toggleCategorySelection = (cat: string) => {
    const categoryCases = filteredCases.filter((c) => c.category === cat);
    onSelectAll(!isCategoryFullySelected(cat), categoryCases.map((c) => c.name));
  };

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of cases) map[c.category] = (map[c.category] ?? 0) + 1;
    return map;
  }, [cases]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 px-4 sm:px-6 py-4 border-b border-white/[0.06] bg-gray-900/40 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider shrink-0">Category</span>
          <div className="flex flex-wrap gap-1.5">
            {allCategories.map((cat) => {
              const visible = !hiddenCategories.has(cat);
              const allSel = isCategoryFullySelected(cat);
              return (
                <div
                  key={cat}
                  className={`flex items-center gap-0.5 pl-2 pr-1 py-0.5 rounded-full border text-[11px] transition-colors ${
                    visible ? "border-white/10 bg-white/[0.04] text-gray-200" : "border-white/[0.04] bg-transparent text-gray-600"
                  }`}
                >
                  <span className="truncate max-w-[120px]">{cat}</span>
                  <span className="text-gray-600 text-[10px] ml-0.5">{categoryCounts[cat] ?? 0}</span>
                  <button
                    onClick={() => toggleCategoryVisibility(cat)}
                    title={visible ? "Hide category" : "Show category"}
                    className={`ml-0.5 p-0.5 rounded transition-colors ${visible ? "text-gray-400 hover:text-white" : "text-gray-700 hover:text-gray-400"}`}
                  >
                    {visible ? <Eye size={11} /> : <EyeOff size={11} />}
                  </button>
                  {visible && (
                    <button
                      onClick={() => toggleCategorySelection(cat)}
                      title={allSel ? "Deselect category" : "Select all in category"}
                      className="p-0.5 rounded transition-colors"
                      style={{ color: allSel ? "var(--accent-bright)" : "var(--color-gray-700)" }}
                    >
                      {allSel ? <CheckSquare size={11} /> : <Square size={11} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</span>
            {(["all", "not-started", "learning", "learned"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                  statusFilter === s ? STATUS_PILL_ACTIVE[s] : "bg-white/[0.04] text-gray-500 hover:text-gray-300"
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500">
              {selectedCount > 0 ? (
                <span className="font-medium" style={{ color: "var(--accent-bright)" }}>
                  {selectedCount} selected
                </span>
              ) : (
                `${filteredCases.length} cases`
              )}
            </span>
            <button onClick={() => onSelectAll(!allSelected, filteredNames)} className="btn-secondary py-0.5 text-[11px]">
              {allSelected ? "Deselect all" : "Select all"}
            </button>
            {onAddCase && (
              <button onClick={onAddCase} className="btn-secondary py-0.5 text-[11px]">
                <Plus size={11} /> New case
              </button>
            )}

            <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                title="Grid view"
                className={`p-1 rounded transition-colors ${viewMode === "grid" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
              >
                <LayoutGrid size={12} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                title="List view"
                className={`p-1 rounded transition-colors ${viewMode === "list" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
              >
                <List size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {filteredCases.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-600 text-sm">No cases match the current filters.</div>
      ) : viewMode === "grid" ? (
        <div className="px-4 sm:px-6 pb-10">
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))" }}>
            {filteredCases.map((c) => (
              <CaseCard
                key={c.name}
                case_={c}
                groupDisplayConfig={groupDisplayConfig}
                statsSource="training"
                onStatusChange={(status) => {
                  const v = getDefaultVariant(c);
                  if (v) onStatusChange(c.name, v.id, status);
                }}
                onSelectedChange={(selected) => onSelectedChange(c.name, selected)}
                onEdit={() => onEdit(c)}
                onSelect={onPractice ? () => onPractice(c) : undefined}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="pb-10 divide-y divide-white/[0.04]">
          {filteredCases.map((c) => {
            const defV = getDefaultVariant(c);
            const status: LearningStatus = defV?.learningStatus ?? "not-started";
            return (
              <CaseListItem
                key={c.name}
                case_={c}
                groupDisplayConfig={groupDisplayConfig}
                statsSource="training"
                onEdit={() => onEdit(c)}
                onSelect={onPractice ? () => onPractice(c) : undefined}
                left={
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (defV) onStatusChange(c.name, defV.id, STATUS_NEXT[status]);
                    }}
                    title={`Status: ${status} (click to advance)`}
                    className={`p-1 rounded transition-colors shrink-0 ${STATUS_COLOR[status]}`}
                  >
                    {STATUS_ICON[status]}
                  </button>
                }
                right={
                  <input
                    type="checkbox"
                    checked={!!c.selected}
                    onChange={(e) => onSelectedChange(c.name, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 w-3.5 h-3.5 rounded cursor-pointer"
                    style={{ accentColor: "var(--accent)" }}
                  />
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

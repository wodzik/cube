/**
 * GroupTabs — shared, registry-driven group tab row for Practice and Attack.
 * Replaces both pages' old hardcoded group lists (Practice's flat `GROUPS`
 * array, Attack's two-level `ATTACK_TABS` + F2L-slot sub-picker) with one
 * component reading src/services/algGroupRegistry.ts.
 *
 * Practice passes `managementEnabled` (create/import/export/settings/delete
 * live there); Attack renders the same tabs read-only.
 */

import { useEffect, useRef, useState } from "react";
import { Plus, Upload, Settings } from "lucide-react";
import {
  listGroups,
  createGroup,
  importGroup,
  exportGroup,
  deleteGroup,
  updateGroupMeta,
  resolveDisplayConfig,
  resolveStickeringProps,
} from "../services/algGroupRegistry";
import type { AlgGroupMeta, AlgCategory, DisplayConfig } from "../types/algorithm";
import { GroupSettingsModal } from "./GroupSettingsModal";
import { AlgCaseVisualisation } from "./AlgCaseVisualisation";

interface GroupTabsProps {
  activeId: string;
  onSelect: (id: string) => void;
  managementEnabled?: boolean;
  /** Attack-mode filtering: for a subgroup-less group, only show it with availableInAttack !== false; for a group with subgroups, only show it when at least one subgroup opts in (see AlgSubgroup.availableInAttack). */
  attackContext?: boolean;
  /** Rendered at the end of the top (category) row — e.g. the connect-cube panel, so it doesn't end up misaligned against a now-two-row tab block. */
  rightSlot?: React.ReactNode;
}

/** Fixed display order — not a general user-extensible taxonomy, just the 3 folders the group-tab row is split into. */
const CATEGORIES: AlgCategory[] = ["CFOP", "Roux", "Other"];

function groupCategory(g: AlgGroupMeta | undefined): AlgCategory {
  return g?.category ?? "Other";
}

function isAttackAvailable(g: AlgGroupMeta): boolean {
  return g.hasSubgroups ? (g.subgroups ?? []).some((s) => s.availableInAttack === true) : g.availableInAttack !== false;
}

function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function GroupTabs({ activeId, onSelect, managementEnabled = false, attackContext = false, rightSlot }: GroupTabsProps) {
  const [allGroups, setAllGroups] = useState<AlgGroupMeta[]>(() => listGroups());
  const groups = attackContext ? allGroups.filter(isAttackAvailable) : allGroups;
  const categories = attackContext ? CATEGORIES.filter((c) => groups.some((g) => groupCategory(g) === c)) : CATEGORIES;
  const [selectedCategory, setSelectedCategory] = useState<AlgCategory>(() => groupCategory(allGroups.find((g) => g.id === activeId)));
  const [settingsFor, setSettingsFor] = useState<AlgGroupMeta | "new" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // The active group can change from outside a category-tab click (a fresh
  // page mount, a group getting deleted and falling back to another one) —
  // keep the category row in sync with wherever activeId actually landed.
  useEffect(() => {
    const cat = groupCategory(allGroups.find((g) => g.id === activeId));
    setSelectedCategory((prev) => (prev === cat ? prev : cat));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const refresh = () => setAllGroups(listGroups());

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const id = importGroup(text, file.name.replace(/\.json$/i, ""), selectedCategory);
      refresh();
      onSelect(id);
      setImportError(null);
    } catch {
      setImportError(`Couldn't import "${file.name}" — not a recognised JSON file.`);
      setTimeout(() => setImportError(null), 4000);
    }
  };

  const handleExport = (g: AlgGroupMeta) => {
    downloadJson(`${g.id}.json`, exportGroup(g.id));
  };

  const handleDelete = (id: string) => {
    if (!deleteGroup(id)) return;
    refresh();
    setSettingsFor(null);
    if (id === activeId) {
      const next = listGroups()[0];
      if (next) onSelect(next.id);
    }
  };

  const handleSaveSettings = (
    name: string,
    displayConfig: DisplayConfig,
    hasSubgroups: boolean,
    previewAlg: string,
    availableInAttack: boolean,
    category: AlgCategory
  ) => {
    if (settingsFor === "new") {
      const id = createGroup(name, displayConfig, hasSubgroups, previewAlg, category);
      // availableInAttack is meaningless for a subgroup-having group — see AlgSubgroup.availableInAttack.
      if (!hasSubgroups) updateGroupMeta(id, { availableInAttack });
      refresh();
      onSelect(id);
    } else if (settingsFor) {
      const patch: Partial<AlgGroupMeta> = { name, displayConfig, previewAlg, category };
      if (!settingsFor.hasSubgroups) patch.availableInAttack = availableInAttack;
      updateGroupMeta(settingsFor.id, patch);
      refresh();
    }
    setSettingsFor(null);
  };

  const visibleGroups = groups.filter((g) => groupCategory(g) === selectedCategory);

  return (
    <>
      <div className="flex items-center gap-1 shrink-0">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => {
              setSelectedCategory(c);
              // The active group stays selected across a category switch
              // (so its content keeps showing while you browse), UNLESS
              // it isn't even in the category you just switched to — then
              // jump to that category's first group instead of leaving a
              // stale, unrelated group's content on screen with no visible
              // tab to explain it.
              if (groupCategory(allGroups.find((g) => g.id === activeId)) !== c) {
                const first = groups.find((g) => groupCategory(g) === c);
                if (first) onSelect(first.id);
              }
            }}
            className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide rounded-lg transition-colors shrink-0 ${
              selectedCategory === c ? "text-white bg-white/[0.08]" : "text-gray-600 hover:text-gray-300 hover:bg-white/[0.03]"
            }`}
          >
            {c}
          </button>
        ))}
        {rightSlot && <div className="ml-auto shrink-0">{rightSlot}</div>}
      </div>

      <div className="flex items-center gap-1 shrink-0 mt-1">
        {visibleGroups.map((g) => (
          <div key={g.id} className="relative group/tab shrink-0">
            <button
              onClick={() => onSelect(g.id)}
              className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1 text-xs font-semibold rounded-xl transition-all ${
                activeId === g.id ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
              } ${managementEnabled ? "pr-6" : ""}`}
              style={activeId === g.id ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined}
            >
              <span className="w-5 h-5 rounded-md overflow-hidden shrink-0 bg-gray-950/40">
                <GroupTabIcon group={g} />
              </span>
              {g.name}
            </button>
            {managementEnabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSettingsFor(g);
                }}
                title="Group settings (rename, camera/stickering, export, delete)"
                className={`absolute right-0.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-600 hover:text-gray-200 transition-opacity ${
                  activeId === g.id ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover/tab:opacity-100"
                }`}
              >
                <Settings size={11} />
              </button>
            )}
          </div>
        ))}

        {visibleGroups.length === 0 && !managementEnabled && (
          <p className="text-xs text-gray-600 py-1">No {attackContext ? "Attack-enabled " : ""}groups in {selectedCategory}.</p>
        )}

        {managementEnabled && (
          <div className="flex items-center gap-0.5 ml-1 pl-2 border-l border-white/[0.08] shrink-0">
            <button
              onClick={() => setSettingsFor("new")}
              title="New group"
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/[0.04] transition-colors"
            >
              <Plus size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await handleImportFile(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import group from JSON"
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/[0.04] transition-colors"
            >
              <Upload size={14} />
            </button>
          </div>
        )}
      </div>

      {importError && <p className="text-[11px] text-red-400 mt-1">{importError}</p>}

      {settingsFor && (
        <GroupSettingsModal
          group={settingsFor === "new" ? undefined : settingsFor}
          defaultCategory={selectedCategory}
          onSave={handleSaveSettings}
          onDelete={
            settingsFor !== "new" && !settingsFor.isBuiltIn ? () => handleDelete((settingsFor as AlgGroupMeta).id) : undefined
          }
          onExport={settingsFor !== "new" ? () => handleExport(settingsFor as AlgGroupMeta) : undefined}
          onClose={() => setSettingsFor(null)}
        />
      )}
    </>
  );
}

/** Small cube preview for a tab pill — same idea as a case/subgroup card, just tiny. Blank previewAlg -> solved cube. */
function GroupTabIcon({ group }: { group: AlgGroupMeta }) {
  const displayConfig = resolveDisplayConfig(group);
  return (
    <AlgCaseVisualisation
      alg={(group.previewAlg ?? "").replace(/[()]/g, "").replace(/\s+/g, " ").trim()}
      visualization={displayConfig.cardVisualization}
      cameraLatitude={displayConfig.cameraLatitude}
      cameraLongitude={displayConfig.cameraLongitude}
      {...resolveStickeringProps(displayConfig.stickering)}
      className="size-full"
    />
  );
}

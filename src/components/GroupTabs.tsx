/**
 * GroupTabs — shared, registry-driven group tab row for Practice and Attack.
 * Replaces both pages' old hardcoded group lists (Practice's flat `GROUPS`
 * array, Attack's two-level `ATTACK_TABS` + F2L-slot sub-picker) with one
 * component reading src/services/algGroupRegistry.ts.
 *
 * Practice passes `managementEnabled` (create/import/export/settings/delete
 * live there); Attack renders the same tabs read-only.
 */

import { useRef, useState } from "react";
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
import type { AlgGroupMeta, DisplayConfig } from "../types/algorithm";
import { GroupSettingsModal } from "./GroupSettingsModal";
import { AlgCaseVisualisation } from "./AlgCaseVisualisation";

interface GroupTabsProps {
  activeId: string;
  onSelect: (id: string) => void;
  managementEnabled?: boolean;
  /** Attack-mode filtering: only show groups with availableInAttack !== false (per-group setting, editable via GroupSettingsModal — defaults to true unless a group explicitly opts out). */
  attackContext?: boolean;
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

export function GroupTabs({ activeId, onSelect, managementEnabled = false, attackContext = false }: GroupTabsProps) {
  const [allGroups, setAllGroups] = useState<AlgGroupMeta[]>(() => listGroups());
  const groups = attackContext ? allGroups.filter((g) => g.availableInAttack !== false) : allGroups;
  const [settingsFor, setSettingsFor] = useState<AlgGroupMeta | "new" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const refresh = () => setAllGroups(listGroups());

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const id = importGroup(text, file.name.replace(/\.json$/i, ""));
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
    availableInAttack: boolean
  ) => {
    if (settingsFor === "new") {
      const id = createGroup(name, displayConfig, hasSubgroups, previewAlg);
      updateGroupMeta(id, { availableInAttack });
      refresh();
      onSelect(id);
    } else if (settingsFor) {
      updateGroupMeta(settingsFor.id, { name, displayConfig, previewAlg, availableInAttack });
      refresh();
    }
    setSettingsFor(null);
  };

  return (
    <>
      <div className="flex items-center gap-1 shrink-0">
        {groups.map((g) => (
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

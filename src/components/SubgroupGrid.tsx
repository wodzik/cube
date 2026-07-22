/**
 * SubgroupGrid — folder-card browser shown instead of the case list when a
 * group's `hasSubgroups` is true (e.g. ZBLL split into U/L/T/H/Pi/S/AS).
 * Clicking a card drills into it (handled by the caller via onOpen); the "+"
 * card creates a new one.
 */

import { useState } from "react";
import { FolderPlus } from "lucide-react";
import type { AlgSubgroup, DisplayConfig } from "../types/algorithm";
import { addSubgroup, updateSubgroupMeta, deleteSubgroup } from "../services/algGroupRegistry";
import { SubgroupCard } from "./SubgroupCard";
import { SubgroupSettingsModal } from "./SubgroupSettingsModal";

interface SubgroupGridProps {
  groupId: string;
  groupDisplayConfig: DisplayConfig;
  subgroups: AlgSubgroup[];
  onOpen: (subgroupId: string) => void;
  /** Called after any create/edit/delete so the caller (which owns the group meta) can re-fetch it. */
  onChange: () => void;
}

export function SubgroupGrid({ groupId, groupDisplayConfig, subgroups, onOpen, onChange }: SubgroupGridProps) {
  const [editing, setEditing] = useState<AlgSubgroup | "new" | null>(null);

  const handleSave = (name: string, previewAlg: string, availableInAttack: boolean, displayConfig?: Partial<DisplayConfig>) => {
    if (editing === "new") {
      addSubgroup(groupId, { id: crypto.randomUUID(), name, previewAlg, availableInAttack, displayConfig });
    } else if (editing) {
      updateSubgroupMeta(groupId, editing.id, { name, previewAlg, availableInAttack, displayConfig });
    }
    onChange();
    setEditing(null);
  };

  const handleDelete = () => {
    if (editing && editing !== "new") deleteSubgroup(groupId, editing.id);
    onChange();
    setEditing(null);
  };

  return (
    <div className="px-4 sm:px-6 pb-10">
      {subgroups.length === 0 && (
        <p className="text-sm text-gray-600 mb-4">No subgroups yet — create one to start organizing this group into folders.</p>
      )}
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))" }}>
        {subgroups.map((s) => (
          <SubgroupCard
            key={s.id}
            subgroup={s}
            groupDisplayConfig={groupDisplayConfig}
            onOpen={() => onOpen(s.id)}
            onEditSettings={() => setEditing(s)}
          />
        ))}
        <button
          onClick={() => setEditing("new")}
          className="flex flex-col items-center justify-center gap-1.5 aspect-square rounded-xl border border-dashed border-white/10 hover:border-white/20 text-gray-600 hover:text-gray-300 transition-colors"
        >
          <FolderPlus size={20} />
          <span className="text-xs font-medium">New subgroup</span>
        </button>
      </div>

      {editing && (
        <SubgroupSettingsModal
          subgroup={editing === "new" ? undefined : editing}
          groupDisplayConfig={groupDisplayConfig}
          onSave={handleSave}
          onDelete={editing !== "new" ? handleDelete : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

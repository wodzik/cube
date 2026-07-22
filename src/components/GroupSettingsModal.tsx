/**
 * GroupSettingsModal — create a new group, or edit an existing one's display
 * config (what the case cards + cube preview show). Stickering here is
 * still just the "named cubing.js scheme" half of StickeringConfig — the
 * mask picker (composable piece-group checklist) lives in MaskPicker.tsx and
 * is offered as an alternative from here.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Trash2, Download } from "lucide-react";
import type { AlgGroupMeta, DisplayConfig } from "../types/algorithm";
import { DisplayConfigFields } from "./DisplayConfigFields";

interface GroupSettingsModalProps {
  /** undefined = creating a new group. */
  group?: AlgGroupMeta;
  onSave: (name: string, displayConfig: DisplayConfig, hasSubgroups: boolean, previewAlg: string, availableInAttack: boolean) => void;
  onDelete?: () => void;
  onExport?: () => void;
  onClose: () => void;
}

const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  stickering: { kind: "named", value: "full" },
  cardVisualization: "3D",
  cubeVisualization: "3D",
  cameraLatitude: 20,
  cameraLongitude: 20,
};

const inputClass =
  "w-full bg-gray-950/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors";

export function GroupSettingsModal({ group, onSave, onDelete, onExport, onClose }: GroupSettingsModalProps) {
  const [name, setName] = useState(group?.name ?? "");
  const [config, setConfig] = useState<DisplayConfig>(group?.displayConfig ?? DEFAULT_DISPLAY_CONFIG);
  const [hasSubgroups, setHasSubgroups] = useState(group?.hasSubgroups ?? false);
  const [previewAlg, setPreviewAlg] = useState(group?.previewAlg ?? "");
  const [availableInAttack, setAvailableInAttack] = useState(group?.availableInAttack ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSave = name.trim().length > 0;

  // Portalled to <body> — GroupTabs (this modal's usual caller) renders inside
  // TrainLayout's sticky header, which has backdrop-blur-xl. A backdrop-filter
  // ancestor becomes the containing block for `position: fixed` descendants,
  // so without the portal this overlay would be clipped to that header's box
  // instead of the real viewport.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <h2 className="text-white font-semibold text-base">{group ? "Group settings" : "New group"}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">Name</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ZBLL"
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">Preview algorithm</p>
            <input
              type="text"
              value={previewAlg}
              onChange={(e) => setPreviewAlg(e.target.value)}
              placeholder="e.g. R U R' U R U2 R' (optional — blank shows a solved cube)"
              className={`${inputClass} font-mono`}
            />
            <p className="text-[11px] text-gray-600 mt-1">
              A representative case for this group's own tab/folder-card icon — same idea as a case card's preview.
            </p>
          </div>

          {!group && (
            <label className="flex items-center gap-2 text-xs text-gray-300 border-t border-white/[0.06] pt-4">
              <input
                type="checkbox"
                checked={hasSubgroups}
                onChange={(e) => setHasSubgroups(e.target.checked)}
                className="w-3.5 h-3.5 rounded cursor-pointer"
                style={{ accentColor: "var(--accent)" }}
              />
              Organize as subgroups (folders), e.g. ZBLL split by top pattern
            </label>
          )}

          <label className="flex items-center gap-2 text-xs text-gray-300 border-t border-white/[0.06] pt-4">
            <input
              type="checkbox"
              checked={availableInAttack}
              onChange={(e) => setAvailableInAttack(e.target.checked)}
              className="w-3.5 h-3.5 rounded cursor-pointer"
              style={{ accentColor: "var(--accent)" }}
            />
            Available in Attack
          </label>

          {!hasSubgroups && <DisplayConfigFields config={config} onChange={setConfig} />}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-white/[0.06] shrink-0">
          <div className="flex items-center gap-1">
            {onExport && (
              <button
                onClick={onExport}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-200 rounded-xl transition-colors"
              >
                <Download size={14} /> Export
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    return;
                  }
                  onDelete();
                }}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl transition-colors ${
                  confirmDelete ? "text-red-400 bg-red-500/10" : "text-gray-500 hover:text-red-400"
                }`}
              >
                <Trash2 size={14} /> {confirmDelete ? "Click again to delete" : "Delete group"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => canSave && onSave(name.trim(), config, hasSubgroups, previewAlg.trim(), availableInAttack)}
              disabled={!canSave}
              className="btn-primary"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

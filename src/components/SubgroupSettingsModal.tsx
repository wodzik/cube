/**
 * SubgroupSettingsModal — create/edit one subgroup: its name, the setup
 * algorithm used for its folder-card preview, and an optional Advanced
 * display-config override (same fields as GroupSettingsModal's, via
 * DisplayConfigFields) layered on top of the parent group's config.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Trash2 } from "lucide-react";
import type { AlgSubgroup, DisplayConfig } from "../types/algorithm";
import { DisplayConfigFields } from "./DisplayConfigFields";

interface SubgroupSettingsModalProps {
  /** undefined = creating a new subgroup. */
  subgroup?: AlgSubgroup;
  /** The parent group's resolved display config — the baseline this subgroup's override can layer onto. */
  groupDisplayConfig: DisplayConfig;
  onSave: (name: string, previewAlg: string, availableInAttack: boolean, displayConfigOverride?: Partial<DisplayConfig>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const inputClass =
  "w-full bg-gray-950/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors";

export function SubgroupSettingsModal({ subgroup, groupDisplayConfig, onSave, onDelete, onClose }: SubgroupSettingsModalProps) {
  const [name, setName] = useState(subgroup?.name ?? "");
  const [previewAlg, setPreviewAlg] = useState(subgroup?.previewAlg ?? "");
  const [availableInAttack, setAvailableInAttack] = useState(subgroup?.availableInAttack ?? false);
  const [overrideEnabled, setOverrideEnabled] = useState(Boolean(subgroup?.displayConfig));
  const [overrideDraft, setOverrideDraft] = useState<DisplayConfig>(() => ({ ...groupDisplayConfig, ...subgroup?.displayConfig }));
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSave = name.trim().length > 0 && previewAlg.trim().length > 0;

  // Portalled to <body> — see GroupSettingsModal's identical comment: a
  // backdrop-filter ancestor (TrainLayout's sticky header) would otherwise
  // clip this `fixed` overlay to that header's box instead of the viewport.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <h2 className="text-white font-semibold text-base">{subgroup ? "Subgroup settings" : "New subgroup"}</h2>
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
              placeholder="e.g. ZBLL U"
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
              placeholder="e.g. R U R' U R U2 R'"
              className={`${inputClass} font-mono`}
            />
            <p className="text-[11px] text-gray-600 mt-1">A representative case for this folder — shown on its card, same way a case card previews an algorithm.</p>
          </div>

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

          <div className="border-t border-white/[0.06] pt-3">
            <label className="flex items-center gap-2 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={overrideEnabled}
                onChange={(e) => setOverrideEnabled(e.target.checked)}
                className="w-3.5 h-3.5 rounded cursor-pointer"
                style={{ accentColor: "var(--accent)" }}
              />
              Override display for cases in this subgroup
            </label>
            {overrideEnabled && (
              <div className="mt-3">
                <DisplayConfigFields config={overrideDraft} onChange={setOverrideDraft} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-white/[0.06] shrink-0">
          <div>
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
                <Trash2 size={14} /> {confirmDelete ? "Click again to delete" : "Delete subgroup"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => canSave && onSave(name.trim(), previewAlg.trim(), availableInAttack, overrideEnabled ? overrideDraft : undefined)}
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

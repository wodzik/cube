/**
 * CaseAddModal — the "add algorithm" primitive that didn't exist before:
 * a minimal new-case form (name, category, first variant). On save the
 * caller gets the fully-hydrated AlgorithmCase back and typically opens it
 * straight in CaseEdit for further refinement (more variants, advanced
 * display override, …).
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { AlgorithmCase } from "../types/algorithm";

interface CaseAddModalProps {
  groupId: string;
  existingCategories: string[];
  onSave: (newCase: AlgorithmCase) => void;
  onClose: () => void;
}

const inputClass =
  "w-full bg-gray-950/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors";

export function CaseAddModal({ groupId, existingCategories, onSave, onClose }: CaseAddModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(existingCategories[0] ?? "");
  const [algName, setAlgName] = useState("Alg 1");
  const [alg, setAlg] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSave = name.trim().length > 0 && alg.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    const newCase: AlgorithmCase = {
      name: name.trim(),
      category: category.trim() || "Uncategorized",
      algList: [
        {
          id: `${groupId}-new-${Date.now()}`,
          name: algName.trim() || "Alg 1",
          alg: alg.trim(),
          isDefault: true,
          youtubeUrl: youtubeUrl.trim() || undefined,
          times: [],
          ao5: null,
          ao12: null,
          ao100: null,
          bestTime: null,
          learningStatus: "not-started",
        },
      ],
    };
    onSave(newCase);
  }

  // Portalled to <body> — see GroupSettingsModal's identical comment: a
  // backdrop-filter ancestor would otherwise clip this `fixed` overlay to
  // that ancestor's box instead of the real viewport.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <h2 className="text-white font-semibold text-base">New case</h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">Case name</p>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ZBLL U1" className={inputClass} autoFocus />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">Category</p>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. ZBLL U-shape"
              className={inputClass}
              list="case-add-categories"
            />
            <datalist id="case-add-categories">
              {existingCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="border-t border-white/[0.06] pt-3">
            <p className="text-xs font-semibold text-gray-400 mb-1.5">First variant</p>
            <div className="space-y-2">
              <input type="text" value={algName} onChange={(e) => setAlgName(e.target.value)} placeholder="Variant name" className={inputClass} />
              <input
                type="text"
                value={alg}
                onChange={(e) => setAlg(e.target.value)}
                placeholder="Algorithm (e.g. R U R' U')"
                className={`${inputClass} font-mono`}
              />
              <input type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="YouTube URL (optional)" className={inputClass} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/[0.06] shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!canSave} className="btn-primary">
            Add case
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

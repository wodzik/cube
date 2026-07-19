/**
 * CaseEdit — modal editor for a single algorithm case.
 *
 * Lets the user: change which variant is default, edit variant name/alg/
 * YouTube URL, add a new variant, clear a variant's times, delete a
 * non-default variant. The preview cube updates live as the selected
 * variant's algorithm is edited.
 *
 * onSave receives the fully updated AlgorithmCase — the caller persists it
 * via algorithmStore.updateCase().
 *
 * Prev/next navigation (header chevrons + ←/→ keys) jumps to the adjacent
 * case in the caller's list. Like Cancel, it DISCARDS unsaved edits — the
 * caller remounts this component (key= the case name) with the new case.
 * Arrow keys are ignored while typing in an input or while a sub-modal
 * (variant test / playback) is open.
 */

import { useEffect, useState } from "react";
import { X, Star, Trash2, Plus, Check, ChevronLeft, ChevronRight, RotateCcw, ExternalLink, Play, Video } from "lucide-react";
import type { AlgorithmCase, AlgorithmVariant, AlgGroup } from "../types/algorithm";
import { AlgCaseVisualisation } from "./AlgCaseVisualisation";
import { AlgPlaybackModal } from "./AlgPlaybackModal";
import { VariantTest } from "./VariantTest";
import { formatTime } from "../logic/statistics";
import { CAMERA, STICKERING, VISUALIZATION_MODE } from "../logic/algGroupConfig";

interface CaseEditProps {
  case_: AlgorithmCase;
  group: AlgGroup;
  onSave: (updated: AlgorithmCase) => void;
  onClose: () => void;
  /** Jump to the previous case in the list (undefined = at the start). */
  onPrev?: () => void;
  /** Jump to the next case in the list (undefined = at the end). */
  onNext?: () => void;
  /** Shown between the chevrons as "index+1/total". */
  position?: { index: number; total: number };
}

interface NewVariantForm {
  name: string;
  alg: string;
  youtubeUrl: string;
}

const EMPTY_FORM: NewVariantForm = { name: "", alg: "", youtubeUrl: "" };

const inputClass =
  "w-full bg-gray-950/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors";

export function CaseEdit({ case_, group, onSave, onClose, onPrev, onNext, position }: CaseEditProps) {
  const [variants, setVariants] = useState<AlgorithmVariant[]>(() => structuredClone(case_.algList));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState<Partial<AlgorithmVariant>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newForm, setNewForm] = useState<NewVariantForm>(EMPTY_FORM);
  const [confirmClearId, setConfirmClearId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // "Try before you set as default" — opens the VariantTest popup (stacked
  // above this modal) for the picked variant's CURRENT draft algorithm,
  // including unsaved edits.
  const [testingVariant, setTestingVariant] = useState<AlgorithmVariant | null>(null);
  // "Show me how" — animated playback popup for the picked variant.
  const [playbackVariant, setPlaybackVariant] = useState<AlgorithmVariant | null>(null);

  useEffect(() => {
    if (!onPrev && !onNext) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (testingVariant || playbackVariant) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowLeft" && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && onNext) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onPrev, onNext, testingVariant, playbackVariant]);

  const defaultVariant = variants.find((v) => v.isDefault) ?? variants[0];
  const previewAlg = editingId === defaultVariant?.id ? (editBuf.alg ?? defaultVariant.alg) : (defaultVariant?.alg ?? "");
  const cleanPreviewAlg = previewAlg.replace(/[()]/g, "").replace(/\s+/g, " ").trim();

  function setDefault(id: string) {
    setVariants((vs) => vs.map((v) => ({ ...v, isDefault: v.id === id })));
  }

  function startEdit(v: AlgorithmVariant) {
    setEditingId(v.id);
    setEditBuf({ name: v.name, alg: v.alg, youtubeUrl: v.youtubeUrl ?? "" });
  }

  function commitEdit() {
    if (!editingId) return;
    setVariants((vs) => vs.map((v) => (v.id === editingId ? { ...v, ...editBuf } : v)));
    setEditingId(null);
    setEditBuf({});
  }

  function cancelEdit() {
    setEditingId(null);
    setEditBuf({});
  }

  function clearTimes(id: string) {
    if (confirmClearId !== id) {
      setConfirmClearId(id);
      return;
    }
    setVariants((vs) => vs.map((v) => (v.id === id ? { ...v, times: [], ao5: null, ao12: null, ao100: null, bestTime: null } : v)));
    setConfirmClearId(null);
  }

  function deleteVariant(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setVariants((vs) => vs.filter((v) => v.id !== id));
    setConfirmDeleteId(null);
  }

  function addVariant() {
    if (!newForm.name.trim() || !newForm.alg.trim()) return;
    const v: AlgorithmVariant = {
      id: `${group}-custom-${Date.now()}`,
      name: newForm.name.trim(),
      alg: newForm.alg.trim(),
      isDefault: false,
      youtubeUrl: newForm.youtubeUrl.trim() || undefined,
      times: [],
      ao5: null,
      ao12: null,
      ao100: null,
      bestTime: null,
      learningStatus: "not-started",
    };
    setVariants((vs) => [...vs, v]);
    setNewForm(EMPTY_FORM);
    setShowAddForm(false);
  }

  function handleSave() {
    onSave({ ...case_, algList: variants });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-white font-semibold text-base">{case_.name}</h2>
            <p className="text-gray-500 text-xs mt-0.5">{case_.category}</p>
          </div>
          <div className="flex items-center gap-0.5">
            {(onPrev || onNext) && (
              <>
                <button
                  onClick={onPrev}
                  disabled={!onPrev}
                  title="Previous algorithm (←)"
                  className="p-1.5 text-gray-500 hover:text-gray-200 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                {position && (
                  <span className="text-[10px] text-gray-600 font-mono tabular-nums select-none">
                    {position.index + 1}/{position.total}
                  </span>
                )}
                <button
                  onClick={onNext}
                  disabled={!onNext}
                  title="Next algorithm (→)"
                  className="p-1.5 text-gray-500 hover:text-gray-200 disabled:opacity-30 disabled:hover:text-gray-500 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
                <div className="w-px h-5 bg-white/10 mx-1.5" />
              </>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-200 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="hidden sm:flex flex-col items-center gap-3 p-5 border-r border-white/[0.06] w-44 shrink-0">
            <div className="w-36 h-36 rounded-xl overflow-hidden bg-gray-950/50">
              <AlgCaseVisualisation
                alg={cleanPreviewAlg}
                stickering={STICKERING[group]}
                visualization={VISUALIZATION_MODE[group]}
                cameraLatitude={CAMERA[group].latitude}
                cameraLongitude={CAMERA[group].longitude}
                className="size-full"
              />
            </div>
            <p className="text-[10px] text-gray-500 text-center leading-tight font-mono break-all">{previewAlg || "—"}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {variants.map((v) => (
              <VariantRow
                key={v.id}
                variant={v}
                isEditing={editingId === v.id}
                editBuf={editBuf}
                isConfirmClear={confirmClearId === v.id}
                isConfirmDelete={confirmDeleteId === v.id}
                canDelete={variants.length > 1}
                onSetDefault={() => setDefault(v.id)}
                onStartEdit={() => startEdit(v)}
                onCommitEdit={commitEdit}
                onCancelEdit={cancelEdit}
                onEditBufChange={(patch) => setEditBuf((b) => ({ ...b, ...patch }))}
                onClearTimes={() => clearTimes(v.id)}
                onDelete={() => deleteVariant(v.id)}
                onTest={() => setTestingVariant(v)}
                onPlayback={() => setPlaybackVariant(v)}
              />
            ))}

            {showAddForm ? (
              <div className="border border-white/10 rounded-xl p-3 space-y-2">
                <p className="text-xs text-gray-400 font-medium">New variant</p>
                <input
                  type="text"
                  placeholder="Name"
                  value={newForm.name}
                  onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
                <input
                  type="text"
                  placeholder="Algorithm (e.g. R U R' U')"
                  value={newForm.alg}
                  onChange={(e) => setNewForm((f) => ({ ...f, alg: e.target.value }))}
                  className={`${inputClass} font-mono`}
                />
                <input
                  type="url"
                  placeholder="YouTube URL (optional)"
                  value={newForm.youtubeUrl}
                  onChange={(e) => setNewForm((f) => ({ ...f, youtubeUrl: e.target.value }))}
                  className={inputClass}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewForm(EMPTY_FORM);
                    }}
                    className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button onClick={addVariant} disabled={!newForm.name.trim() || !newForm.alg.trim()} className="btn-primary py-1.5">
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-gray-600 hover:text-gray-300 border border-dashed border-white/10 hover:border-white/20 rounded-xl transition-colors"
              >
                <Plus size={14} /> Add variant
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            <Check size={14} /> Save
          </button>
        </div>
      </div>

      {testingVariant && (
        <VariantTest
          caseName={case_.name}
          variantName={testingVariant.name}
          alg={testingVariant.alg.replace(/[()]/g, "")}
          group={group}
          onClose={() => setTestingVariant(null)}
        />
      )}

      {playbackVariant && (
        <AlgPlaybackModal
          title={case_.name}
          subtitle={playbackVariant.name}
          alg={playbackVariant.alg}
          stickering={STICKERING[group]}
          onClose={() => setPlaybackVariant(null)}
        />
      )}
    </div>
  );
}

// ─── VariantRow ───

interface VariantRowProps {
  variant: AlgorithmVariant;
  isEditing: boolean;
  editBuf: Partial<AlgorithmVariant>;
  isConfirmClear: boolean;
  isConfirmDelete: boolean;
  canDelete: boolean;
  onSetDefault: () => void;
  onStartEdit: () => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onEditBufChange: (patch: Partial<AlgorithmVariant>) => void;
  onClearTimes: () => void;
  onDelete: () => void;
  onTest: () => void;
  onPlayback: () => void;
}

function VariantRow({
  variant,
  isEditing,
  editBuf,
  isConfirmClear,
  isConfirmDelete,
  canDelete,
  onSetDefault,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onEditBufChange,
  onClearTimes,
  onDelete,
  onTest,
  onPlayback,
}: VariantRowProps) {
  return (
    <div
      className="rounded-xl border transition-colors"
      style={
        variant.isDefault
          ? { borderColor: "rgba(99,102,241,0.35)", background: "rgba(99,102,241,0.06)" }
          : { borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }
      }
    >
      {isEditing ? (
        <div className="p-3 space-y-2">
          <input
            type="text"
            value={editBuf.name ?? ""}
            onChange={(e) => onEditBufChange({ name: e.target.value })}
            placeholder="Variant name"
            className={inputClass}
          />
          <input
            type="text"
            value={editBuf.alg ?? ""}
            onChange={(e) => onEditBufChange({ alg: e.target.value })}
            placeholder="Algorithm"
            className={`${inputClass} font-mono`}
          />
          <input
            type="url"
            value={(editBuf.youtubeUrl as string) ?? ""}
            onChange={(e) => onEditBufChange({ youtubeUrl: e.target.value })}
            placeholder="YouTube URL (optional)"
            className={inputClass}
          />
          <div className="flex justify-end gap-2">
            <button onClick={onCancelEdit} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Cancel
            </button>
            <button onClick={onCommitEdit} className="flex items-center gap-1 px-3 py-1 text-xs btn-primary">
              <Check size={11} /> Done
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 p-3">
          <button
            onClick={onSetDefault}
            title={variant.isDefault ? "Default variant" : "Set as default"}
            className={`mt-0.5 shrink-0 transition-colors ${variant.isDefault ? "text-amber-400" : "text-gray-700 hover:text-amber-500"}`}
          >
            <Star size={14} fill={variant.isDefault ? "currentColor" : "none"} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white font-medium truncate">{variant.name}</span>
              {variant.youtubeUrl && (
                <a
                  href={variant.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
                  title="Watch on YouTube"
                >
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
            <p className="text-xs text-gray-400 font-mono mt-0.5 break-all leading-relaxed">{variant.alg}</p>
            {variant.times.length > 0 && (
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
                <span>
                  {variant.times.length} solve{variant.times.length !== 1 ? "s" : ""}
                </span>
                {variant.bestTime !== null && (
                  <span>
                    PB <span className="text-emerald-400">{formatTime(variant.bestTime)}</span>
                  </span>
                )}
                {variant.ao5 !== null && (
                  <span>
                    Ao5 <span style={{ color: "var(--accent-bright)" }}>{formatTime(variant.ao5)}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={onPlayback}
              className="p-1.5 text-gray-600 hover:text-white transition-colors"
              title="Show how to perform this algorithm"
            >
              <Video size={13} />
            </button>
            <button
              onClick={onTest}
              className="p-1.5 text-gray-600 hover:text-emerald-400 transition-colors"
              title="Test this variant with your cube (attempts won't be saved)"
            >
              <Play size={13} />
            </button>
            <button onClick={onStartEdit} className="p-1.5 text-gray-600 hover:text-gray-300 transition-colors" title="Edit variant">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>

            {variant.times.length > 0 && (
              <button
                onClick={onClearTimes}
                className={`p-1.5 transition-colors ${isConfirmClear ? "text-amber-400 hover:text-amber-300" : "text-gray-700 hover:text-amber-500"}`}
                title={isConfirmClear ? "Click again to confirm" : "Clear times"}
              >
                <RotateCcw size={13} />
              </button>
            )}

            {canDelete && !variant.isDefault && (
              <button
                onClick={onDelete}
                className={`p-1.5 transition-colors ${isConfirmDelete ? "text-red-400 hover:text-red-300" : "text-gray-700 hover:text-red-500"}`}
                title={isConfirmDelete ? "Click again to delete" : "Delete variant"}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

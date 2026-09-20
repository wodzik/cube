/**
 * Session switching + editing for SolvePage — each StoredSession carries its
 * own input method, starting stage, and inspection rule (see types/solve.ts).
 *
 * SessionPicker: header dropdown to switch/create/edit/delete. The "Custom
 * Scrambles" session (see solveStore.ensureCustomScramblesSession) is always
 * listed so its solves can be reviewed, but has no edit/delete controls —
 * pasted/reused scrambles route there automatically regardless of whichever
 * session is active, so its settings are never user-facing.
 *
 * SessionEditModal: create/edit form, styled like CaseEdit.tsx's modal.
 */

import { useEffect, useRef, useState } from "react";
import { Box, Check, ChevronDown, Keyboard, Pencil, Plus, Settings, Timer, Trash2, X } from "lucide-react";
import type { SolveMethod, StartingStage, StoredSession } from "../types/solve";
import type { InputMethod } from "../types/session";
import { CUSTOM_SCRAMBLES_SESSION_NAME } from "../services/solveStore";
import { useT } from "../i18n/useT";
import type { MessageKey } from "../i18n/i18n";

type StoredSolveMethod = Exclude<SolveMethod, "unknown">;

const INPUT_METHOD_ICONS: Record<InputMethod, React.ReactNode> = {
  cube: <Box size={12} />,
  spacebar: <Keyboard size={12} />,
  timer: <Timer size={12} />,
};

const STARTING_STAGE_LABELS: Record<StartingStage, MessageKey> = {
  scratch: "session.stage.scratch",
  cross: "session.stage.cross",
  f2l: "session.stage.f2l",
  oll: "session.stage.oll",
  pll: "session.stage.pll",
};

// ─── SessionPicker ───

interface SessionPickerProps {
  sessions: StoredSession[];
  activeSessionId: string;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onEdit: (session: StoredSession) => void;
  onDelete: (session: StoredSession) => void;
}

export function SessionPicker({ sessions, activeSessionId, onSwitch, onCreate, onEdit, onDelete }: SessionPickerProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setConfirmDeleteId(null);
  }, [open]);

  // Custom Scrambles never counts toward "last real session left" — it isn't
  // meant to be the sole session someone practices in.
  const canDeleteAny = sessions.filter((s) => s.name !== CUSTOM_SCRAMBLES_SESSION_NAME).length > 1;

  const isActiveCustom = active?.name === CUSTOM_SCRAMBLES_SESSION_NAME;

  if (!active) return null;

  return (
    <div ref={rootRef} className="relative flex items-center gap-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
        title={t("session.switch")}
      >
        {INPUT_METHOD_ICONS[active.inputMethod]}
        <span className="max-w-[9rem] truncate">{active.name}</span>
        <span className="text-[10px] font-medium text-[var(--accent-bright)]/80 shrink-0">{active.solveMethod}</span>
        {active.startingStage !== "scratch" && (
          <span className="text-[10px] font-medium text-amber-400/80 shrink-0">{t(STARTING_STAGE_LABELS[active.startingStage])}</span>
        )}
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Direct shortcut to edit the ACTIVE session's settings — no need to
          open the dropdown first. Custom Scrambles has no user-facing
          settings (see file header), so it's skipped here too. */}
      {!isActiveCustom && (
        <button
          onClick={() => onEdit(active)}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors"
          title={t("session.settings")}
        >
          <Settings size={14} />
        </button>
      )}

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-gray-800 border border-white/15 rounded-xl shadow-2xl shadow-black/80 z-50 overflow-hidden">
          <div className="max-h-72 overflow-y-auto py-1">
            {sessions.map((s) => {
              const isCustom = s.name === CUSTOM_SCRAMBLES_SESSION_NAME;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-1 px-2 py-1.5 mx-1 rounded-lg transition-colors ${
                    s.id === activeSessionId ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <button
                    onClick={() => {
                      onSwitch(s.id);
                      setOpen(false);
                    }}
                    className="flex-1 flex items-center gap-2 min-w-0 text-left"
                  >
                    <span className={s.id === activeSessionId ? "text-[var(--accent-bright)]" : "text-gray-500"}>
                      {INPUT_METHOD_ICONS[s.inputMethod]}
                    </span>
                    <span className={`text-xs truncate ${s.id === activeSessionId ? "text-white font-semibold" : "text-gray-300"}`}>{s.name}</span>
                    <span className="text-[9px] text-[var(--accent-bright)]/70 shrink-0">{s.solveMethod}</span>
                    {s.startingStage !== "scratch" && (
                      <span className="text-[9px] text-amber-400/70 shrink-0">{t(STARTING_STAGE_LABELS[s.startingStage])}</span>
                    )}
                  </button>
                  {!isCustom && (
                    <>
                      <button
                        onClick={() => {
                          onEdit(s);
                          setOpen(false);
                        }}
                        className="shrink-0 p-1 text-gray-500 hover:text-gray-200 transition-colors"
                        title={t("session.edit")}
                      >
                        <Pencil size={11} />
                      </button>
                      {canDeleteAny && (
                        <button
                          onClick={() => {
                            if (confirmDeleteId === s.id) {
                              onDelete(s);
                              setConfirmDeleteId(null);
                            } else {
                              setConfirmDeleteId(s.id);
                            }
                          }}
                          className={`shrink-0 p-1 transition-colors ${
                            confirmDeleteId === s.id ? "text-red-400" : "text-gray-500 hover:text-red-500"
                          }`}
                          title={confirmDeleteId === s.id ? t("session.confirmDelete") : t("session.delete")}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => {
              onCreate();
              setOpen(false);
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-400 hover:text-white border-t border-white/[0.06] transition-colors"
          >
            <Plus size={13} /> {t("session.new")}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SessionEditModal ───

interface SessionEditModalProps {
  /** null = create mode. */
  session: StoredSession | null;
  onClose: () => void;
  onSave: (session: StoredSession) => void;
}

const INPUT_METHODS: { id: InputMethod; label: MessageKey; description: MessageKey; icon: React.ReactNode }[] = [
  { id: "cube", label: "session.input.cube", description: "session.input.cube.desc", icon: <Box size={14} /> },
  { id: "spacebar", label: "session.input.spacebar", description: "session.input.spacebar.desc", icon: <Keyboard size={14} /> },
  { id: "timer", label: "session.input.timer", description: "session.input.timer.desc", icon: <Timer size={14} /> },
];

const STARTING_STAGES: { id: StartingStage; label: MessageKey; description: MessageKey }[] = [
  { id: "scratch", label: "session.start.scratch", description: "session.start.scratch.desc" },
  { id: "cross", label: "session.start.cross", description: "session.start.cross.desc" },
  { id: "f2l", label: "session.start.f2l", description: "session.start.f2l.desc" },
  { id: "oll", label: "session.start.oll", description: "session.start.oll.desc" },
  { id: "pll", label: "session.start.pll", description: "session.start.pll.desc" },
];

// Which method drives the live progress bar and gets recorded on the
// solve — chosen here rather than auto-detected (see StoredSession's doc
// comment in types/solve.ts for the future auto-detect/suggestion plan).
// Method names (CFOP, Roux) are not translated; Layer-By-Layer has a Polish name.
const SOLVE_METHODS: { id: StoredSolveMethod; label: MessageKey | null; description: MessageKey }[] = [
  { id: "CFOP", label: null, description: "session.method.cfop.desc" },
  { id: "LBL", label: "session.method.lbl", description: "session.method.lbl.desc" },
  { id: "Roux", label: null, description: "session.method.roux.desc" },
];

const inputClass =
  "w-full bg-gray-950/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[var(--accent)] transition-colors";

export function SessionEditModal({ session, onClose, onSave }: SessionEditModalProps) {
  const { t } = useT();
  const [name, setName] = useState(session?.name ?? "");
  const [inputMethod, setInputMethod] = useState<InputMethod>(session?.inputMethod ?? "cube");
  const [startingStage, setStartingStage] = useState<StartingStage>(session?.startingStage ?? "scratch");
  const [solveMethod, setSolveMethod] = useState<StoredSolveMethod>(session?.solveMethod ?? "CFOP");
  const [inspectionMode, setInspectionMode] = useState<"wca" | "custom" | "unlimited">(session?.inspectionMode ?? "wca");
  // Kept as a string while editing so the field can be temporarily empty/mid-edit; validated on save.
  const [customSeconds, setCustomSeconds] = useState(String(session?.customInspectionSeconds ?? 15));
  const [moveCountOnly, setMoveCountOnly] = useState(session?.moveCountOnly ?? false);

  const parsedCustomSeconds = Math.floor(Number(customSeconds));
  const customSecondsValid = Number.isFinite(parsedCustomSeconds) && parsedCustomSeconds >= 1 && parsedCustomSeconds <= 120;
  const canSave = name.trim().length > 0 && (inspectionMode !== "custom" || customSecondsValid);

  function handleSave() {
    if (!canSave) return;
    onSave({
      id: session?.id ?? crypto.randomUUID(),
      name: name.trim(),
      inspectionMode,
      customInspectionSeconds: inspectionMode === "custom" ? parsedCustomSeconds : (session?.customInspectionSeconds ?? 15),
      inputMethod,
      startingStage,
      solveMethod,
      moveCountOnly,
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md max-h-full flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-white font-semibold text-base">{session ? t("session.edit") : t("session.new")}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">{t("session.field.name")}</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder={t("session.field.namePlaceholder")}
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">{t("session.field.input")}</p>
            <div className="flex flex-col gap-1.5">
              {INPUT_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setInputMethod(m.id)}
                  className={`flex items-start gap-2.5 text-left px-3 py-2 rounded-xl border transition-colors ${
                    inputMethod === m.id ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.08]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/15"
                  }`}
                >
                  <span className={`mt-0.5 shrink-0 ${inputMethod === m.id ? "text-[var(--accent-bright)]" : "text-gray-500"}`}>{m.icon}</span>
                  <span>
                    <span className={`block text-xs font-semibold ${inputMethod === m.id ? "text-white" : "text-gray-300"}`}>{t(m.label)}</span>
                    <span className="block text-[11px] text-gray-500 mt-0.5 leading-snug">{t(m.description)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">{t("session.field.start")}</p>
            <div className="flex flex-col gap-1.5">
              {STARTING_STAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStartingStage(s.id)}
                  className={`text-left px-3 py-2 rounded-xl border transition-colors ${
                    startingStage === s.id ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.08]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/15"
                  }`}
                >
                  <span className={`block text-xs font-semibold ${startingStage === s.id ? "text-white" : "text-gray-300"}`}>{t(s.label)}</span>
                  <span className="block text-[11px] text-gray-500 mt-0.5 leading-snug">{t(s.description)}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">{t("session.field.method")}</p>
            <p className="text-[11px] text-gray-500 mb-2 leading-snug">
              {t("session.method.hint")}
            </p>
            <div className="flex flex-col gap-1.5">
              {SOLVE_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSolveMethod(m.id)}
                  className={`text-left px-3 py-2 rounded-xl border transition-colors ${
                    solveMethod === m.id ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.08]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/15"
                  }`}
                >
                  <span className={`block text-xs font-semibold ${solveMethod === m.id ? "text-white" : "text-gray-300"}`}>{m.label ? t(m.label) : m.id}</span>
                  <span className="block text-[11px] text-gray-500 mt-0.5 leading-snug">{t(m.description)}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">{t("session.field.inspection")}</p>
            <div className="flex gap-1.5">
              {(
                [
                  { id: "wca", label: t("session.inspection.wca") },
                  { id: "custom", label: t("session.inspection.custom") },
                  { id: "unlimited", label: t("session.inspection.none") },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setInspectionMode(m.id)}
                  className={`flex-1 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                    inspectionMode === m.id
                      ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.08] text-white"
                      : "border-white/[0.06] bg-white/[0.02] text-gray-300 hover:border-white/15"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {inspectionMode === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={customSeconds}
                  onChange={(e) => setCustomSeconds(e.target.value)}
                  className={`${inputClass} w-24`}
                />
                <span className="text-xs text-gray-500">{t("session.inspection.seconds")}</span>
                {!customSecondsValid && <span className="text-xs text-red-400">{t("session.inspection.invalid")}</span>}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">{t("session.field.display")}</p>
            <div className="flex gap-1.5">
              {(
                [
                  { id: false, label: t("session.display.time") },
                  { id: true, label: t("session.display.moves") },
                ] as const
              ).map((m) => (
                <button
                  key={String(m.id)}
                  onClick={() => setMoveCountOnly(m.id)}
                  className={`flex-1 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                    moveCountOnly === m.id
                      ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.08] text-white"
                      : "border-white/[0.06] bg-white/[0.02] text-gray-300 hover:border-white/15"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-2 leading-snug">
              {t("session.display.hint")}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
            {t("common.cancel")}
          </button>
          <button onClick={handleSave} disabled={!canSave} className="btn-primary">
            <Check size={14} /> {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

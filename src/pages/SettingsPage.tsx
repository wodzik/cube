/**
 * SettingsPage — defaults, data reset, export/import.
 *
 * localStorage-only app (no backend), so "backup" is just a JSON export of
 * every key this app writes — kept in one place here rather than scattered
 * across services, since it's the only thing that needs to know about all
 * of them at once.
 */

import { useRef, useState } from "react";
import { RotateCcw, Trash2, Download, Upload, CheckCircle2 } from "lucide-react";
import { listGroups, resetBuiltInGroup } from "../services/algGroupRegistry";
import { LANGS, setLang } from "../i18n/i18n";
import { useT } from "../i18n/useT";

const ALL_KEYS_PREFIXES = ["nact_solves", "nact_sessions", "alg_group_", "attack_sessions_", "nact_alg_groups"];

function allNactKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && ALL_KEYS_PREFIXES.some((p) => key.startsWith(p))) keys.push(key);
  }
  return keys;
}

function exportData(): void {
  const data: Record<string, unknown> = {};
  for (const key of allNactKeys()) {
    try {
      data[key] = JSON.parse(localStorage.getItem(key) ?? "null");
    } catch {
      // skip unparsable entries
    }
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `act-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importData(file: File): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text) as Record<string, unknown>;
  for (const [key, value] of Object.entries(data)) {
    if (ALL_KEYS_PREFIXES.some((p) => key.startsWith(p))) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }
}

function SettingsRow({
  title,
  description,
  action,
  last = false,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-4 ${last ? "" : "border-b border-white/[0.06]"}`}>
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5 max-w-md">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">{title}</h2>
      <div className="panel px-5">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { lang, t } = useT();

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2500);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 pt-12 pb-24">
      <h1 className="text-2xl font-extrabold text-white mb-1">{t("settings.title")}</h1>
      <p className="text-sm text-gray-500 mb-8">{t("settings.subtitle")}</p>

      {message && (
        <div className="mb-5 flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
          <CheckCircle2 size={15} />
          {message}
        </div>
      )}

      <Section title={t("settings.section.language")}>
        <SettingsRow
          title={t("settings.language.title")}
          description={t("settings.language.description")}
          last
          action={
            <div className="nav-pill">
              {LANGS.map((l) => (
                <button key={l.id} onClick={() => setLang(l.id)} className={`nav-tab ${lang === l.id ? "nav-tab-active" : "nav-tab-inactive"}`}>
                  {l.name}
                </button>
              ))}
            </div>
          }
        />
      </Section>

      <Section title={t("settings.section.algProgress")}>
        <SettingsRow
          title={t("settings.algProgress.title")}
          description={t("settings.algProgress.description")}
          last
          action={
            <button
              onClick={() => {
                listGroups()
                  .filter((g) => g.isBuiltIn)
                  .forEach((g) => resetBuiltInGroup(g.id));
                flash(t("settings.algProgress.done"));
              }}
              className="btn-danger"
            >
              <RotateCcw size={13} /> {t("settings.algProgress.button")}
            </button>
          }
        />
      </Section>

      <Section title={t("settings.section.history")}>
        <SettingsRow
          title={t("settings.history.title")}
          description={t("settings.history.description")}
          last
          action={
            <button
              onClick={() => {
                localStorage.removeItem("nact_solves");
                localStorage.removeItem("nact_sessions");
                flash(t("settings.history.done"));
              }}
              className="btn-danger"
            >
              <Trash2 size={13} /> {t("settings.history.button")}
            </button>
          }
        />
      </Section>

      <Section title={t("settings.section.backup")}>
        <SettingsRow
          title={t("settings.export.title")}
          description={t("settings.export.description")}
          action={
            <button onClick={exportData} className="btn-secondary">
              <Download size={13} /> {t("settings.export.button")}
            </button>
          }
        />
        <SettingsRow
          title={t("settings.import.title")}
          description={t("settings.import.description")}
          last
          action={
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    await importData(file);
                    flash(t("settings.import.done"));
                  } catch {
                    flash(t("settings.import.failed"));
                  }
                  e.target.value = "";
                }}
              />
              <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
                <Upload size={13} /> {t("settings.import.button")}
              </button>
            </>
          }
        />
      </Section>
    </div>
  );
}

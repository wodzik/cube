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
  a.download = `nact-backup-${new Date().toISOString().slice(0, 10)}.json`;
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

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 2500);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 pt-12 pb-24">
      <h1 className="text-2xl font-extrabold text-white mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">Data is stored locally in this browser only — no account, no backend.</p>

      {message && (
        <div className="mb-5 flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
          <CheckCircle2 size={15} />
          {message}
        </div>
      )}

      <Section title="Algorithm progress">
        <SettingsRow
          title="Reset all algorithm progress"
          description="Clears learning status and recorded times for every built-in F2L/OLL/PLL case, reloads from defaults. Custom groups are left alone."
          last
          action={
            <button
              onClick={() => {
                listGroups()
                  .filter((g) => g.isBuiltIn)
                  .forEach((g) => resetBuiltInGroup(g.id));
                flash("Algorithm progress reset.");
              }}
              className="btn-danger"
            >
              <RotateCcw size={13} /> Reset
            </button>
          }
        />
      </Section>

      <Section title="Solve history">
        <SettingsRow
          title="Clear all solve history"
          description="Deletes every recorded solve and session. Algorithm times are not affected."
          last
          action={
            <button
              onClick={() => {
                localStorage.removeItem("nact_solves");
                localStorage.removeItem("nact_sessions");
                flash("Solve history cleared.");
              }}
              className="btn-danger"
            >
              <Trash2 size={13} /> Clear
            </button>
          }
        />
      </Section>

      <Section title="Backup">
        <SettingsRow
          title="Export data"
          description="Downloads solve history, sessions, and algorithm progress as a JSON file."
          action={
            <button onClick={exportData} className="btn-secondary">
              <Download size={13} /> Export
            </button>
          }
        />
        <SettingsRow
          title="Import data"
          description="Restores from a previously exported JSON file. Overwrites existing data with matching keys."
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
                    flash("Data imported — reload the page to see it.");
                  } catch {
                    flash("Import failed — file was not valid JSON.");
                  }
                  e.target.value = "";
                }}
              />
              <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
                <Upload size={13} /> Import
              </button>
            </>
          }
        />
      </Section>
    </div>
  );
}

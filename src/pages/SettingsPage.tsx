/**
 * SettingsPage — defaults, data reset, export/import.
 *
 * localStorage-only app (no backend), so "backup" is just a JSON export of
 * every key this app writes — kept in one place here rather than scattered
 * across services, since it's the only thing that needs to know about all
 * of them at once.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Trash2, Download, Upload, CheckCircle2, Bluetooth } from "lucide-react";
import { type KnownCube, cubeName, forgetCube, listCubes, onCubesChange, updateCube } from "../services/cubeRegistry";
import { getSolves } from "../services/solveStore";
import { getTrainerAttempts } from "../services/trainerStore";
import { useSmartCubeConnection } from "../hooks/useSmartCube";
import { type ArrowShape, useTurnArrows } from "../hooks/useTurnArrows";
import { listGroups, resetBuiltInGroup } from "../services/algGroupRegistry";
import { useCubeLook, type CubeLook, type SkinName } from "../hooks/useCubeLook";
import { CubeVisualisation } from "../components/CubeVisualisation";

/** Names for the skins (cubecore presets). */
const SKIN_LABELS: Record<SkinName, string> = {
  default: "Default — stickerless",
  gan: "GAN — stickerless",
  qiyiSC: "QiYi Smart Cube",
  moyu: "MoYu (WCU) — stickerless",
  defaultStickers: "Default — stickers",
  ganStickers: "GAN — stickers",
  moyuStickers: "MoYu — stickers",
  qiyiStickersRounded: "QiYi — black, rounded",
  qiyiStickersSquare: "QiYi — black, square",
};
const STICKERS: [CubeLook["stickers"], string][] = [["", "As the skin is"], ["raised", "Stickered: raised"], ["thin", "Stickered: thin"], ["flat", "Stickered: flat print"]];
const FINISHES: [CubeLook["finish"], string][] = [["", "The skin's own"], ["matte", "Matte"], ["uv", "UV-coated (glossy)"]];

const selectClass = "bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white";

function CubeLookSection() {
  const { look, setLook, autoSkin, cubeLook } = useCubeLook();
  return (
    <Section title="Cube look">
      <div className="flex gap-5 py-4 border-b border-white/[0.06] items-center">
        <div className="size-40 shrink-0">
          <CubeVisualisation cameraLatitude={28} cameraLongitude={32} />
        </div>
        <p className="text-xs text-gray-500">
          How the cube is drawn everywhere in the app. <strong className="text-gray-300">Auto</strong> picks the skin that suits the
          connected smart cube (GAN, QiYi, MoYu…) by its name — now: {SKIN_LABELS[autoSkin]}.
          {cubeLook && (
            <span className="block mt-1.5 text-sky-300/80">The connected cube has its own look (My cubes, below) — that's what's drawn now.</span>
          )}
        </p>
      </div>
      <SettingsRow
        title="Skin"
        description="The cube's shapes and colours."
        action={
          <select className={selectClass} value={look.skin} onChange={(e) => setLook({ skin: e.target.value as CubeLook["skin"] })}>
            <option value="auto">Auto — the connected cube</option>
            {(Object.keys(SKIN_LABELS) as SkinName[]).map((k) => (
              <option key={k} value={k}>
                {SKIN_LABELS[k]}
              </option>
            ))}
          </select>
        }
      />
      <SettingsRow
        title="Stickers"
        description="Show the same cube with stickers on black plastic."
        action={
          <select className={selectClass} value={look.stickers} onChange={(e) => setLook({ stickers: e.target.value as CubeLook["stickers"] })}>
            {STICKERS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        }
      />
      <SettingsRow
        title="Finish"
        description="Matte or glossy plastic."
        last
        action={
          <select className={selectClass} value={look.finish} onChange={(e) => setLook({ finish: e.target.value as CubeLook["finish"] })}>
            {FINISHES.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        }
      />
    </Section>
  );
}

/** Turn arrows: on / off (also by the cube) and their shape. */
function TurnArrowsSection() {
  const { arrows, toggleArrows, shape, setShape } = useTurnArrows();
  return (
    <Section title="Turn arrows">
      <SettingsRow
        title="Show turn arrows"
        description="While a smart cube is connected: the next move of the scramble or algorithm drawn on the 3D cube — and the way back after a slip (red), or the right face turned the wrong way (orange). Also switched by the cube."
        action={
          <button onClick={toggleArrows} className={selectClass}>
            {arrows ? "On" : "Off"}
          </button>
        }
      />
      <SettingsRow
        title="Arrow shape"
        description="Ribbons along the faces, round the cube's edges — or round arcs clear of the corners."
        last
        action={
          <select className={selectClass} value={shape} onChange={(e) => setShape(e.target.value as ArrowShape)}>
            <option value="box">Along the edges</option>
            <option value="circle">Round</option>
          </select>
        }
      />
    </Section>
  );
}

/** A select value for "follow the app's setting" (no per-cube value). */
const APP = "__app";

/**
 * The smart cubes this browser has connected (remembered on every
 * connection): a name of your own and a look per cube — each part either
 * its own or the app's (Cube look, above).
 */
function MyCubesSection() {
  const [cubes, setCubes] = useState<KnownCube[]>(listCubes);
  useEffect(() => onCubesChange(() => setCubes(listCubes())), []);
  const connectedId = useSmartCubeConnection()?.cubeId ?? null;
  const [confirmForget, setConfirmForget] = useState<string | null>(null);
  // Records per cube (solves + trainer attempts) — so you know what a cube's history holds.
  const counts = useMemo(() => {
    const n = new Map<string, number>();
    for (const r of [...getSolves(), ...getTrainerAttempts()]) if (r.cube) n.set(r.cube, (n.get(r.cube) ?? 0) + 1);
    return n;
  }, []);
  const sorted = [...cubes].sort((a, b) => b.lastSeen - a.lastSeen);

  const setLookPart = (c: KnownCube, part: keyof CubeLook, value: string) => {
    const look = { ...c.look, [part]: value === APP ? undefined : value };
    updateCube(c.id, { look });
  };

  return (
    <Section title="My cubes">
      {sorted.length === 0 ? (
        <p className="py-4 text-xs text-gray-500">No cube connected yet — every smart cube you connect is remembered here, with its own settings.</p>
      ) : (
        sorted.map((c, i) => (
          <div key={c.id} className={`py-4 flex flex-col gap-3 ${i < sorted.length - 1 ? "border-b border-white/[0.06]" : ""}`}>
            <div className="flex items-center gap-3">
              <Bluetooth size={15} className={connectedId === c.id ? "text-emerald-400" : "text-gray-600"} />
              <input
                className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-white/10 focus:border-white/20 text-sm font-semibold text-white outline-none"
                defaultValue={c.label ?? ""}
                placeholder={c.deviceName}
                onBlur={(e) => updateCube(c.id, { label: e.target.value.trim() || undefined })}
                title="Your name for this cube"
              />
              {connectedId === c.id && <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">connected</span>}
              <button
                onClick={() => {
                  if (confirmForget === c.id) {
                    forgetCube(c.id);
                    setConfirmForget(null);
                  } else setConfirmForget(c.id);
                }}
                className={`p-1.5 transition-colors ${confirmForget === c.id ? "text-red-400" : "text-gray-600 hover:text-red-500"}`}
                title={confirmForget === c.id ? "Click again to forget this cube (its records stay)" : "Forget this cube"}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <p className="text-[11px] text-gray-500 -mt-1">
              {c.deviceName} · {c.protocol} · last used {new Date(c.lastSeen).toLocaleDateString()} · {counts.get(c.id) ?? 0} records
            </p>
            <div className="flex flex-wrap gap-2">
              <select className={selectClass} value={c.look?.skin ?? APP} onChange={(e) => setLookPart(c, "skin", e.target.value)} title="Skin for this cube">
                <option value={APP}>Skin: app setting</option>
                <option value="auto">Auto — by its name</option>
                {(Object.keys(SKIN_LABELS) as SkinName[]).map((k) => (
                  <option key={k} value={k}>
                    {SKIN_LABELS[k]}
                  </option>
                ))}
              </select>
              <select className={selectClass} value={c.look?.stickers ?? APP} onChange={(e) => setLookPart(c, "stickers", e.target.value)} title="Stickers for this cube">
                <option value={APP}>Stickers: app setting</option>
                {STICKERS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              <select className={selectClass} value={c.look?.finish ?? APP} onChange={(e) => setLookPart(c, "finish", e.target.value)} title="Finish for this cube">
                <option value={APP}>Finish: app setting</option>
                {FINISHES.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))
      )}
    </Section>
  );
}

const ALL_KEYS_PREFIXES = [
  "nact_solves",
  "nact_sessions",
  "alg_group_",
  "attack_sessions_",
  "nact_alg_groups",
  "nact_cube_look",
  "nact_cubes",
  "nact_trainer_attempts",
  "nact_bld_times",
  "nact_turn_arrows",
];

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

      <CubeLookSection />
      <MyCubesSection />
      <TurnArrowsSection />

      <Section title="Algorithm progress">
        <SettingsRow
          title="Reset all algorithm progress"
          description="Clears learning status and recorded times for every built-in group (OLL, PLL, F2L, Advanced F2L, VLS, ZBLL, CMLL, COLL, …) and reloads its cases from the bundled defaults. Custom groups are left alone."
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

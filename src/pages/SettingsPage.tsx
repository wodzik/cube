/**
 * SettingsPage — defaults, data reset, export/import.
 *
 * localStorage-only app (no backend), so "backup" is just a JSON export of
 * every key this app writes — kept in one place here rather than scattered
 * across services, since it's the only thing that needs to know about all
 * of them at once.
 */

import { PageLabel } from "../components/PageLabel";
import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Trash2, Download, Upload, CheckCircle2, Bluetooth, ChevronDown } from "lucide-react";
import { SKINS } from "@wodzik/cubecore/render";
import { skinForCube } from "@wodzik/cubecore/bluetooth";
import { type KnownCube, cubeName, forgetCube, listCubes, onCubesChange, updateCube } from "../services/cubeRegistry";
import { getSolves } from "../services/solveStore";
import { APP_LOGO, type StoredLogo, addLogo, listLogos, onLogosChange, removeLogo } from "../services/logoStore";
import { getTrainerAttempts } from "../services/trainerStore";
import { useSmartCubeConnection } from "../hooks/useSmartCube";
import { type ArrowMode, useTurnArrows } from "../hooks/useTurnArrows";
import { listGroups, resetBuiltInGroup } from "../services/algGroupRegistry";
import { lookForCube, resolveSkin, useCubeLook, type CubeLook, type SkinName } from "../hooks/useCubeLook";
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
      <div className="flex flex-col sm:flex-row gap-5 py-4 border-b border-white/[0.06] sm:items-center">
        <div className="size-40 shrink-0 self-center sm:self-auto">
          <CubeVisualisation cameraLatitude={28} cameraLongitude={32} />
        </div>
        <p className="text-xs text-gray-500">
          How the cube is drawn everywhere in the app. <strong className="text-gray-300">Auto</strong> picks the skin that suits the
          connected smart cube (GAN, QiYi, MoYu…) by its name — now: {SKIN_LABELS[autoSkin]}. With a cube connected it always gets the skin that suits it, unless you gave it its own (My cubes).
          {cubeLook && (
            <span className="block mt-1.5 text-sky-300/80">The connected cube has its own look (My cubes, below) — that's what's drawn now.</span>
          )}
        </p>
      </div>
      <SettingsRow
        title="Skin"
        description="The cube's shapes and colours when no smart cube is connected — a connected cube gets the skin that suits it (or its own, in My cubes)."
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
      <LogoRow value={look.logo} onChange={(logo) => setLook({ logo })} />
    </Section>
  );
}

/** Turn arrows: off, round, or along the edges (also switched by the cube; a cube can have its own). */
function TurnArrowsSection() {
  const { appMode, setAppMode } = useTurnArrows();
  return (
    <Section title="Turn arrows">
      <SettingsRow
        title="Turn arrows"
        description="While a smart cube is connected: the next move of the scramble or algorithm drawn on the 3D cube — and the way back after a slip (red), or the right face turned the wrong way (orange). Also switched by the cube; a cube can have its own (My cubes)."
        last
        action={
          <select className={selectClass} value={appMode} onChange={(e) => setAppMode(e.target.value as ArrowMode)}>
            {ARROW_MODES.map(([v, label]) => (
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

const ARROW_MODES: [ArrowMode, string][] = [["off", "Off"], ["circle", "Round"], ["box", "Along the edges"]];

/** The logos to choose from: the app's, and images added in this browser. */
function useLogos(): StoredLogo[] {
  const [logos, setLogos] = useState(listLogos);
  useEffect(() => onLogosChange(() => setLogos(listLogos())), []);
  return logos;
}

function LogoOptions({ logos }: { logos: StoredLogo[] }) {
  return (
    <>
      <option value="">No logo</option>
      <option value={APP_LOGO}>App logo</option>
      {logos.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </>
  );
}

/** Logo on the white centre: choose, add an image of your own, remove added ones. */
function LogoRow({ value, onChange }: { value: string; onChange: (logo: string) => void }) {
  const logos = useLogos();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <SettingsRow
      title="Logo"
      description={
        <>
          On the white centre. Add an image of your own (e.g. your cube's brand logo) — it stays in this browser only.
          {logos.length > 0 && (
            <span className="flex flex-wrap gap-1.5 mt-2">
              {logos.map((l) => (
                <span key={l.id} className="flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-lg bg-white/[0.04] text-[11px] text-gray-300">
                  <img src={l.image} alt="" className="size-5 object-contain" />
                  {l.name}
                  <button onClick={() => removeLogo(l.id)} className="text-gray-500 hover:text-red-400" title="Remove this logo">
                    <Trash2 size={11} />
                  </button>
                </span>
              ))}
            </span>
          )}
          {error && <span className="block text-red-400 mt-1">{error}</span>}
        </>
      }
      last
      action={
        <div className="flex items-center gap-2">
          <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
            <LogoOptions logos={logos} />
          </select>
          <button onClick={() => input.current?.click()} className="btn-secondary text-xs" title="Add an image as a logo">
            <Upload size={13} /> Add
          </button>
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setError(null);
              try {
                const logo = await addLogo(f);
                onChange(logo.id);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not read the image");
              }
            }}
          />
        </div>
      }
    />
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
  const logos = useLogos();
  const [cubes, setCubes] = useState<KnownCube[]>(listCubes);
  useEffect(() => onCubesChange(() => setCubes(listCubes())), []);
  const connectedId = useSmartCubeConnection()?.cubeId ?? null;
  const [confirmForget, setConfirmForget] = useState<string | null>(null);
  // One cube open at a time: the connected one (or the only one) to begin with.
  const [openId, setOpenId] = useState<string | null>(() => connectedId ?? (cubes.length === 1 ? cubes[0].id : null));
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
          <KnownCubeCard
            key={c.id}
            cube={c}
            last={i === sorted.length - 1}
            connected={connectedId === c.id}
            records={counts.get(c.id) ?? 0}
            logos={logos}
            open={openId === c.id}
            onToggle={() => setOpenId(openId === c.id ? null : c.id)}
            confirmForget={confirmForget === c.id}
            onForget={() => {
              if (confirmForget === c.id) {
                forgetCube(c.id);
                setConfirmForget(null);
              } else setConfirmForget(c.id);
            }}
            onLookPart={(part, value) => setLookPart(c, part, value)}
          />
        ))
      )}
    </Section>
  );
}

/**
 * One remembered cube: its name and records, and — opened — its look laid
 * out exactly like Cube look / Turn arrows above: a preview and the same
 * rows, each either the cube's own or as set above.
 */
function KnownCubeCard({
  cube: c,
  last,
  connected,
  records,
  logos,
  open,
  onToggle,
  confirmForget,
  onForget,
  onLookPart,
}: {
  cube: KnownCube;
  last: boolean;
  connected: boolean;
  records: number;
  logos: StoredLogo[];
  open: boolean;
  onToggle: () => void;
  confirmForget: boolean;
  onForget: () => void;
  onLookPart: (part: keyof CubeLook, value: string) => void;
}) {
  const { look: appLook } = useCubeLook();
  // The skin this cube gets drawn with: its own look over the app's; "auto" = the one that suits it.
  const skin = useMemo(() => {
    const suits = skinForCube({ protocol: { id: c.protocol }, name: c.deviceName });
    const auto = ((Object.keys(SKINS) as SkinName[]).find((k) => SKINS[k] === suits) ?? "default") as SkinName;
    return resolveSkin(lookForCube(appLook, c.look), auto);
  }, [appLook, c.look, c.protocol, c.deviceName]);
  const own = (part: keyof CubeLook) => c.look?.[part];
  return (
    <div className={`py-3 ${last ? "" : "border-b border-white/[0.06]"}`}>
      <div className="flex items-center gap-3">
        <Bluetooth size={15} className={connected ? "text-emerald-400 shrink-0" : "text-gray-600 shrink-0"} />
        <div className="flex-1 min-w-0">
          <input
            className="w-full bg-transparent border-b border-transparent hover:border-white/10 focus:border-white/20 text-sm font-semibold text-white outline-none"
            defaultValue={c.label ?? ""}
            placeholder={c.deviceName}
            onBlur={(e) => updateCube(c.id, { label: e.target.value.trim() || undefined })}
            title="Your name for this cube"
          />
          <p className="text-[11px] text-gray-500 mt-0.5 truncate">
            {c.deviceName} · {c.protocol} · last used {new Date(c.lastSeen).toLocaleDateString()} · {records} records
          </p>
        </div>
        {connected && <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">connected</span>}
        <button onClick={onToggle} className="btn-secondary text-xs" aria-expanded={open} title={open ? "Hide this cube's settings" : "This cube's settings"}>
          Settings <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <button
          onClick={onForget}
          className={`p-1.5 transition-colors ${confirmForget ? "text-red-400" : "text-gray-600 hover:text-red-500"}`}
          title={confirmForget ? "Click again to forget this cube (its records stay)" : "Forget this cube"}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {open && (
        <div className="mt-2 sm:pl-7">
          <div className="flex flex-col sm:flex-row gap-4 py-3 border-b border-white/[0.06] sm:items-center">
            <div className="size-32 shrink-0 self-center sm:self-auto">
              <CubeVisualisation skin={skin} cameraLatitude={28} cameraLongitude={32} />
            </div>
            <p className="text-xs text-gray-500">
              How this cube is drawn while it's connected. Each setting is its own, or <strong className="text-gray-300">as in Cube look</strong> above — the skin by
              default the one that suits it.
            </p>
          </div>
          <SettingsRow
            title="Skin"
            description="Its shapes and colours."
            action={
              <select className={selectClass} value={own("skin") && own("skin") !== "auto" ? own("skin") : APP} onChange={(e) => onLookPart("skin", e.target.value)}>
                <option value={APP}>The one that suits it</option>
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
            description="Stickers on black plastic, or as the skin is."
            action={
              <select className={selectClass} value={own("stickers") ?? APP} onChange={(e) => onLookPart("stickers", e.target.value)}>
                <option value={APP}>As in Cube look</option>
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
            action={
              <select className={selectClass} value={own("finish") ?? APP} onChange={(e) => onLookPart("finish", e.target.value)}>
                <option value={APP}>As in Cube look</option>
                {FINISHES.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            }
          />
          <SettingsRow
            title="Logo"
            description="On the white centre (add images in Cube look)."
            action={
              <select className={selectClass} value={own("logo") ?? APP} onChange={(e) => onLookPart("logo", e.target.value)}>
                <option value={APP}>As in Cube look</option>
                <LogoOptions logos={logos} />
              </select>
            }
          />
          <SettingsRow
            title="Turn arrows"
            description="The next move drawn on the cube."
            last
            action={
              <select
                className={selectClass}
                value={c.arrows ?? APP}
                onChange={(e) => updateCube(c.id, { arrows: e.target.value === APP ? undefined : (e.target.value as ArrowMode) })}
              >
                <option value={APP}>As in Turn arrows</option>
                {ARROW_MODES.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            }
          />
        </div>
      )}
    </div>
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
  "nact_logos",
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
  description: React.ReactNode;
  action: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-x-4 gap-y-2 py-4 ${last ? "" : "border-b border-white/[0.06]"}`}>
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <div className="text-xs text-gray-500 mt-0.5 max-w-md">{description}</div>
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
    <div className="px-4 sm:px-6 py-3 pb-24">
      <PageLabel className="block pt-1.5">Settings</PageLabel>
      <div className="max-w-2xl mx-auto pt-6">
      <p className="text-sm text-gray-500 mb-8">Data is stored locally in this browser only — no account, no backend.</p>

      {message && (
        <div className="mb-5 flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
          <CheckCircle2 size={15} />
          {message}
        </div>
      )}

      <CubeLookSection />
      <TurnArrowsSection />
      <MyCubesSection />

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
    </div>
  );
}

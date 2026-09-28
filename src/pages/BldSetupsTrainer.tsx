/**
 * BldSetupsTrainer (Practice → Blindfolded → Setups) — the letter → setup
 * reflex: a letter comes up (the cube showing its sticker, and the spot it
 * has to go — the swap's), you do ONLY the setup, then undo it and the next
 * letter comes.
 *
 * Any setup counts, not just the table's: the sticker on the swap spot,
 * the buffer and whatever the swap moves on the side untouched
 * (data/bld.ts setupDone — checked in every whole-cube frame, so wide moves
 * are fine). Then the cube must be back where it started (undo) for the
 * next letter.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SCHEMES, asHeld, letterSkin, samePiece } from "@wodzik/cubecore/bld";
import { buildMask, statesEqual, type State } from "@wodzik/cubecore/core";
import { useSmartCube } from "../hooks/useSmartCube";
import { useCubeLook } from "../hooks/useCubeLook";
import { useCubeViewRefs } from "../hooks/useCubeViewRefs";
import { TrainerPanel } from "../components/TrainerPanel";
import { ConnectionPanel } from "../components/ConnectionPanel";
import { formatTimeMs } from "../logic/statistics";
import { BLD_METHODS, type BldMethodId, letterPosition, setupDone, setupLetters, solveLetter, stickerName } from "../data/bld";
import { holdFrame, read, readHold, write } from "./BldLettersTrainer";

const SETTINGS_KEY = "nact_bld_setups";
const TIMES_KEY = "nact_bld_setup_times";

interface Settings {
  method: BldMethodId;
  showSetup: boolean;
}
const DEFAULTS: Settings = { method: "op-edges", showSetup: false };

interface SetupTime {
  at: number;
  method: BldMethodId;
  letter: string;
  recogMs: number;
  execMs: number;
}

interface Prompt {
  method: BldMethodId;
  letter: string;
  shownAt: number;
  start: State | null;
  /** Set up — now undo it. */
  doneAt: number | null;
}

const SWAP_SPOT: Record<BldMethodId, string> = { "op-edges": "UL", "op-corners": "RDF", m2: "UB" };

export function BldSetupsTrainer({ modeSwitch }: { modeSwitch: ReactNode }) {
  const { cubeRef, flatCubeRef } = useCubeViewRefs();
  const { skin } = useCubeLook();
  const [settings, setSettingsState] = useState<Settings>(() => read(SETTINGS_KEY, DEFAULTS));
  const setSettings = (patch: Partial<Settings>) =>
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      write(SETTINGS_KEY, next);
      return next;
    });
  const [hold] = useState(readHold);
  const method = BLD_METHODS[settings.method];
  const [times, setTimes] = useState<SetupTime[]>(() => read<SetupTime[]>(TIMES_KEY, []));
  const [storedPrompt, setPrompt] = useState<Prompt | null>(null);
  const prompt = storedPrompt && storedPrompt.method === settings.method ? storedPrompt : null;
  const [firstMoveAt, setFirstMoveAt] = useState<number | null>(null);
  const [last, setLast] = useState<{ letter: string; recogMs: number; execMs: number } | null>(null);
  const [now, setNow] = useState(0);

  const promptRef = useRef(prompt);
  promptRef.current = prompt;
  const firstMoveRef = useRef(firstMoveAt);
  firstMoveRef.current = firstMoveAt;

  const cube = useSmartCube({
    onMove: (_move, timestamp) => {
      const p = promptRef.current;
      const state = cube.session?.state;
      if (!p?.start || !state) return;
      const held = asHeld(state, hold || undefined);
      if (p.doneAt === null) {
        if (firstMoveRef.current === null) setFirstMoveAt(timestamp);
        if (setupDone(BLD_METHODS[p.method], p.start, held, p.letter)) onSetUp(timestamp);
      } else if (statesEqual(held, p.start)) {
        next();
      }
    },
  });
  const session = cube.session;

  const next = useCallback(() => {
    const letters = setupLetters(BLD_METHODS[settings.method]);
    const prev = promptRef.current?.letter;
    let letter = letters[Math.floor(Math.random() * letters.length)];
    if (letter === prev && letters.length > 1) letter = letters[(letters.indexOf(letter) + 1) % letters.length];
    setPrompt({ method: settings.method, letter, shownAt: performance.now(), start: session ? asHeld(session.state, hold || undefined) : null, doneAt: null });
    setFirstMoveAt(null);
  }, [session, settings.method, hold]);

  const onSetUpRef = useRef<(t: number) => void>(() => undefined);
  const onSetUp = (t: number) => onSetUpRef.current(t);
  onSetUpRef.current = (t: number) => {
    const p = promptRef.current;
    if (!p) return;
    const first = firstMoveRef.current ?? t;
    const result = { letter: p.letter, recogMs: Math.max(0, first - p.shownAt), execMs: Math.max(0, t - first) };
    setLast(result);
    setTimes((prev) => {
      const nextTimes = [{ at: Date.now(), method: p.method, ...result }, ...prev].slice(0, 1000);
      write(TIMES_KEY, nextTimes);
      return nextTimes;
    });
    setPrompt({ ...p, doneAt: t });
  };

  useEffect(() => {
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.method, session]);

  useEffect(() => {
    if (!prompt || prompt.doneAt !== null) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [prompt]);

  // The letter's sticker (bright, lettered) and its piece; the swap spot marked.
  const cubeMask = useMemo(() => {
    if (!prompt) return null;
    const p = letterPosition(method, prompt.letter);
    const dest = method.setupRule.dest;
    return buildMask((f) => {
      if (f.index % 9 === 4 || f.index === p) return "regular";
      if (f.index === dest) return "oriented";
      if (samePiece(method.kind, p, f.index)) return "dim";
      return "ignored";
    }, holdFrame(hold) ?? undefined);
  }, [prompt, method, hold]);
  const cubeSkin = useMemo(() => letterSkin(skin, { scheme: SCHEMES.speffz, rotation: hold || undefined }), [skin, hold]);

  const running = prompt !== null && prompt.doneAt === null && firstMoveAt !== null;
  const timeMs = prompt ? (prompt.doneAt !== null ? (last?.execMs ?? 0) : running ? now - firstMoveAt! : 0) : 0;
  const solution = prompt ? solveLetter(method, prompt.letter) : null;

  const ofMethod = times.filter((t) => t.method === settings.method);
  const recent = ofMethod.slice(0, 50);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const avgTotal = avg(recent.map((t) => t.recogMs + t.execMs));
  const slowest = useMemo(() => {
    const by = new Map<string, number[]>();
    for (const t of ofMethod.slice(0, 300)) by.set(t.letter, [...(by.get(t.letter) ?? []), t.recogMs + t.execMs]);
    return [...by.entries()]
      .map(([letter, xs]) => ({ letter, ms: xs.reduce((a, b) => a + b, 0) / xs.length, n: xs.length }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 8);
  }, [ofMethod]);

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${active ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"}`;
  const chipStyle = (active: boolean) => (active ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined);

  const hintText = !session
    ? "Connect a smart cube to be checked — or do it in your head and press Next"
    : !prompt
      ? null
      : prompt.doneAt !== null
        ? "✓ Set up — now undo it"
        : `Only the setup: bring ${prompt.letter} to ${SWAP_SPOT[settings.method]} (marked) without touching the buffer`;

  return (
    <TrainerPanel
      title="Blindfolded"
      header={
        <div className="w-full overflow-x-auto">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {modeSwitch}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[9px] text-gray-600 uppercase tracking-wider mr-1">Method</span>
              {Object.values(BLD_METHODS).map((m) => (
                <button key={m.id} onClick={() => setSettings({ method: m.id })} className={chip(settings.method === m.id)} style={chipStyle(settings.method === m.id)}>
                  {m.id === "op-edges" ? "Edges (OP)" : m.id === "op-corners" ? "Corners (OP)" : "Edges (M2)"}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-1">
            <button onClick={() => setSettings({ showSetup: !settings.showSetup })} className={chip(settings.showSetup)} style={chipStyle(settings.showSetup)}>
              Setup: {settings.showSetup ? "shown" : "hidden"}
            </button>
            <span className="text-[11px] text-gray-600">
              Speffz · swap spot {SWAP_SPOT[settings.method]} · letters with their own algorithm ({Object.keys(method.direct).join(", ") || "none"}) aren't drilled here
            </span>
          </div>
        </div>
      }
      moves={[]}
      progress={null}
      sequenceContent={
        prompt ? (
          <div className="scramble-card flex flex-col items-center gap-2 py-2">
            <div className="flex items-baseline gap-3">
              <span className={`font-mono font-bold text-6xl ${prompt.doneAt !== null ? "text-emerald-300" : "text-white"}`}>{prompt.letter}</span>
              <span className="text-sm text-gray-500 font-mono">{stickerName(method, prompt.letter)}</span>
            </div>
            {settings.showSetup && solution && (
              <p className="text-xs font-mono text-gray-300">
                <span className="text-sky-300">{solution.setup}</span>
                <span className="text-gray-600 font-sans"> · then {solution.name} · undo </span>
                <span className="text-sky-300">{solution.undo}</span>
              </p>
            )}
          </div>
        ) : undefined
      }
      summary={
        last ? (
          <p className="text-sm text-gray-400 font-mono tabular-nums">
            {last.letter} · recognition {formatTimeMs(last.recogMs)} · setup {formatTimeMs(last.execMs)}
          </p>
        ) : undefined
      }
      timeMs={timeMs}
      timerState={running ? "solving" : prompt?.doneAt !== null && prompt ? "solved" : "idle"}
      hintText={hintText}
      controls={
        <button onClick={() => next()} className="btn-secondary text-xs" title="Another letter (from the cube as it is now)">
          Next letter
        </button>
      }
      cubeRef={cubeRef}
      visualization="3D"
      cubeMask={cubeMask}
      cubeOrientation={holdFrame(hold)}
      cubeSkin={cubeSkin}
      flatCubeRef={flatCubeRef}
      showFlatView
      timesMs={ofMethod.map((t) => t.recogMs + t.execMs).reverse()}
      statsLabel="Setups"
      showAo12={false}
      layout="side"
      statsAside={
        ofMethod.length ? (
          <div className="panel p-5 h-full flex flex-col gap-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Letter → setup</p>
              <p className="text-2xl font-mono tabular-nums font-bold text-white mt-1">{avgTotal !== null ? formatTimeMs(avgTotal) : "—"}</p>
              <p className="text-[11px] text-gray-600">average of the last {recent.length}</p>
            </div>
            {slowest.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Slowest letters</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs font-mono tabular-nums">
                  {slowest.map((s) => (
                    <span key={s.letter} className="text-gray-300">
                      <b className="text-white">{s.letter}</b> {formatTimeMs(s.ms)}
                      {s.n > 1 && <span className="text-gray-600"> ×{s.n}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : undefined
      }
    />
  );
}

/**
 * BldLettersTrainer (Practice → Blindfolded → Letter pairs) — drilling the
 * execution of letter pairs, the way they come in a blindfolded solve: two
 * letters (and the cube with only those stickers showing), you shoot to both
 * — setup, swap, undo — and nothing else may move.
 *
 * No scramble: it's "recognise and execute" from the letters alone (in a
 * real solve you don't look at the cube either). The check is exact: from
 * the cube as it was when the pair came up, the buffer → first → second
 * cycle, every other piece where it was (cubecore bld.swapToTarget). "Undo
 * each pair" follows every pair with the same letters reversed — which puts
 * the cube back, so it stays solved without ever re-solving.
 *
 * Methods: Old Pochmann edges (T-perm), Old Pochmann corners (modified
 * Y-perm), M2 edges — the letters' setups in data/bld.ts.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SCHEMES, asHeld, letterSkin, samePiece, swapToTarget } from "@wodzik/cubecore/bld";
import { FACES, FRAMES, applyMoves, buildMask, solvedState, statesEqual, type State } from "@wodzik/cubecore/core";
import { useSmartCube } from "../hooks/useSmartCube";
import { useCubeLook } from "../hooks/useCubeLook";
import { useCubeViewRefs } from "../hooks/useCubeViewRefs";
import { TrainerPanel } from "../components/TrainerPanel";
import { ConnectionPanel } from "../components/ConnectionPanel";
import { formatTimeMs } from "../logic/statistics";
import { BLD_METHODS, type BldMethodId, letterPosition, solvePair, targetLetters } from "../data/bld";

const SETTINGS_KEY = "nact_bld_letters";
const TIMES_KEY = "nact_bld_letter_times";

interface Settings {
  method: BldMethodId;
  undoPairs: boolean;
  showSolution: boolean;
}
const DEFAULTS: Settings = { method: "op-edges", undoPairs: true, showSolution: false };

export interface PairTime {
  at: number;
  method: BldMethodId;
  pair: string;
  /** Pair shown → first turn. */
  recogMs: number;
  /** First turn → both letters done. */
  execMs: number;
}

interface Prompt {
  first: string;
  second: string;
  /** The reverse of the pair before (Undo each pair). */
  undo: boolean;
  shownAt: number;
  /** The cube as held when it came up (null: no cube). */
  start: State | null;
  /** What it must become. */
  expected: State | null;
}

function read<T extends object>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
    if (v === null) return fallback;
    return Array.isArray(fallback) ? v : { ...fallback, ...v };
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // not persisted
  }
}

/** How the cube is held (the Blindfolded page's own "Hold" setting). */
function readHold(): string {
  return read<{ hold?: string }>("nact_bld", {}).hold ?? "";
}

/** The frame a cube held by `rotation` shows. */
function holdFrame(rotation: string) {
  if (!rotation) return null;
  const rot = applyMoves(solvedState(), rotation);
  const up = FACES[Math.floor(rot[4] / 9)], front = FACES[Math.floor(rot[22] / 9)];
  return FRAMES.find((f) => f.face.U === up && f.face.F === front) ?? null;
}

function randomPair(methodId: BldMethodId, avoid: string | null): [string, string] {
  const method = BLD_METHODS[methodId];
  const letters = targetLetters(method);
  for (let i = 0; i < 50; i++) {
    const a = letters[Math.floor(Math.random() * letters.length)];
    const b = letters[Math.floor(Math.random() * letters.length)];
    if (samePiece(method.kind, letterPosition(method, a), letterPosition(method, b))) continue;
    if (a + b === avoid) continue;
    return [a, b];
  }
  return [letters[0], letters[1]];
}

function expectedAfter(methodId: BldMethodId, start: State, first: string, second: string): State {
  const m = BLD_METHODS[methodId];
  return swapToTarget(swapToTarget(start, m.kind, letterPosition(m, first), m.buffer), m.kind, letterPosition(m, second), m.buffer);
}

export function BldLettersTrainer({ modeSwitch }: { modeSwitch: ReactNode }) {
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
  const [times, setTimes] = useState<PairTime[]>(() => read<PairTime[]>(TIMES_KEY, []));
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [firstMoveAt, setFirstMoveAt] = useState<number | null>(null);
  const [last, setLast] = useState<{ pair: string; recogMs: number; execMs: number } | null>(null);
  const [now, setNow] = useState(0);

  const promptRef = useRef(prompt);
  promptRef.current = prompt;
  const firstMoveRef = useRef(firstMoveAt);
  firstMoveRef.current = firstMoveAt;

  const cube = useSmartCube({
    onMove: (_move, timestamp) => {
      const p = promptRef.current;
      if (!p?.expected) return;
      if (firstMoveRef.current === null) setFirstMoveAt(timestamp);
      // The session's state already includes this move.
      const state = cube.session?.state;
      if (state && statesEqual(asHeld(state, hold || undefined), p.expected)) done(timestamp);
    },
  });
  const session = cube.session;

  /** The next pair — from the cube as it is now. */
  const next = useCallback(
    (reverseOf?: Prompt) => {
      const [first, second] = reverseOf ? [reverseOf.second, reverseOf.first] : randomPair(settings.method, promptRef.current ? promptRef.current.first + promptRef.current.second : null);
      const start = session ? asHeld(session.state, hold || undefined) : null;
      setPrompt({ first, second, undo: !!reverseOf, shownAt: performance.now(), start, expected: start ? expectedAfter(settings.method, start, first, second) : null });
      setFirstMoveAt(null);
    },
    [session, settings.method, hold]
  );

  const doneRef = useRef<(t: number) => void>(() => undefined);
  const done = (t: number) => doneRef.current(t);
  doneRef.current = (t: number) => {
    const p = promptRef.current;
    if (!p) return;
    const first = firstMoveRef.current ?? t;
    const result = { pair: p.first + p.second, recogMs: Math.max(0, first - p.shownAt), execMs: Math.max(0, t - first) };
    setLast(result);
    const entry: PairTime = { at: Date.now(), method: settings.method, ...result };
    setTimes((prev) => {
      const nextTimes = [entry, ...prev].slice(0, 1000);
      write(TIMES_KEY, nextTimes);
      return nextTimes;
    });
    // Undo each pair: the same letters reversed put the cube back.
    next(settings.undoPairs && !p.undo ? p : undefined);
  };

  // A new pair on arrival, on a method change, and when a cube connects (its state is the start).
  useEffect(() => {
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.method, session]);

  // The clock while a pair is up.
  useEffect(() => {
    if (!prompt) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [prompt]);

  // ─── the view: a solved cube, only the buffer and the two letters' stickers showing ───

  const positions = useMemo(
    () => (prompt ? { buffer: method.buffer, first: letterPosition(method, prompt.first), second: letterPosition(method, prompt.second) } : null),
    [prompt, method]
  );
  const cubeMask = useMemo(() => {
    if (!positions) return null;
    const shown = new Set([positions.first, positions.second]);
    return buildMask((f) => {
      if (f.index % 9 === 4 || shown.has(f.index)) return "regular";
      if (f.index === positions.buffer) return "oriented";
      return "ignored";
    }, holdFrame(hold) ?? undefined);
  }, [positions, hold]);
  const cubeSkin = useMemo(() => letterSkin(skin, { scheme: SCHEMES.speffz, rotation: hold || undefined }), [skin, hold]);

  const solution = prompt ? solvePair(method, prompt.first, prompt.second) : null;
  const running = prompt !== null && firstMoveAt !== null;
  const timeMs = prompt ? (running ? now - firstMoveAt! : 0) : 0;

  const ofMethod = times.filter((t) => t.method === settings.method);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const recent = ofMethod.slice(0, 50);
  const avgExec = avg(recent.map((t) => t.execMs));
  const avgRecog = avg(recent.map((t) => t.recogMs));
  // Slowest pairs (their average), from the last 300.
  const slowest = useMemo(() => {
    const by = new Map<string, number[]>();
    for (const t of ofMethod.slice(0, 300)) by.set(t.pair, [...(by.get(t.pair) ?? []), t.recogMs + t.execMs]);
    return [...by.entries()]
      .map(([pair, xs]) => ({ pair, ms: xs.reduce((a, b) => a + b, 0) / xs.length, n: xs.length }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 8);
  }, [ofMethod]);

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${active ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"}`;
  const chipStyle = (active: boolean) => (active ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined);

  const hintText = !session
    ? "Connect a smart cube to be checked — or just say the moves to yourself and press Next"
    : !prompt
      ? null
      : running
        ? "Both letters — the buffer's piece goes to the first, then the second; nothing else moves"
        : prompt.undo
          ? "The same pair reversed — it puts the cube back"
          : "Shoot to both letters";

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
            <button onClick={() => setSettings({ undoPairs: !settings.undoPairs })} className={chip(settings.undoPairs)} style={chipStyle(settings.undoPairs)} title="Every pair is followed by the same letters reversed — the cube goes back to where it was">
              Undo each pair: {settings.undoPairs ? "on" : "off"}
            </button>
            <button onClick={() => setSettings({ showSolution: !settings.showSolution })} className={chip(settings.showSolution)} style={chipStyle(settings.showSolution)} title="The setup, swap and undo for each letter">
              Solution: {settings.showSolution ? "shown" : "hidden"}
            </button>
            <span className="text-[11px] text-gray-600">
              Speffz · buffer {method.bufferLetters[0]} ({method.kind === "corner" ? "ULB" : method.id === "m2" ? "DF" : "UR"}){hold ? " · held as on Blindfolded" : ""}
            </span>
          </div>
        </div>
      }
      moves={[]}
      progress={null}
      sequenceContent={
        prompt ? (
          <div className="scramble-card flex flex-col items-center gap-3 py-2">
            <div className="flex items-center gap-4">
              {prompt.undo && <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300 bg-amber-400/10 rounded px-2 py-0.5">undo</span>}
              <span className="font-mono font-bold text-5xl sm:text-6xl tracking-[0.2em] text-white">
                {prompt.first}
                {prompt.second}
              </span>
            </div>
            {settings.showSolution && solution && (
              <div className="w-full max-w-2xl space-y-1 text-xs font-mono">
                {solution.map((s, i) => (
                  <p key={i} className="text-gray-300">
                    <span className="font-bold text-white mr-2">{s.letter}</span>
                    {s.shotAs && <span className="text-amber-300 mr-2">(as {s.shotAs})</span>}
                    {s.setup && <span className="text-sky-300">{s.setup} </span>}
                    <span>{s.alg}</span>
                    {s.undo && <span className="text-sky-300"> {s.undo}</span>}
                    <span className="text-gray-600 ml-2 font-sans">{s.name}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : undefined
      }
      summary={
        last ? (
          <p className="text-sm text-gray-400 font-mono tabular-nums">
            {last.pair} · recognition {formatTimeMs(last.recogMs)} · execution {formatTimeMs(last.execMs)}
          </p>
        ) : undefined
      }
      timeMs={timeMs}
      timerState={running ? "solving" : "idle"}
      hintText={hintText}
      controls={
        <div className="flex items-center gap-2">
          <button onClick={() => next()} className="btn-secondary text-xs" title="Another pair (from the cube as it is now)">
            Next pair
          </button>
        </div>
      }
      cubeRef={cubeRef}
      visualization="3D"
      cubeMask={cubeMask}
      cubeOrientation={holdFrame(hold)}
      cubeSkin={cubeSkin}
      flatCubeRef={flatCubeRef}
      showFlatView
      timesMs={ofMethod.map((t) => t.recogMs + t.execMs).reverse()}
      statsLabel="Letter pairs"
      showAo12={false}
      layout="side"
      statsAside={
        ofMethod.length ? (
          <div className="panel p-5 h-full flex flex-col gap-4">
            <div className="flex gap-6">
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Recognition</p>
                <p className="text-2xl font-mono tabular-nums font-bold text-white mt-1">{avgRecog !== null ? formatTimeMs(avgRecog) : "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Execution</p>
                <p className="text-2xl font-mono tabular-nums font-bold text-white mt-1">{avgExec !== null ? formatTimeMs(avgExec) : "—"}</p>
              </div>
            </div>
            <p className="text-[11px] text-gray-600 -mt-2">average of the last {recent.length}</p>
            {slowest.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Slowest pairs</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs font-mono tabular-nums">
                  {slowest.map((s) => (
                    <span key={s.pair} className="text-gray-300">
                      <b className="text-white">{s.pair}</b> {formatTimeMs(s.ms)}
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

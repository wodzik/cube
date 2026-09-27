/**
 * BldTrainerPage — blindfolded (Old Pochmann), in the same layout as the
 * trainers and algorithm drills (TrainerPanel).
 *
 * An attempt, as at a competition: a scramble from a SOLVED cube (the
 * official one — with the cube somewhere else, the bar shows the way from
 * where it is to the same scrambled state, as on Solve) → Space starts the
 * timer and the memo (the letters appear where the scramble was) → the
 * first turn starts the execution (memo / execution split) → the cube
 * solved stops it. Cancel → discard or save as DNF.
 *
 * Options (header): letter scheme, how the cube is held, which kind first
 * (edges or corners — cubecore's BldTracker order), the cube view (colours,
 * letters on the stickers, letters only, hidden), the memo letters (shown /
 * each shown once done / hidden), and reading the letters aloud: while
 * solving, Space says the pair due (Web Speech) — blindfolded, you can hear
 * where you are.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "@wodzik/cubecore/element";
import type { CubeBld } from "@wodzik/cubecore/element";
import { FACES, FRAMES, applyMoves, buildMask, solvedState } from "@wodzik/cubecore/core";
import { SCHEMES, letterSkin } from "@wodzik/cubecore/bld";
import { SessionProvider, useSession } from "../state/sessionContext";
import { selectCurrentProgress, selectTracking } from "../state/sessionSelectors";
import { useSmartCube } from "../hooks/useSmartCube";
import { useCubeLook } from "../hooks/useCubeLook";
import { useCubeViewRefs } from "../hooks/useCubeViewRefs";
import { useSolveScramble } from "../hooks/useSolveScramble";
import { useSolvedDetection } from "../hooks/useSolvedDetection";
import { useSpacebar } from "../hooks/useSpacebar";
import { useAnimationTimer } from "../hooks/useAnimationTimer";
import { TrainerPanel } from "../components/TrainerPanel";
import { ConnectionPanel } from "../components/ConnectionPanel";
import { SolveControls } from "../components/SolveControls";
import { activeCubeId, cubeLabel } from "../services/cubeRegistry";
import { formatTimeMs } from "../logic/statistics";
import type { SessionConfig } from "../types/session";

const SETTINGS_KEY = "nact_bld";
const TIMES_KEY = "nact_bld_times";

type Scheme = keyof typeof SCHEMES;
type View = "colours" | "letters" | "lettersOnly" | "hidden";
type Reveal = "all" | "done" | "none";
type Order = "edges" | "corners";

interface Settings {
  scheme: Scheme;
  hold: string;
  order: Order;
  view: View;
  reveal: Reveal;
  speak: boolean;
}
const DEFAULTS: Settings = { scheme: "speffz", hold: "", order: "edges", view: "letters", reveal: "all", speak: false };

interface BldTime {
  at: number;
  memoMs: number;
  execMs: number;
  solved: boolean;
  /** Which smart cube (services/cubeRegistry short id). */
  cube?: string;
}

const HOLDS: readonly (readonly [string, string])[] = [
  ["", "White top"],
  ["x2 y'", "Yellow top"],
];

const CONFIG: SessionConfig = { mode: "solve", startMethod: ["spacebar"], stopMethod: ["cube-solved"], useInspection: false, inspectionSeconds: 15 };

function read<T>(key: string, fallback: T): T {
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

/** The frame a cube held by `rotation` shows (for the view). */
function holdFrame(rotation: string) {
  if (!rotation) return null;
  const rot = applyMoves(solvedState(), rotation);
  const up = FACES[Math.floor(rot[4] / 9)], front = FACES[Math.floor(rot[22] / 9)];
  return FRAMES.find((f) => f.face.U === up && f.face.F === front) ?? null;
}

/** Say something (Web Speech), in the page's language. */
function say(text: string) {
  if (typeof speechSynthesis === "undefined" || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = navigator.language || "en";
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

export default function BldTrainerPage() {
  return (
    <SessionProvider config={CONFIG}>
      <BldInner />
    </SessionProvider>
  );
}

/** Puts an element made outside React into the tree (kept across renders). */
function Mount({ el, className }: { el: HTMLElement; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    host.current?.append(el);
  }, [el]);
  return <div ref={host} className={className} />;
}

function BldInner() {
  const { state, submitCubeMove } = useSession();
  const { cubeRef, flatCubeRef, view } = useCubeViewRefs();
  const cube = useSmartCube({
    onMove: (move, timestamp) => {
      submitCubeMove(move, timestamp);
      view.addMove(move);
    },
  });
  const session = cube.session;
  const { skin } = useCubeLook();
  const { generate, isGenerating, error: scrambleError, official } = useSolveScramble();
  useSolvedDetection();
  const { pressState } = useSpacebar();

  const [settings, setSettingsState] = useState<Settings>(() => read(SETTINGS_KEY, DEFAULTS));
  const setSettings = (patch: Partial<Settings>) =>
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      write(SETTINGS_KEY, next);
      return next;
    });
  const [times, setTimes] = useState<BldTime[]>(() => read<BldTime[]>(TIMES_KEY, []));
  const [last, setLast] = useState<BldTime | null>(null);

  // First scramble.
  useEffect(() => {
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The view follows the real cube from the scramble's start.
  const targetStart = state.target?.start;
  useEffect(() => {
    if (targetStart) view.setState(targetStart);
  }, [targetStart, view]);

  // ─── the letters (cubecore <cube-bld>) ───

  const bld = useMemo(() => {
    const el = document.createElement("cube-bld") as CubeBld;
    el.setAttribute("controls", "none");
    el.className = "act-sequence";
    return el;
  }, []);
  useEffect(() => {
    bld.setAttribute("scheme", settings.scheme);
    if (settings.hold) bld.setAttribute("rotation", settings.hold);
    else bld.removeAttribute("rotation");
    bld.setAttribute("order", settings.order);
    bld.setAttribute("reveal", settings.reveal);
  }, [bld, settings.scheme, settings.hold, settings.order, settings.reveal]);

  // Memo starts with the timer: the letters of the cube as it is then, followed turn by turn.
  const phase = state.phase;
  useEffect(() => {
    if (phase === "active" && session) bld.attach(session);
    else if (phase === "setup" || phase === "idle") bld.detach();
  }, [phase, session, bld]);

  // ─── reading the letters aloud (Space while solving) ───

  const speakRef = useRef(settings.speak);
  speakRef.current = settings.speak;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !speakRef.current || phaseRef.current !== "active") return;
      e.preventDefault();
      const p = bld.progress;
      if (!p || p.complete) return;
      const step = p.steps[p.done];
      if (step.kind === "parity") return say("parity");
      // The pair it belongs to (letters of that kind, in pairs).
      const ofKind = p.steps.map((s, i) => (s.kind === step.kind ? i : -1)).filter((i) => i >= 0);
      const k = ofKind.indexOf(p.done);
      const pair = ofKind.slice(k - (k % 2), k - (k % 2) + 2).map((i) => p.steps[i].letter);
      say(pair.join(" "));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bld]);

  // ─── the result ───

  const record = useCallback(
    (solved: boolean) => {
      if (state.startTime === null) return;
      const end = state.endTime ?? performance.now();
      const firstMove = state.moveLog[0]?.timestamp ?? end;
      const t: BldTime = { at: Date.now(), memoMs: Math.max(0, firstMove - state.startTime), execMs: Math.max(0, end - firstMove), solved, cube: activeCubeId() };
      setTimes((prev) => {
        const next = [t, ...prev].slice(0, 200);
        write(TIMES_KEY, next);
        return next;
      });
      setLast(t);
    },
    [state.startTime, state.endTime, state.moveLog]
  );
  const recordedRef = useRef<number | null>(null);
  useEffect(() => {
    if (state.phase !== "done" || state.endTime === null || recordedRef.current === state.endTime) return;
    recordedRef.current = state.endTime;
    record(true);
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.endTime]);
  // The last result stays until the next scramble is started.
  useEffect(() => {
    if (state.phase === "setup" && state.moveLog.length > 0) setLast(null);
  }, [state.phase, state.moveLog.length]);

  // ─── view ───

  const frame = useMemo(() => holdFrame(settings.hold), [settings.hold]);
  const cubeSkin = useMemo(() => {
    const letters = settings.view === "letters" || settings.view === "lettersOnly";
    return letters ? letterSkin(skin, { scheme: SCHEMES[settings.scheme], rotation: settings.hold || undefined, alwaysShow: settings.view === "lettersOnly" }) : null;
  }, [skin, settings.view, settings.scheme, settings.hold]);
  const cubeMask = useMemo(
    () => (settings.view === "lettersOnly" || settings.view === "hidden" ? buildMask((f) => (f.index % 9 === 4 ? "regular" : "ignored")) : null),
    [settings.view]
  );

  const displaySec = useAnimationTimer(state.startTime, state.endTime, state.phase === "active");
  const firstMoveAt = state.moveLog[0]?.timestamp;
  const timerState = state.phase === "active" ? "solving" : state.phase === "done" ? "solved" : pressState === "armed" ? "armed" : pressState === "holding" ? "holding" : "idle";
  const hintText =
    state.phase === "setup"
      ? "Perform the scramble shown above"
      : state.phase === "ready"
        ? "Space — start the memo (the timer runs)"
        : state.phase === "active"
          ? firstMoveAt !== undefined && state.startTime !== null
            ? `Execution · memo ${formatTimeMs(firstMoveAt - state.startTime)}${settings.speak ? " · Space: say the letters due" : ""}`
            : "Memo — your first turn starts the execution"
          : null;

  const solvedTimes = times.filter((t) => t.solved);
  const successRate = times.length ? Math.round((solvedTimes.length / times.length) * 100) : null;
  const best = solvedTimes.length ? Math.min(...solvedTimes.map((t) => t.memoMs + t.execMs)) : null;

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${active ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"}`;
  const chipStyle = (active: boolean) => (active ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined);
  const group = (label: string, options: readonly (readonly [string, string])[], value: string, set: (v: string) => void): ReactNode => (
    <div className="flex items-center gap-1 shrink-0">
      <span className="text-[9px] text-gray-600 uppercase tracking-wider mr-1">{label}</span>
      {options.map(([v, l]) => (
        <button key={v} onClick={() => set(v)} className={chip(value === v)} style={chipStyle(value === v)}>
          {l}
        </button>
      ))}
    </div>
  );

  // Once the timer runs, the letters take the scramble's place.
  const showLetters = state.phase === "active" || state.phase === "done";

  return (
    <TrainerPanel
      header={
        <div className="w-full overflow-x-auto">
          <div className="flex items-center gap-3">
            {group("Letters", [["speffz", "Speffz"], ["ruwix", "ruwix"]], settings.scheme, (v) => setSettings({ scheme: v as Scheme }))}
            {group("Hold", HOLDS, settings.hold, (v) => setSettings({ hold: v }))}
            {group("First", [["edges", "Edges"], ["corners", "Corners"]], settings.order, (v) => setSettings({ order: v as Order }))}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSettings({ speak: !settings.speak })}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${
                  settings.speak ? "text-sky-300 bg-sky-500/10" : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]"
                }`}
                title="While solving, Space says the letters due (so you know where you are, blindfolded)"
              >
                Read letters (Space): {settings.speak ? "on" : "off"}
              </button>
              <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1">
            {group("Cube", [["colours", "Colours"], ["letters", "Letters"], ["lettersOnly", "Letters only"], ["hidden", "Hidden"]], settings.view, (v) => setSettings({ view: v as View }))}
            {group("Memo letters", [["all", "Shown"], ["done", "Once done"], ["none", "Hidden"]], settings.reveal, (v) => setSettings({ reveal: v as Reveal }))}
          </div>
        </div>
      }
      moves={state.targetNotation.trim().split(/\s+/).filter(Boolean)}
      progress={selectCurrentProgress(state)}
      tracking={selectTracking(state)}
      showRefresh
      onRefresh={() => void generate()}
      loading={isGenerating}
      loadingText={isGenerating ? "Generating scramble…" : (scrambleError ?? undefined)}
      sequenceTop={
        state.phase === "setup" && official && official !== state.targetNotation ? (
          <p className="mb-1.5 px-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            From your cube as it is — the scramble from solved: <span className="font-mono normal-case tracking-normal text-gray-400">{official}</span>
          </p>
        ) : undefined
      }
      sequenceContent={
        showLetters ? (
          <div className="scramble-card">
            <Mount el={bld} className="w-full" />
          </div>
        ) : undefined
      }
      summary={
        last ? (
          <p className="text-sm text-gray-400 font-mono tabular-nums">
            memo {formatTimeMs(last.memoMs)} · execution {formatTimeMs(last.execMs)} ·{" "}
            <span className={last.solved ? "text-emerald-300" : "text-red-400"}>{last.solved ? formatTimeMs(last.memoMs + last.execMs) : "DNF"}</span>
          </p>
        ) : undefined
      }
      timeMs={displaySec * 1000}
      timerState={timerState}
      hintText={hintText}
      controls={
        <SolveControls
          mode="solve"
          isActive={state.phase === "active" || state.phase === "ready"}
          onDiscard={() => void generate()}
          onSaveAsDNF={() => {
            record(false);
            void generate();
          }}
        />
      }
      cubeRef={cubeRef}
      visualization="3D"
      cubeMask={cubeMask}
      cubeOrientation={frame}
      cubeSkin={cubeSkin}
      flatCubeRef={flatCubeRef}
      timesMs={solvedTimes.map((t) => t.memoMs + t.execMs).reverse()}
      statsLabel="Blindfolded"
      showAo12={false}
      layout="side"
      statsAside={
        times.length ? (
          <div className="panel p-5 h-full flex flex-col justify-center gap-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Success rate</p>
              <p className="text-3xl font-mono tabular-nums font-bold text-white mt-1">{successRate}%</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Best</p>
              <p className="text-3xl font-mono tabular-nums font-bold text-white mt-1">{best !== null ? formatTimeMs(best) : "—"}</p>
            </div>
            <p className="text-[11px] text-gray-600">
              {times.length} {times.length === 1 ? "attempt" : "attempts"}
            </p>
          </div>
        ) : undefined
      }
      bottom={
        times.length ? (
          <div className="flex flex-col">
            <div className="px-4 sm:px-6 pt-3 pb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Recent attempts</span>
            </div>
            <div className="divide-y divide-gray-800/40">
              {times.slice(0, 30).map((t) => (
                <div key={t.at} className="flex items-center gap-3 px-4 sm:px-6 py-1.5 hover:bg-white/[0.03] transition-colors">
                  <span className={`text-xs font-mono tabular-nums w-24 shrink-0 ${t.solved ? "text-white" : "text-red-400"}`}>{t.solved ? formatTimeMs(t.memoMs + t.execMs) : "DNF"}</span>
                  <span className="text-xs font-mono tabular-nums text-gray-500 flex-1">
                    memo {formatTimeMs(t.memoMs)} · execution {formatTimeMs(t.execMs)}
                  </span>
                  {cubeLabel(t.cube) && <span className="text-[10px] text-gray-500 shrink-0 max-w-32 truncate">{cubeLabel(t.cube)}</span>}
                  <span className="text-[10px] text-gray-700 shrink-0">{new Date(t.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          </div>
        ) : undefined
      }
    />
  );
}

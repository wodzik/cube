/**
 * BldTrainerPage — blindfolded (Old Pochmann) practice on cubecore's <cube-bld>.
 *
 * With a smart cube: "New scramble" (a random state from the cube's current
 * one) → follow it on <cube-scramble> → memo starts (timer) → the first turn
 * starts the execution → <cube-bld> follows every letter / parity and calls
 * out wrong swaps → done: memo / execution / total time, solved or not.
 * Without a cube: memo practice — the scramble, its letters and the cube with
 * letter stickers.
 *
 * The cube view can show colours, colours + letters, letters only (all but
 * the centres greyed) or nothing but the centres (the blindfold).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@cubecore/element";
import type { CubeBld, CubePlayer, CubeScramble } from "@cubecore/element";
import { type Move, type State, applyMoves, buildMask, formatAlg, solvedState } from "@cubecore/core";
import { SCHEMES, formatMemo, letterSkin, memo } from "@cubecore/bld";
import { useSmartCube } from "../hooks/useSmartCube";
import { useCubeLook } from "../hooks/useCubeLook";
import { cubecoreSolver } from "../services/cubecoreSolver";
import { ConnectionPanel } from "../components/ConnectionPanel";

const STORAGE_KEY = "nact_bld";
const TIMES_KEY = "nact_bld_times";

type Scheme = keyof typeof SCHEMES;
type View = "colours" | "letters" | "lettersOnly" | "hidden";
type Reveal = "all" | "done" | "none";

interface Settings {
  scheme: Scheme;
  hold: string;
  view: View;
  reveal: Reveal;
}

const HOLDS: readonly (readonly [string, string])[] = [
  ["", "White top, green front"],
  ["x2 y'", "Yellow top, orange front"],
];

interface BldTime {
  at: number;
  memoMs: number;
  execMs: number;
  solved: boolean;
}

function read<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
    return v && typeof v === "object" && !Array.isArray(fallback) ? { ...fallback, ...v } : (v ?? fallback);
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

/** The view's orientation for a cube held by `rotation` (own R, U, F as held → a quaternion). */
function holdQuaternion(rotation: string) {
  const rot = applyMoves(solvedState(), rotation);
  const normals = [[0, 1, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0], [-1, 0, 0], [0, 0, -1]]; // U R F D L B
  const where = (f: number) => normals[[0, 1, 2, 3, 4, 5].find((pos) => rot[pos * 9 + 4] === f * 9 + 4)!];
  const [x, y, z] = [where(1), where(0), where(2)]; // columns of the rotation matrix
  const m = [
    [x[0], y[0], z[0]],
    [x[1], y[1], z[1]],
    [x[2], y[2], z[2]],
  ];
  const tr = m[0][0] + m[1][1] + m[2][2];
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    return { w: s / 4, x: (m[2][1] - m[1][2]) / s, y: (m[0][2] - m[2][0]) / s, z: (m[1][0] - m[0][1]) / s };
  }
  if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2;
    return { w: (m[2][1] - m[1][2]) / s, x: s / 4, y: (m[0][1] + m[1][0]) / s, z: (m[0][2] + m[2][0]) / s };
  }
  if (m[1][1] > m[2][2]) {
    const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2;
    return { w: (m[0][2] - m[2][0]) / s, x: (m[0][1] + m[1][0]) / s, y: s / 4, z: (m[1][2] + m[2][1]) / s };
  }
  const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
  return { w: (m[1][0] - m[0][1]) / s, x: (m[0][2] + m[2][0]) / s, y: (m[1][2] + m[2][1]) / s, z: s / 4 };
}

type Phase = "idle" | "loading" | "scramble" | "memo" | "exec" | "done";

const fmt = (ms: number) => (ms / 1000).toFixed(2);

export default function BldTrainerPage() {
  const cube = useSmartCube();
  const session = cube.session;
  const { skin } = useCubeLook();

  const [settings, setSettingsState] = useState<Settings>(() => read(STORAGE_KEY, { scheme: "speffz", hold: "", view: "letters", reveal: "all" }));
  const setSettings = (patch: Partial<Settings>) =>
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      write(STORAGE_KEY, next);
      return next;
    });
  const [times, setTimes] = useState<BldTime[]>(() => read<BldTime[]>(TIMES_KEY, []));

  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [scramble, setScramble] = useState<{ moves: Move[]; state: State } | null>(null);
  const [marks, setMarks] = useState<{ memoAt?: number; execAt?: number; doneAt?: number; solved?: boolean }>({});
  const [now, setNow] = useState(0);
  const [info, setInfo] = useState("");

  // Memo of the case (for the no-cube view and the summary).
  const caseMemo = useMemo(
    () => (scramble ? memo(scramble.state, { scheme: SCHEMES[settings.scheme], rotation: settings.hold || undefined }) : null),
    [scramble, settings.scheme, settings.hold]
  );

  // ---- elements ----
  const playerHost = useRef<HTMLDivElement>(null);
  const scrambleHost = useRef<HTMLDivElement>(null);
  const bldHost = useRef<HTMLDivElement>(null);
  const player = useRef<CubePlayer | null>(null);
  const scrambleEl = useRef<CubeScramble | null>(null);
  const bldEl = useRef<CubeBld | null>(null);

  const startMemo = useCallback(() => {
    if (!session || !bldEl.current) return;
    scrambleEl.current?.detach();
    bldEl.current.attach(session);
    setMarks({ memoAt: performance.now() });
    setPhase("memo");
    setInfo("Memorise — the first turn starts the execution.");
  }, [session]);

  useEffect(() => {
    const p = document.createElement("cube-player") as CubePlayer;
    p.setAttribute("controls", "none");
    p.style.width = "100%";
    p.style.height = "100%";
    playerHost.current?.append(p);
    player.current = p;

    const s = document.createElement("cube-scramble") as CubeScramble;
    scrambleHost.current?.append(s);
    scrambleEl.current = s;

    const b = document.createElement("cube-bld") as CubeBld;
    bldHost.current?.append(b);
    bldEl.current = b;
    return () => {
      p.remove();
      s.remove();
      b.remove();
      player.current = scrambleEl.current = bldEl.current = null;
    };
  }, []);

  // Scramble applied on the cube → memo.
  useEffect(() => {
    const s = scrambleEl.current;
    if (!s) return;
    const onComplete = () => {
      if (phaseRef.current === "scramble") queueMicrotask(startMemo); // after this move reached every listener
    };
    s.addEventListener("complete", onComplete);
    return () => s.removeEventListener("complete", onComplete);
  }, [startMemo]);

  // All letters done → the result.
  useEffect(() => {
    const b = bldEl.current;
    if (!b) return;
    const onComplete = () => {
      if (phaseRef.current !== "exec") return;
      const solved = !!b.progress?.solved;
      setMarks((m) => {
        const done = { ...m, doneAt: performance.now(), solved };
        if (m.memoAt && m.execAt) {
          const t: BldTime = { at: Date.now(), memoMs: m.execAt - m.memoAt, execMs: done.doneAt - m.execAt, solved };
          setTimes((prev) => {
            const next = [t, ...prev].slice(0, 100);
            write(TIMES_KEY, next);
            return next;
          });
        }
        return done;
      });
      setPhase("done");
      setInfo(solved ? "Solved ✓" : "All letters done — but the cube isn't solved: check the last algorithm.");
    };
    const onWrong = () => setInfo("Wrong swap — undo it.");
    const onLetter = () => setInfo("");
    b.addEventListener("complete", onComplete);
    b.addEventListener("wrong", onWrong);
    b.addEventListener("letter", onLetter);
    return () => {
      b.removeEventListener("complete", onComplete);
      b.removeEventListener("wrong", onWrong);
      b.removeEventListener("letter", onLetter);
    };
  }, []);

  // Live cube: player and scramble follow it; the first turn during memo starts the execution.
  useEffect(() => {
    if (!session) return;
    const offPlayer = player.current?.attach(session, { gyro: false });
    const offScramble = scrambleEl.current?.attach(session);
    const offMove = session.on("move", () => {
      if (phaseRef.current !== "memo") return;
      phaseRef.current = "exec";
      setMarks((m) => ({ ...m, execAt: performance.now() }));
      setPhase("exec");
      setInfo("");
    });
    return () => {
      offPlayer?.();
      offScramble?.();
      offMove();
    };
  }, [session]);

  // No cube: show the case.
  useEffect(() => {
    if (!session && player.current) player.current.setup = scramble?.state ?? solvedState();
  }, [session, scramble]);

  // Look: skin with letters, masks, held orientation.
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const letters = settings.view === "letters" || settings.view === "lettersOnly";
    p.skin = letters ? letterSkin(skin, { scheme: SCHEMES[settings.scheme], rotation: settings.hold || undefined, alwaysShow: settings.view === "lettersOnly" }) : skin;
    p.mask = settings.view === "lettersOnly" || settings.view === "hidden" ? buildMask((f) => (f.index % 9 === 4 ? "regular" : "ignored")) : null;
    p.renderer?.setOrientation(settings.hold ? holdQuaternion(settings.hold) : null);
  }, [skin, settings.view, settings.scheme, settings.hold]);

  useEffect(() => {
    const b = bldEl.current;
    if (!b) return;
    b.setAttribute("scheme", settings.scheme);
    if (settings.hold) b.setAttribute("rotation", settings.hold);
    else b.removeAttribute("rotation");
    b.setAttribute("reveal", settings.reveal);
  }, [settings.scheme, settings.hold, settings.reveal]);

  const newScramble = useCallback(async () => {
    setPhase("loading");
    setInfo("");
    setMarks({});
    bldEl.current?.detach();
    const from = session?.state ?? solvedState();
    const r = await cubecoreSolver().randomScramble({ preset: "full", from });
    setScramble(r);
    if (scrambleEl.current) {
      if (session) scrambleEl.current.attach(session);
      scrambleEl.current.scramble = r.moves;
    }
    setPhase(session ? "scramble" : "idle");
  }, [session]);

  // Timer tick.
  useEffect(() => {
    if (phase !== "memo" && phase !== "exec") return;
    const id = setInterval(() => setNow(performance.now()), 50);
    return () => clearInterval(id);
  }, [phase]);

  const memoMs = marks.memoAt ? (marks.execAt ?? (phase === "memo" ? now : marks.memoAt)) - marks.memoAt : 0;
  const execMs = marks.execAt ? (marks.doneAt ?? (phase === "exec" ? now : marks.execAt)) - marks.execAt : 0;
  const successes = times.filter((t) => t.solved);

  return (
    <main className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            Letters
            <select className="rounded-lg bg-gray-900 px-2 py-1" value={settings.scheme} onChange={(e) => setSettings({ scheme: e.target.value as Scheme })}>
              <option value="speffz">Speffz (U L F R B D)</option>
              <option value="ruwix">ruwix (U F R B L D)</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            Hold
            <select className="rounded-lg bg-gray-900 px-2 py-1" value={settings.hold} onChange={(e) => setSettings({ hold: e.target.value })}>
              {HOLDS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Cube
            <select className="rounded-lg bg-gray-900 px-2 py-1" value={settings.view} onChange={(e) => setSettings({ view: e.target.value as View })}>
              <option value="colours">colours</option>
              <option value="letters">colours + letters</option>
              <option value="lettersOnly">letters only</option>
              <option value="hidden">hidden (blindfold)</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            Memo letters
            <select className="rounded-lg bg-gray-900 px-2 py-1" value={settings.reveal} onChange={(e) => setSettings({ reveal: e.target.value as Reveal })}>
              <option value="all">shown</option>
              <option value="done">hidden until done</option>
              <option value="none">hidden</option>
            </select>
          </label>
        </div>
        <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
      </div>

      <div ref={scrambleHost} className={`w-fit max-w-3xl mx-auto text-gray-100 ${session && phase === "scramble" ? "" : "hidden"}`} />
      {!session && scramble && <p className="mx-auto max-w-3xl text-center font-mono text-lg text-gray-100">{formatAlg(scramble.moves)}</p>}

      <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,24rem)] items-start">
        <div ref={playerHost} className="h-[min(60vh,520px)] min-h-72 rounded-2xl bg-gray-900/60 overflow-hidden" />
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-gray-900 p-4 grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-500">Memo</div>
              <div className="text-3xl font-mono tabular-nums text-white">{fmt(memoMs)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Execution</div>
              <div className="text-3xl font-mono tabular-nums text-white">{fmt(execMs)}</div>
            </div>
            <div className="col-span-2 text-sm text-gray-400">
              {phase === "done" ? (
                <>
                  Total <b className="text-white">{fmt(memoMs + execMs)}</b> — {marks.solved ? "solved" : "DNF"}
                </>
              ) : phase === "scramble" ? (
                "Follow the scramble on your cube"
              ) : (
                info
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void newScramble()} disabled={phase === "loading"} className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-white hover:bg-blue-500 disabled:opacity-50">
              New scramble
            </button>
            {session && (
              <button onClick={startMemo} className="rounded-xl bg-gray-800 px-3 py-2 text-gray-200 hover:bg-gray-700" title="Memo the cube as it is now (your own scramble)">
                Memo now
              </button>
            )}
          </div>
          {session && (
            <button onClick={() => session.markSolved()} className="self-start text-xs text-gray-500 hover:text-gray-300">
              Cube out of sync? Mark it solved
            </button>
          )}
          <div ref={bldHost} className={`rounded-2xl bg-gray-900 p-3 text-gray-100 ${session && phase !== "idle" && phase !== "scramble" && phase !== "loading" ? "" : "hidden"}`} />
          {!session && caseMemo && (
            <div className="rounded-2xl bg-gray-900 p-3 text-sm text-gray-300 flex flex-col gap-1">
              <div>
                Edges: <b className="font-mono text-white">{formatMemo(caseMemo.edges) || "—"}</b>
              </div>
              {caseMemo.parity && <div className="text-amber-400">Parity</div>}
              <div>
                Corners: <b className="font-mono text-white">{formatMemo(caseMemo.corners) || "—"}</b>
              </div>
            </div>
          )}
          {times.length > 0 && (
            <div className="rounded-2xl bg-gray-900 p-3 text-sm text-gray-300">
              <div className="mb-2 flex justify-between text-xs text-gray-500">
                <span>Recent</span>
                <span>
                  {successes.length}/{times.length} solved
                </span>
              </div>
              <ul className="flex flex-col gap-1 font-mono tabular-nums">
                {times.slice(0, 8).map((t) => (
                  <li key={t.at} className="flex justify-between">
                    <span className={t.solved ? "text-white" : "text-gray-500 line-through"}>{fmt(t.memoMs + t.execMs)}</span>
                    <span className="text-gray-500">
                      {fmt(t.memoMs)} + {fmt(t.execMs)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

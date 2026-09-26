/**
 * StageTrainerPage — the skill trainers on cubecore: cross, xcross, pairs,
 * Roux blocks / LSE and ZZ EO stages as StageDefs run by cubecore's solver
 * worker (exact optimal lengths, all optimal solutions).
 *
 * Flow: pick a trainer, colour and level → "New case" asks the solver for a
 * scramble whose optimal stage solution is exactly `level` moves, generated
 * FROM the connected cube's current state (so no re-solving between cases).
 * With a cube: <cube-scramble> follows the turns; once it's applied the
 * timer runs and every move asks the solver for the stage distance — at 0
 * the attempt ends (time, moves vs optimal, the optimal solutions). Without
 * a cube: the scramble and the case on screen, solutions on demand.
 *
 * Replaces CaseTrainerPage (cubing.js + or18 engines) once it covers it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@cubecore/element";
import type { CubePlayer, CubeScramble } from "@cubecore/element";
import { type Face, type Move, buildMask, formatAlg, frameFor, solvedState } from "@cubecore/core";
import { useSmartCube } from "../hooks/useSmartCube";
import { useCubeLook } from "../hooks/useCubeLook";
import { cubecoreSolver } from "../services/cubecoreSolver";
import { BOTTOM_COLOURS, METHOD_LABELS, type MethodId, STAGE_TRAINERS, stageMaskRule } from "../logic/stageTrainerCatalog";
import { ConnectionPanel } from "../components/ConnectionPanel";
import type { ScrambleResult } from "@cubecore/solve";

const STORAGE_KEY = "nact_stage_trainer";

interface Choice {
  trainer: string;
  variant: string;
  bottom: Face;
  levels: Record<string, number>;
}

function readChoice(): Choice {
  const base: Choice = { trainer: "cross", variant: "", bottom: "U", levels: {} };
  try {
    const c = { ...base, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Choice> | null) };
    return STAGE_TRAINERS.some((t) => t.id === c.trainer) ? c : base;
  } catch {
    return base;
  }
}

type Phase = "idle" | "loading" | "scramble" | "solving" | "done" | "error";

interface Attempt {
  scramble: ScrambleResult;
  level: number;
  startedAt?: number;
  moves: number;
  timeMs?: number;
}

const fmtTime = (ms: number) => (ms / 1000).toFixed(2);

export default function StageTrainerPage() {
  const cube = useSmartCube();
  const session = cube.session;
  const { skin } = useCubeLook();

  const [choice, setChoiceState] = useState<Choice>(readChoice);
  const setChoice = useCallback((patch: Partial<Choice>) => {
    setChoiceState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // not persisted
      }
      return next;
    });
  }, []);

  const trainer = STAGE_TRAINERS.find((t) => t.id === choice.trainer) ?? STAGE_TRAINERS[0];
  const variant = trainer.variants?.some(([v]) => v === choice.variant) ? choice.variant : (trainer.variants?.[0][0] ?? "");
  const level = Math.min(trainer.levels.max, Math.max(trainer.levels.min, choice.levels[trainer.id] ?? trainer.levels.start));
  const stage = useMemo(() => trainer.stage(variant), [trainer, variant]);
  const frame = useMemo(() => frameFor(choice.bottom), [choice.bottom]);
  const mask = useMemo(() => buildMask(stageMaskRule(stage), frame), [stage, frame]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [solutions, setSolutions] = useState<Move[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Changing what's trained drops the current case.
  useEffect(() => {
    setPhase("idle");
    setAttempt(null);
    setSolutions(null);
  }, [stage, frame, level]);

  const newCase = useCallback(async () => {
    setPhase("loading");
    setSolutions(null);
    setError(null);
    try {
      const res = await cubecoreSolver().stageScramble({ stage, length: level, frame, from: session?.state ?? solvedState() });
      if (!res) throw new Error(`No case at ${level} moves`);
      setAttempt({ scramble: res, level, moves: 0 });
      setPhase("scramble");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [stage, level, frame, session]);

  const showSolutions = useCallback(async () => {
    if (!attempt) return;
    setSolutions(await cubecoreSolver().stageSolve(stage, attempt.scramble.state, { frame, all: true, limit: 8 }));
  }, [attempt, stage, frame]);

  // ---- the cube view: live (attached to the cube) or the case's state ----
  const playerHost = useRef<HTMLDivElement>(null);
  const player = useRef<CubePlayer | null>(null);
  useEffect(() => {
    const p = document.createElement("cube-player") as CubePlayer;
    p.setAttribute("controls", "none");
    p.style.width = "100%";
    p.style.height = "100%";
    playerHost.current?.append(p);
    player.current = p;
    return () => {
      p.remove();
      player.current = null;
    };
  }, []);
  useEffect(() => {
    if (player.current) player.current.skin = skin;
  }, [skin]);
  useEffect(() => {
    if (player.current) player.current.mask = mask;
  }, [mask]);
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    if (session) return p.attach(session);
    p.setup = attempt?.scramble.state ?? solvedState();
  }, [session, attempt]);

  // ---- the scramble strip (follows the cube when connected) ----
  const scrambleHost = useRef<HTMLDivElement>(null);
  const scrambleEl = useRef<CubeScramble | null>(null);
  useEffect(() => {
    const el = document.createElement("cube-scramble") as CubeScramble;
    scrambleHost.current?.append(el);
    scrambleEl.current = el;
    const onComplete = () => {
      if (phaseRef.current !== "scramble") return;
      setAttempt((a) => (a ? { ...a, startedAt: performance.now(), moves: 0 } : a));
      setPhase("solving");
    };
    el.addEventListener("complete", onComplete);
    return () => {
      el.removeEventListener("complete", onComplete);
      el.remove();
      scrambleEl.current = null;
    };
  }, []);
  useEffect(() => {
    const el = scrambleEl.current;
    if (el && session) return el.attach(session);
  }, [session]);
  useEffect(() => {
    if (scrambleEl.current) scrambleEl.current.scramble = attempt?.scramble.moves ?? [];
  }, [attempt?.scramble]);

  // ---- solving: count moves, stop when the stage is solved ----
  useEffect(() => {
    if (!session || phase !== "solving") return;
    return session.on("move", (e) => {
      setAttempt((a) => (a ? { ...a, moves: a.moves + 1 } : a));
      const at = performance.now();
      void cubecoreSolver()
        .stageDistance(stage, e.state, { frame })
        .then((d) => {
          if (d !== 0 || phaseRef.current !== "solving") return;
          phaseRef.current = "done";
          setAttempt((a) => (a ? { ...a, timeMs: at - (a.startedAt ?? at) } : a));
          setPhase("done");
        });
    });
  }, [session, phase, stage, frame]);
  useEffect(() => {
    if (phase === "done") void showSolutions();
  }, [phase, showSolutions]);

  // Timer tick.
  useEffect(() => {
    if (phase !== "solving") return;
    const id = setInterval(() => setNow(performance.now()), 50);
    return () => clearInterval(id);
  }, [phase]);

  const methods = [...new Set(STAGE_TRAINERS.map((t) => t.method))] as MethodId[];
  const elapsed = phase === "solving" && attempt?.startedAt ? Math.max(0, now - attempt.startedAt) : (attempt?.timeMs ?? 0);

  return (
    <main className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {methods.map((m) => (
            <div key={m} className="flex items-center gap-1 rounded-xl bg-gray-900 p-1">
              <span className="px-2 text-xs font-semibold text-gray-500">{METHOD_LABELS[m]}</span>
              {STAGE_TRAINERS.filter((t) => t.method === m).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setChoice({ trainer: t.id })}
                  className={`rounded-lg px-2.5 py-1 text-sm ${t.id === trainer.id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
        <span className="text-gray-400">{trainer.hint}</span>
        {trainer.variants && (
          <label className="flex items-center gap-2">
            Variant
            <select className="rounded-lg bg-gray-900 px-2 py-1" value={variant} onChange={(e) => setChoice({ variant: e.target.value })}>
              {trainer.variants.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2">
          Colour
          <select className="rounded-lg bg-gray-900 px-2 py-1" value={choice.bottom} onChange={(e) => setChoice({ bottom: e.target.value as Face })}>
            {BOTTOM_COLOURS.map(([f, l]) => (
              <option key={f} value={f}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Moves
          <input
            type="range"
            min={trainer.levels.min}
            max={trainer.levels.max}
            value={level}
            onChange={(e) => setChoice({ levels: { ...choice.levels, [trainer.id]: Number(e.target.value) } })}
          />
          <span className="w-5 tabular-nums">{level}</span>
        </label>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div ref={scrambleHost} className={`w-fit max-w-3xl mx-auto text-gray-100 ${attempt ? "" : "hidden"}`} />
        {!attempt && phase !== "loading" && <p className="text-gray-500 text-sm">Press “New case” for a {level}-move {trainer.label.toLowerCase()}.</p>}
        {phase === "loading" && <p className="text-gray-500 text-sm">Generating… (the first case of a stage builds its tables)</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,22rem)] items-start">
        <div ref={playerHost} className="h-[min(60vh,520px)] min-h-72 rounded-2xl bg-gray-900/60 overflow-hidden" />
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-gray-900 p-4 flex flex-col items-center gap-1">
            <div className="text-5xl font-mono tabular-nums text-white">{fmtTime(elapsed)}</div>
            <div className="text-sm text-gray-400">
              {phase === "scramble" && (session ? "Apply the scramble on your cube" : "Scramble, then solve")}
              {phase === "solving" && `${attempt?.moves ?? 0} moves`}
              {phase === "done" && attempt && (
                <>
                  Solved in <b className="text-white">{attempt.moves}</b> moves (optimal {attempt.level}){attempt.moves === attempt.level ? " — optimal!" : ""}
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void newCase()} disabled={phase === "loading"} className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-white hover:bg-blue-500 disabled:opacity-50">
              New case
            </button>
            <button onClick={() => void showSolutions()} disabled={!attempt} className="rounded-xl bg-gray-800 px-3 py-2 text-gray-200 hover:bg-gray-700 disabled:opacity-40">
              Solutions
            </button>
          </div>
          {session && (
            <button onClick={() => session.markSolved()} className="self-start text-xs text-gray-500 hover:text-gray-300">
              Cube out of sync? Mark it solved
            </button>
          )}
          {solutions && (
            <div className="rounded-2xl bg-gray-900 p-3">
              <div className="mb-2 text-xs font-semibold text-gray-500">Optimal solutions ({solutions[0]?.length ?? 0} moves)</div>
              <ul className="flex flex-col gap-1 font-mono text-sm text-gray-200">
                {solutions.map((s, i) => (
                  <li key={i}>{formatAlg(s) || "(solved)"}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

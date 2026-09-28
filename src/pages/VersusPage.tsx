/**
 * VersusPage — two to four smart cubes, one scramble, who solves it first.
 *
 * Layout: the score card on top (names editable, how many players, Next
 * round / Reset score), then one column per player (four: two rows of two) — each with its scramble, a big timer
 * and status, and its cube live in 3D (with that cube's own look); the
 * cube's chip (name, battery, Mark as solved, disconnect) under it, or
 * Connect over the cube.
 *
 * A round: one random-state scramble; each cube gets the way from where it
 * is to that same scrambled state (the same text when both start solved),
 * followed on cubecore's <cube-scramble>. Both scrambled → 3-2-1 → both
 * timers start together; each stops the moment its cube is solved. The
 * first gets WINNER on their side and the point; the other still sees their
 * time. Nothing is saved — the score lives while the page is open.
 *
 * Player 1 uses the app's connected cube (connect it here or anywhere);
 * players 2–4 connect their cubes for this page only. How many cubes can be
 * connected at once is up to the computer's Bluetooth (usually 5–7).
 */

import { PageLabel } from "../components/PageLabel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bluetooth, BluetoothConnected, CheckCheck, RefreshCw, RotateCcw, Trophy } from "lucide-react";
import "@wodzik/cubecore/element";
import type { CubePlayer, CubeScramble } from "@wodzik/cubecore/element";
import { type Move, type State, formatAlg, isSolved, parseAlg, solvedState, statesEqual } from "@wodzik/cubecore/core";
import { SimulatedCube, SmartCubeSession as SmartCubeSessionClass, type SmartCubeSession } from "@wodzik/cubecore/bluetooth";
import { SKINS } from "@wodzik/cubecore/skin";
import { openCubeSession, trackKnownCube, useSmartCube } from "../hooks/useSmartCube";
import { type SkinName, lookForCube, resolveSkin, useCubeLook } from "../hooks/useCubeLook";
import { useTurnArrows } from "../hooks/useTurnArrows";
import { listCubes, onCubesChange } from "../services/cubeRegistry";
import { cubecoreSolver } from "../services/cubecoreSolver";
import { takeScramble } from "../services/scrambleQueue";

const NAMES_KEY = "nact_versus_names";
const COUNT_KEY = "nact_versus_players";
const COUNTDOWN_MS = 3000;
const MAX_PLAYERS = 4;
const COLOURS = ["#38bdf8", "#fb923c", "#34d399", "#e879f9"] as const; // players 1–4 (sky / orange / emerald / fuchsia)

type Phase = "idle" | "loading" | "scrambling" | "countdown" | "running" | "done";

interface Result {
  timeMs: number;
}

const fmt = (ms: number) => (ms / 1000).toFixed(2);

function readNames(): string[] {
  const names = Array.from({ length: MAX_PLAYERS }, (_, i) => `Player ${i + 1}`);
  try {
    const n = JSON.parse(localStorage.getItem(NAMES_KEY) ?? "null") as string[] | null;
    if (Array.isArray(n)) n.slice(0, MAX_PLAYERS).forEach((v, i) => typeof v === "string" && v && (names[i] = v));
  } catch {
    // default
  }
  return names;
}

function readCount(): number {
  try {
    const n = Number(localStorage.getItem(COUNT_KEY));
    return n >= 2 && n <= MAX_PLAYERS ? n : 2;
  } catch {
    return 2;
  }
}

const ORDINAL = ["1st", "2nd", "3rd", "4th"];

/** A cube this page connected (players 2–4); player 1 is the app's. */
interface Extra {
  session: SmartCubeSession;
  off: () => void;
}

export default function VersusPage() {
  const app = useSmartCube();
  const [count, setCountState] = useState(readCount);
  const [extras, setExtras] = useState<(Extra | null)[]>(() => Array(MAX_PLAYERS - 1).fill(null));
  const [connectError, setConnectError] = useState<string | null>(null);
  const sessions: (SmartCubeSession | null)[] = [app.session, ...extras.map((e) => e?.session ?? null)].slice(0, count);
  const players = Array.from({ length: count }, (_, i) => i);

  const [names, setNamesState] = useState<string[]>(readNames);
  const setName = (i: number, name: string) =>
    setNamesState((prev) => {
      const next = [...prev];
      next[i] = name;
      try {
        localStorage.setItem(NAMES_KEY, JSON.stringify(next));
      } catch {
        // not persisted
      }
      return next;
    });
  const [score, setScore] = useState<number[]>(() => Array(MAX_PLAYERS).fill(0));

  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [official, setOfficial] = useState<{ moves: Move[]; state: State } | null>(null);
  const [paths, setPaths] = useState<(Move[] | null)[]>(() => Array(MAX_PLAYERS).fill(null));
  const [ready, setReady] = useState<boolean[]>(() => Array(MAX_PLAYERS).fill(false));
  const [results, setResults] = useState<(Result | null)[]>(() => Array(MAX_PLAYERS).fill(null));
  const [startAt, setStartAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winner, setWinner] = useState<number | null>(null);

  // ─── connecting players 2–4 ───

  const extrasRef = useRef(extras);
  extrasRef.current = extras;
  const setExtra = (slot: number, extra: Extra | null) => setExtras((prev) => prev.map((e, i) => (i === slot ? extra : e)));

  const connectExtra = async (slot: number) => {
    setConnectError(null);
    try {
      const session = await openCubeSession();
      const taken = [app.session, ...extrasRef.current.map((e) => e?.session ?? null)].findIndex((s) => s?.info.name === session.info.name);
      if (taken >= 0) {
        await session.disconnect().catch(() => undefined);
        throw new Error(`That cube is already player ${taken + 1}'s — pick another one`);
      }
      const { off } = trackKnownCube(session);
      const offDisconnect = session.on("disconnect", () => setExtras((prev) => prev.map((e) => (e?.session === session ? null : e))));
      setExtra(slot, { session, off: () => (off(), offDisconnect()) });
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Could not connect");
    }
  };
  const disconnectExtra = async (slot: number) => {
    const e = extrasRef.current[slot];
    setExtra(slot, null);
    e?.off();
    await e?.session.disconnect().catch(() => undefined);
  };
  // Dev only: simulated cubes for players 2–4 (headless checks) — __nactVersusConnect(slot = first free), __nactVersusMove("R", slot = 0).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __nactVersusConnect?: (slot?: number) => void; __nactVersusMove?: (m: string, slot?: number) => void };
    const cubes: (SimulatedCube | null)[] = Array(MAX_PLAYERS - 1).fill(null);
    w.__nactVersusConnect = (slot) => {
      const i = slot ?? extrasRef.current.findIndex((e) => !e);
      if (i < 0) return;
      cubes[i] = new SimulatedCube();
      setExtra(i, { session: new SmartCubeSessionClass(cubes[i]!), off: () => undefined });
    };
    w.__nactVersusMove = (m, slot = 0) => cubes[slot]?.turn(m);
    return () => {
      delete w.__nactVersusConnect;
      delete w.__nactVersusMove;
    };
  }, []);

  // The page's own cubes go with the page.
  useEffect(
    () => () => {
      for (const e of extrasRef.current) {
        e?.off();
        void e?.session.disconnect().catch(() => undefined);
      }
    },
    []
  );

  const setCount = (n: number) => {
    setCountState(n);
    try {
      localStorage.setItem(COUNT_KEY, String(n));
    } catch {
      // not kept
    }
    // Players no longer playing let their cubes go.
    extrasRef.current.forEach((e, slot) => {
      if (e && slot + 2 > n) void disconnectExtra(slot);
    });
  };

  // ─── a round ───

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  /** The way from each cube's state to the scrambled one. */
  const planPaths = useCallback(async (target: { moves: Move[]; state: State }) => {
    const plan = async (s: SmartCubeSession | null): Promise<Move[]> => {
      if (!s || statesEqual(s.state, solvedState())) return target.moves;
      return (await cubecoreSolver().solveBetween(s.state, target.state)) ?? target.moves;
    };
    const all = [...sessionsRef.current, ...Array(MAX_PLAYERS).fill(null)].slice(0, MAX_PLAYERS);
    setPaths(await Promise.all(all.map(plan)));
    setReady(Array(MAX_PLAYERS).fill(false));
  }, []);

  const newRound = useCallback(async () => {
    setPhase("loading");
    setResults(Array(MAX_PLAYERS).fill(null));
    setWinner(null);
    setStartAt(null);
    setCountdown(null);
    const ready = await takeScramble();
    const r = { moves: parseAlg(ready.moves), state: ready.state };
    setOfficial(r);
    await planPaths(r);
    setPhase("scrambling");
  }, [planPaths]);

  // First round on arrival.
  useEffect(() => {
    void newRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A cube connected (or marked solved) while scrambling: its way is planned again.
  const sessionKey = `${sessions.map((s) => s?.info.name ?? "").join("|")}|${app.resyncs}`;
  useEffect(() => {
    if (phaseRef.current === "scrambling" && official) void planPaths(official);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  // Everyone scrambled → 3-2-1 → go.
  useEffect(() => {
    if (phase === "scrambling" && ready.slice(0, count).every(Boolean)) setPhase("countdown");
  }, [phase, ready, count]);
  useEffect(() => {
    if (phase !== "countdown") return;
    const t0 = performance.now();
    setCountdown(3);
    const id = setInterval(() => {
      const left = COUNTDOWN_MS - (performance.now() - t0);
      if (left <= 0) {
        clearInterval(id);
        setCountdown(null);
        setStartAt(performance.now());
        setPhase("running");
      } else setCountdown(Math.ceil(left / 1000));
    }, 50);
    return () => clearInterval(id);
  }, [phase]);

  const onReady = useCallback((i: number) => setReady((r) => r.map((v, j) => (j === i ? true : v))), []);

  const resultsRef = useRef(results);
  resultsRef.current = results;
  const onSolved = useCallback(
    (i: number, time: number) => {
      if ((phaseRef.current !== "running" && phaseRef.current !== "done") || startAt === null) return;
      const prev = resultsRef.current;
      if (prev[i]) return;
      const next = [...prev];
      next[i] = { timeMs: Math.max(0, time - startAt) };
      resultsRef.current = next;
      setResults(next);
      // The first one solved wins the round.
      if (prev.every((r) => !r)) {
        setWinner(i);
        setScore((s) => s.map((v, j) => (j === i ? v + 1 : v)));
        setPhase("done");
      }
    },
    [startAt]
  );

  const allConnected = sessions.every(Boolean);
  const winnerResult = winner !== null ? results[winner] : null;
  /** 1-based place among those finished. */
  const placeOf = (i: number) => {
    const r = results[i];
    return r ? results.slice(0, count).filter((o) => o && o.timeMs < r.timeMs).length : -1;
  };
  const cols = count === 3 ? 3 : 2;

  return (
    <main className="w-full px-4 sm:px-6 py-3 flex flex-col gap-4">
      <PageLabel className="pt-1.5">Versus</PageLabel>
      {/* Score */}
      <div className="flex flex-col items-center gap-2">
        <div className={`panel px-3 sm:px-6 py-3 flex flex-wrap items-center justify-center ${count === 2 ? "gap-3" : "gap-1"} sm:gap-6`}>
          {count === 2 ? (
            <>
              <ScoreName name={names[0]} colour={COLOURS[0]} onChange={(n) => setName(0, n)} />
              <div className="flex items-baseline gap-3 font-mono tabular-nums">
                <span className="text-3xl sm:text-4xl font-bold" style={{ color: COLOURS[0] }}>
                  {score[0]}
                </span>
                <span className="text-gray-600 text-2xl">–</span>
                <span className="text-3xl sm:text-4xl font-bold" style={{ color: COLOURS[1] }}>
                  {score[1]}
                </span>
              </div>
              <ScoreName name={names[1]} colour={COLOURS[1]} onChange={(n) => setName(1, n)} />
            </>
          ) : (
            players.map((i) => (
              <div key={i} className="flex flex-col items-center">
                <ScoreName name={names[i]} colour={COLOURS[i]} onChange={(n) => setName(i, n)} narrow />
                <span className="text-3xl font-bold font-mono tabular-nums" style={{ color: COLOURS[i] }}>
                  {score[i]}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5" title="How many players">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                disabled={phase === "countdown" || phase === "running"}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${count === n ? "bg-white/10 text-white" : "text-gray-400 hover:text-gray-200"}`}
              >
                {n} players
              </button>
            ))}
          </div>
          <button onClick={() => void newRound()} disabled={phase === "loading" || phase === "countdown"} className="btn-secondary text-xs">
            <RefreshCw size={13} /> {phase === "done" ? "Next round" : "New scramble"}
          </button>
          <button onClick={() => setScore(Array(MAX_PLAYERS).fill(0))} className="btn-secondary text-xs" title="Start the score again">
            <RotateCcw size={13} /> Reset score
          </button>
        </div>
        <p className="text-xs text-gray-500 min-h-4 text-center">
          {!allConnected
            ? `Connect ${count === 2 ? "both" : `all ${count}`} cubes — each scrambles the same scramble, then 3-2-1 and go.`
            : phase === "scrambling"
              ? `Scramble your cube — the round starts when ${count === 2 ? "both are" : "all are"} scrambled.`
              : phase === "countdown"
                ? "Get ready…"
                : phase === "running"
                  ? "Solve!"
                  : phase === "done"
                    ? "Results aren't saved — Next round when you're ready."
                    : ""}
        </p>
        {connectError && <p className="text-xs text-red-400">{connectError}</p>}
      </div>

      {/* The players — side by side (2, 3), or two rows of two (4) */}
      <div className={`grid gap-y-6 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {players.map((i) => (
          <PlayerSide
            key={i}
            divider={i % cols !== 0}
            compact={count > 2}
            colour={COLOURS[i]}
            session={sessions[i]}
            path={paths[i]}
            fallback={official?.moves ?? null}
            phase={phase}
            countdown={countdown}
            startAt={startAt}
            result={results[i]}
            winnerResult={winnerResult}
            place={count > 2 ? placeOf(i) : -1}
            isWinner={winner === i}
            ready={ready[i]}
            onReady={() => onReady(i)}
            onSolved={(t) => onSolved(i, t)}
            onConnect={i === 0 ? () => void app.connect() : () => void connectExtra(i - 1)}
            onDisconnect={i === 0 ? () => void app.disconnect() : () => void disconnectExtra(i - 1)}
          />
        ))}
      </div>
    </main>
  );
}

function ScoreName({ name, colour, onChange, narrow = false }: { name: string; colour: string; onChange: (n: string) => void; narrow?: boolean }) {
  return (
    <input
      defaultValue={name}
      onBlur={(e) => onChange(e.target.value.trim() || name)}
      className={`${narrow ? "w-[4.5rem]" : "w-20"} sm:w-28 bg-transparent text-center text-sm font-semibold outline-none border-b border-transparent hover:border-white/10 focus:border-white/20`}
      style={{ color: colour }}
      title="Name"
    />
  );
}

function PlayerSide({
  divider,
  compact,
  colour,
  session,
  path,
  fallback,
  phase,
  countdown,
  startAt,
  result,
  winnerResult,
  place,
  isWinner,
  ready,
  onReady,
  onSolved,
  onConnect,
  onDisconnect,
}: {
  /** A line on its left (not the first in its row). */
  divider: boolean;
  /** Three or four players: a smaller cube. */
  compact: boolean;
  colour: string;
  session: SmartCubeSession | null;
  path: Move[] | null;
  fallback: Move[] | null;
  phase: Phase;
  countdown: number | null;
  startAt: number | null;
  result: Result | null;
  winnerResult: Result | null;
  /** Place among the finished (0 = first), with three or more players; -1: not shown. */
  place: number;
  isWinner: boolean;
  ready: boolean;
  onReady: () => void;
  onSolved: (time: number) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const playerHost = useRef<HTMLDivElement>(null);
  const scrambleHost = useRef<HTMLDivElement>(null);
  const player = useRef<CubePlayer | null>(null);
  const scramble = useRef<CubeScramble | null>(null);
  const { look } = useCubeLook();
  const { arrows, shape } = useTurnArrows();
  const [cubes, setCubes] = useState(listCubes);
  useEffect(() => onCubesChange(() => setCubes(listCubes())), []);
  const [battery, setBattery] = useState<number | null>(null);

  // This cube's look: the app's, with the cube's own parts over it.
  const skin = useMemo(() => {
    if (!session) return resolveSkin(look, "default");
    const known = cubes.find((c) => c.key === (session.info.mac ? session.info.mac.toUpperCase() : session.info.name));
    const auto = ((Object.keys(SKINS) as SkinName[]).find((k) => SKINS[k] === session.suggestedSkin) ?? "default") as SkinName;
    return resolveSkin(lookForCube(look, known?.look), auto);
  }, [session, look, cubes]);

  useEffect(() => {
    const p = document.createElement("cube-player") as CubePlayer;
    // The element's own 200 px minimum would overflow a player's half of a phone screen.
    p.style.minWidth = "0";
    p.style.minHeight = "0";
    p.setAttribute("controls", "none");
    p.style.width = "100%";
    p.style.height = "100%";
    playerHost.current?.append(p);
    player.current = p;
    const sc = document.createElement("cube-scramble") as CubeScramble;
    sc.setAttribute("controls", "none");
    sc.className = "act-sequence";
    scrambleHost.current?.append(sc);
    scramble.current = sc;
    return () => {
      p.remove();
      sc.remove();
    };
  }, []);

  useEffect(() => {
    if (player.current) player.current.skin = skin;
  }, [skin]);

  // Live: the cube in 3D follows the smart cube; the scramble is tracked on it.
  useEffect(() => {
    const p = player.current;
    const sc = scramble.current;
    if (!p || !sc) return;
    if (!session) {
      p.setup = solvedState();
      return;
    }
    const offPlayer = p.attach(session, { gyro: false });
    const offScramble = sc.attach(session);
    setBattery(session.battery);
    const offBattery = session.on("battery", setBattery);
    return () => {
      offPlayer();
      offScramble();
      offBattery();
    };
  }, [session]);

  useEffect(() => {
    const sc = scramble.current;
    if (!sc) return;
    sc.scramble = path ?? fallback ?? [];
  }, [path, fallback]);

  // Turn arrows (the app's setting) on this player's cube.
  useEffect(() => {
    const sc = scramble.current;
    if (!sc) return;
    sc.player = player.current;
    sc.setAttribute("arrow-shape", shape);
    if (arrows && session && phase === "scrambling") sc.setAttribute("arrows", "");
    else sc.removeAttribute("arrows");
  }, [arrows, shape, session, phase]);

  // Scrambled → ready.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  useEffect(() => {
    const sc = scramble.current;
    if (!sc) return;
    const done = () => onReadyRef.current();
    sc.addEventListener("complete", done);
    return () => sc.removeEventListener("complete", done);
  }, []);

  // Solved → the time (the solving move's).
  const onSolvedRef = useRef(onSolved);
  onSolvedRef.current = onSolved;
  useEffect(() => {
    if (!session) return;
    return session.on("move", (e) => {
      if (isSolved(e.state)) onSolvedRef.current(e.time);
    });
  }, [session]);

  const status = !session
    ? "Connect a cube"
    : phase === "loading"
      ? "Generating…"
      : phase === "scrambling"
        ? ready
          ? "Scrambled — waiting for the others"
          : "Scramble"
        : phase === "countdown"
          ? ""
          : result
            ? isWinner
              ? "Winner!"
              : winnerResult
                ? `${place >= 0 ? `${ORDINAL[place]} · ` : ""}+${fmt(result.timeMs - winnerResult.timeMs)}`
                : ""
            : "Solving…";

  return (
    <section className={`flex flex-col items-center gap-2 md:gap-4 px-1.5 md:px-8 min-w-0 ${divider ? "border-l border-white/[0.06]" : ""}`}>
      <div
        ref={scrambleHost}
        className={`versus-scramble ${compact ? "versus-compact" : ""} w-full max-w-xl min-h-16 md:min-h-24 text-gray-100 ${phase === "scrambling" || phase === "loading" ? "" : "invisible"}`}
      />

      <div className="relative flex flex-col items-center">
        <RoundTimer running={phase === "running" || phase === "done"} startAt={startAt} result={result} countdown={countdown} colour={isWinner ? colour : "#9ca3af"} />
        <p className="text-xs md:text-sm text-gray-500 min-h-5 mt-1 text-center">{status}</p>
        {isWinner && (
          <div className="absolute -top-9 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest" style={{ color: colour, background: `${colour}1f` }}>
            <Trophy size={13} /> Winner
          </div>
        )}
      </div>

      <div className={`w-full aspect-square ${compact ? "max-w-32 sm:max-w-44 md:max-w-60" : "max-w-40 sm:max-w-56 md:max-w-80"}`}>
        <div ref={playerHost} className="size-full" />
      </div>
      {!session && (
        <button onClick={onConnect} className="btn-secondary text-xs" style={{ color: colour, borderColor: `${colour}55` }} title="Connect this player's cube">
          <Bluetooth size={13} /> Connect cube
        </button>
      )}

      {session && (
        <div className="flex flex-wrap items-center justify-center gap-1 md:gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold max-w-full truncate" style={{ color: colour, background: `${colour}14` }}>
            <BluetoothConnected size={12} /> {session.info.name}
            {battery !== null && <span className="text-gray-400 font-normal">· {battery}%</span>}
          </span>
          <button
            onClick={() => session.markSolved()}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]"
            title="This cube is solved — track it from solved"
          >
            <CheckCheck size={12} /> Mark as solved
          </button>
          <button onClick={onDisconnect} className="px-2 py-1 rounded-lg text-[11px] font-semibold text-gray-500 hover:text-red-400 hover:bg-red-500/10" title="Disconnect this cube">
            Disconnect
          </button>
        </div>
      )}
      <p className="sr-only">{formatAlg(path ?? fallback ?? [])}</p>
    </section>
  );
}

/** The big timer — ticking on its own (only this re-renders every frame). */
function RoundTimer({ running, startAt, result, countdown, colour }: { running: boolean; startAt: number | null; result: Result | null; countdown: number | null; colour: string }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!running || result) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, result]);
  const ms = result ? result.timeMs : startAt !== null ? Math.max(0, now - startAt) : 0;
  return (
    <div className={`text-3xl sm:text-5xl md:text-6xl font-mono tabular-nums font-bold ${result ? "" : "text-white"}`} style={result ? { color: colour } : undefined}>
      {countdown !== null ? countdown : fmt(ms)}
    </div>
  );
}

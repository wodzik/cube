/**
 * VersusPage — two smart cubes, one scramble, who solves it first.
 *
 * Layout: the score card on top (names editable, Next round / Reset score),
 * then two columns — one per player — each with its scramble, a big timer
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
 * player 2 connects a second cube for this page only.
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
const COUNTDOWN_MS = 3000;
const COLOURS = ["#38bdf8", "#fb923c"] as const; // player 1 / player 2 (sky / orange)

type Phase = "idle" | "loading" | "scrambling" | "countdown" | "running" | "done";

interface Result {
  timeMs: number;
}

const fmt = (ms: number) => (ms / 1000).toFixed(2);

function readNames(): [string, string] {
  try {
    const n = JSON.parse(localStorage.getItem(NAMES_KEY) ?? "null") as [string, string] | null;
    if (Array.isArray(n) && n.length === 2) return n;
  } catch {
    // default
  }
  return ["Player 1", "Player 2"];
}

export default function VersusPage() {
  const app = useSmartCube();
  const [second, setSecond] = useState<{ session: SmartCubeSession; off: () => void } | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const sessions: [SmartCubeSession | null, SmartCubeSession | null] = [app.session, second?.session ?? null];

  const [names, setNamesState] = useState<[string, string]>(readNames);
  const setName = (i: 0 | 1, name: string) =>
    setNamesState((prev) => {
      const next: [string, string] = [...prev];
      next[i] = name;
      try {
        localStorage.setItem(NAMES_KEY, JSON.stringify(next));
      } catch {
        // not persisted
      }
      return next;
    });
  const [score, setScore] = useState<[number, number]>([0, 0]);

  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [official, setOfficial] = useState<{ moves: Move[]; state: State } | null>(null);
  const [paths, setPaths] = useState<[Move[] | null, Move[] | null]>([null, null]);
  const [ready, setReady] = useState<[boolean, boolean]>([false, false]);
  const [results, setResults] = useState<[Result | null, Result | null]>([null, null]);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [winner, setWinner] = useState<0 | 1 | null>(null);

  // ─── connecting player 2 ───

  const connectSecond = async () => {
    setConnectError(null);
    try {
      const session = await openCubeSession();
      if (app.session && session.info.name === app.session.info.name) {
        await session.disconnect().catch(() => undefined);
        throw new Error("That cube is already player 1's — pick the other one");
      }
      const { off } = trackKnownCube(session);
      const offDisconnect = session.on("disconnect", () => setSecond(null));
      setSecond({ session, off: () => (off(), offDisconnect()) });
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Could not connect");
    }
  };
  const disconnectSecond = async () => {
    const s = second;
    setSecond(null);
    s?.off();
    await s?.session.disconnect().catch(() => undefined);
  };
  // Dev only: a simulated cube for player 2 (headless checks) — __nactVersusConnect(), __nactVersusMove("R").
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __nactVersusConnect?: () => void; __nactVersusMove?: (m: string) => void };
    let cube: SimulatedCube | null = null;
    w.__nactVersusConnect = () => {
      cube = new SimulatedCube();
      const session = new SmartCubeSessionClass(cube);
      setSecond({ session, off: () => undefined });
    };
    w.__nactVersusMove = (m) => cube?.turn(m);
    return () => {
      delete w.__nactVersusConnect;
      delete w.__nactVersusMove;
    };
  }, []);

  // Player 2's cube is this page's own: let it go with the page.
  const secondRef = useRef(second);
  secondRef.current = second;
  useEffect(
    () => () => {
      secondRef.current?.off();
      void secondRef.current?.session.disconnect().catch(() => undefined);
    },
    []
  );

  // ─── a round ───

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  /** The way from each cube's state to the scrambled one. */
  const planPaths = useCallback(async (target: { moves: Move[]; state: State }) => {
    const plan = async (s: SmartCubeSession | null): Promise<Move[]> => {
      if (!s || statesEqual(s.state, solvedState())) return target.moves;
      return (await cubecoreSolver().solveBetween(s.state, target.state)) ?? target.moves;
    };
    const [a, b] = sessionsRef.current;
    setPaths([await plan(a), await plan(b)]);
    setReady([false, false]);
  }, []);

  const newRound = useCallback(async () => {
    setPhase("loading");
    setResults([null, null]);
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
  const sessionKey = `${app.session?.info.name ?? ""}|${second?.session.info.name ?? ""}|${app.resyncs}`;
  useEffect(() => {
    if (phaseRef.current === "scrambling" && official) void planPaths(official);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  // Both scrambled → 3-2-1 → go.
  useEffect(() => {
    if (phase === "scrambling" && ready[0] && ready[1]) setPhase("countdown");
  }, [phase, ready]);
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

  const onReady = useCallback((i: 0 | 1) => setReady((r) => (i === 0 ? [true, r[1]] : [r[0], true])), []);

  const resultsRef = useRef(results);
  resultsRef.current = results;
  const onSolved = useCallback(
    (i: 0 | 1, time: number) => {
      if ((phaseRef.current !== "running" && phaseRef.current !== "done") || startAt === null) return;
      const prev = resultsRef.current;
      if (prev[i]) return;
      const next: [Result | null, Result | null] = [...prev];
      next[i] = { timeMs: Math.max(0, time - startAt) };
      resultsRef.current = next;
      setResults(next);
      // The first one solved wins the round.
      if (!prev[0] && !prev[1]) {
        setWinner(i);
        setScore((s) => (i === 0 ? [s[0] + 1, s[1]] : [s[0], s[1] + 1]));
        setPhase("done");
      }
    },
    [startAt]
  );

  const bothConnected = !!sessions[0] && !!sessions[1];

  return (
    <main className="w-full px-4 sm:px-6 py-3 flex flex-col gap-4">
      <PageLabel className="pt-1.5">Versus</PageLabel>
      {/* Score */}
      <div className="flex flex-col items-center gap-2">
        <div className="panel px-3 sm:px-6 py-3 flex items-center gap-3 sm:gap-6">
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
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void newRound()} disabled={phase === "loading" || phase === "countdown"} className="btn-secondary text-xs">
            <RefreshCw size={13} /> {phase === "done" ? "Next round" : "New scramble"}
          </button>
          <button onClick={() => setScore([0, 0])} className="btn-secondary text-xs" title="Start the score again">
            <RotateCcw size={13} /> Reset score
          </button>
        </div>
        <p className="text-xs text-gray-500 min-h-4 text-center">
          {!bothConnected
            ? "Connect both cubes — each scrambles the same scramble, then 3-2-1 and go."
            : phase === "scrambling"
              ? "Scramble your cube — the round starts when both are scrambled."
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

      {/* The two players — side by side on every screen (smaller on phones) */}
      <div className="grid grid-cols-2">
        {([0, 1] as const).map((i) => (
          <PlayerSide
            key={i}
            index={i}
            colour={COLOURS[i]}
            session={sessions[i]}
            path={paths[i]}
            fallback={official?.moves ?? null}
            phase={phase}
            countdown={countdown}
            startAt={startAt}
            result={results[i]}
            other={results[i === 0 ? 1 : 0]}
            isWinner={winner === i}
            ready={ready[i]}
            onReady={() => onReady(i)}
            onSolved={(t) => onSolved(i, t)}
            onConnect={i === 0 ? () => void app.connect() : () => void connectSecond()}
            onDisconnect={i === 0 ? () => void app.disconnect() : () => void disconnectSecond()}
          />
        ))}
      </div>
    </main>
  );
}

function ScoreName({ name, colour, onChange }: { name: string; colour: string; onChange: (n: string) => void }) {
  return (
    <input
      defaultValue={name}
      onBlur={(e) => onChange(e.target.value.trim() || name)}
      className="w-20 sm:w-28 bg-transparent text-center text-sm font-semibold outline-none border-b border-transparent hover:border-white/10 focus:border-white/20"
      style={{ color: colour }}
      title="Name"
    />
  );
}

function PlayerSide({
  index,
  colour,
  session,
  path,
  fallback,
  phase,
  countdown,
  startAt,
  result,
  other,
  isWinner,
  ready,
  onReady,
  onSolved,
  onConnect,
  onDisconnect,
}: {
  index: 0 | 1;
  colour: string;
  session: SmartCubeSession | null;
  path: Move[] | null;
  fallback: Move[] | null;
  phase: Phase;
  countdown: number | null;
  startAt: number | null;
  result: Result | null;
  other: Result | null;
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
          ? "Scrambled — waiting for the other player"
          : "Scramble"
        : phase === "countdown"
          ? ""
          : result
            ? isWinner
              ? "Winner!"
              : other
                ? `+${fmt(result.timeMs - other.timeMs)}`
                : ""
            : "Solving…";

  return (
    <section className={`flex flex-col items-center gap-2 md:gap-4 px-1.5 md:px-8 min-w-0 ${index === 1 ? "border-l border-white/[0.06]" : ""}`}>
      <div
        ref={scrambleHost}
        className={`versus-scramble w-full max-w-xl min-h-16 md:min-h-24 text-gray-100 ${phase === "scrambling" || phase === "loading" ? "" : "invisible"}`}
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

      <div className="w-full max-w-40 sm:max-w-56 md:max-w-80 aspect-square">
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

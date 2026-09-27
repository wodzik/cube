/**
 * TrainersPage — the skill trainers (cross, XCross, pairs, F2L slots, Roux
 * blocks / CMLL / EOLR / LSE, ZZ EOLine / EOCross / blocks) on cubecore.
 *
 * Thin controller over the shared session reducer + TrainerPanel, like
 * SolvePage:
 *
 * 1. A case comes from cubecore's solver worker with a KNOWN exact optimal
 *    length (stageScramble), or at random for the level-less drills (F2L
 *    slots, CMLL). The scramble goes FROM THE CUBE'S CURRENT STATE — the
 *    app-wide SmartCubeSession's, so it's right whatever happened on other
 *    pages — to the case: no need to solve the cube between attempts.
 *    "Case" mode skips the scramble: the case is on the screen and the
 *    moves you make are played onto it.
 * 2. The attempt starts with the first move after the scramble and stops
 *    the moment the practised step is done (the solver's distance hits 0;
 *    F2L / CMLL checked locally) — not when the whole cube is.
 * 3. Verdict: moves vs the optimum, which moves didn't bring you closer
 *    (distance after each), every optimal solution; hint / solution on
 *    demand from wherever you are; retry any past case.
 *
 * Colours: the colour you build on goes down (white for CFOP / ZZ, yellow
 * for Roux by default); the cube is shown and the solutions lettered as
 * you hold it. Scrambles stay physical moves (white up, green front).
 */

import { activeCubeId, cubeLabel } from "../services/cubeRegistry";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Lightbulb, Repeat2, Trash2, TrendingUp, RefreshCw } from "lucide-react";
import {
  type Frame,
  type Move,
  type State,
  FRAMES,
  applyMoves,
  buildMask,
  decodeState,
  encodeState,
  formatAlg,
  parseAlg,
  solvedState,
  statesEqual,
  isSolved,
  unreframe,
  invert,
  toFaceTurns,
  view as viewOf,
} from "@wodzik/cubecore/core";
import type { F2LSlot } from "@wodzik/cubecore/cfop";
import { CMLL_CASES, cmllCaseState, recognizeCmll } from "@wodzik/cubecore/roux";
import { OLL_CASES, PLL_CASES, recognizeOll, recognizePll } from "@wodzik/cubecore/cfop";
import { SessionProvider, useSession } from "../state/sessionContext";
import type { TrainerRequest } from "../services/trainerNav";
import { selectCurrentProgress, selectMoveCount, selectSolveTimeMs, selectTracking } from "../state/sessionSelectors";
import { collapseIdenticalMoves, collapseToStm } from "../logic/moveReduction";
import {
  BOTTOM_COLOURS,
  DEFAULT_BOTTOM,
  FAMILIES,
  type Family,
  SLOTS,
  TRAINERS,
  type TrainerDef,
  doneLocally,
  f2lKeep,
  frameForBottom,
  trainerById,
} from "../logic/trainerCatalog";
import { heldAlg } from "../logic/frameView";
import { cubecoreSolver } from "../services/cubecoreSolver";
import { getTrainerAttempts, saveTrainerAttempt, deleteTrainerAttempt } from "../services/trainerStore";
import { formatTimeMs } from "../logic/statistics";
import { useSmartCube } from "../hooks/useSmartCube";
import { useAnimationTimer } from "../hooks/useAnimationTimer";
import { useCaseViewPrefs } from "../hooks/useCaseViewPrefs";
import { useCubeViewRefs } from "../hooks/useCubeViewRefs";
import { CaseViewToggles } from "../components/CaseViewToggles";
import { TrainerPanel } from "../components/TrainerPanel";
import { ConnectionPanel } from "../components/ConnectionPanel";
import { SolveControls } from "../components/SolveControls";
import { TrainerSummary } from "../components/TrainerSummary";
import { AlgCaseVisualisation } from "../components/AlgCaseVisualisation";
import type { CrossMoveAnalysis } from "../components/TrainerSummary";
import type { SessionConfig } from "../types/session";
import type { TrainerAttempt, TrainerType } from "../types/trainer";
import type { Face } from "@wodzik/cubecore/core";

const STORAGE_KEY = "nact_trainers";
const LADDER_STORAGE_KEY = "nact_trainer_ladder";
/** Ladder mode: bump the level after this many attempts at it with at least this optimal rate. */
const LADDER_WINDOW = 10;
const LADDER_THRESHOLD = 0.8;
const OPTIMAL_SOLUTIONS_SHOWN = 8;

const TRAINER_CONFIG: SessionConfig = {
  mode: "solve",
  startMethod: ["cube-move"],
  stopMethod: ["stage-solved"],
  useInspection: false,
  inspectionSeconds: 15,
};

// ─── settings (persisted) ───

interface Settings {
  type: TrainerType;
  lastByFamily: Record<Family, TrainerType>;
  variants: Partial<Record<TrainerType, string>>;
  levels: Partial<Record<TrainerType, number>>;
  slots: F2LSlot[];
  bottom: Record<Family, Face>;
  virtual: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  type: "cross",
  lastByFamily: { cross: "cross", f2l: "f2l", ll: "oll", roux: "fb", zz: "eoline" },
  variants: {},
  levels: {},
  slots: ["FR"],
  bottom: { ...DEFAULT_BOTTOM },
  virtual: false,
};

function readSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Settings> | null;
    const s = { ...DEFAULT_SETTINGS, ...raw, bottom: { ...DEFAULT_BOTTOM, ...raw?.bottom }, lastByFamily: { ...DEFAULT_SETTINGS.lastByFamily, ...raw?.lastByFamily } };
    if (!trainerById(s.type)) s.type = "cross";
    if (!s.slots.length) s.slots = ["FR"];
    return s;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const variantOf = (def: TrainerDef, s: Settings) => {
  const v = s.variants[def.id];
  return def.variants && v && def.variants.options.some(([o]) => o === v) ? v : (def.variants?.default ?? "");
};
const levelOf = (def: TrainerDef, s: Settings) => {
  if (!def.levels) return null;
  const l = s.levels[def.id] ?? def.levels.default;
  return Math.min(def.levels.max, Math.max(def.levels.min, l));
};
const slotLabel = (slots: readonly string[]) => slots.join("+");

/** "Insert the FR pair", "…the FR+FL pairs". */
function goalText(def: TrainerDef, variant: string, slots: readonly string[]): string {
  const v = def.id === "f2l" ? `${slotLabel(slots)} ${slots.length > 1 ? "pairs" : "pair"}` : variant;
  return def.goal.replace("{v}", v);
}

// ─── the attempt in play ───

interface Attempt {
  def: TrainerDef;
  variant: string;
  slots: F2LSlot[];
  frame: Frame;
  bottom: Face;
  /** Optimal length it was drawn at (null: no level). */
  level: number | null;
  /** The case: the cube's physical state once the scramble is done. */
  caseState: State;
  /** The scramble, physical moves (empty in case mode). */
  scramble: Move[];
  virtual: boolean;
  cmllCase?: string;
}

interface Summary {
  attempt: TrainerAttempt;
  analysis: CrossMoveAnalysis[];
  optimalSolutions: string[];
}

export default function TrainersPage({ request }: { request?: TrainerRequest | null }) {
  return (
    <SessionProvider config={TRAINER_CONFIG}>
      <TrainersInner request={request ?? null} />
    </SessionProvider>
  );
}

function TrainersInner({ request }: { request: TrainerRequest | null }) {
  const { state, submitCubeMove, setTarget, confirmManualSetup, signalStop } = useSession();
  const { cubeRef, flatCubeRef, view } = useCubeViewRefs();

  const [settings, setSettingsState] = useState<Settings>(readSettings);
  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // not persisted
      }
      return next;
    });
  }, []);
  const def = trainerById(settings.type) ?? TRAINERS[0];
  const family = def.family;
  const variant = variantOf(def, settings);
  const level = levelOf(def, settings);
  const bottom = settings.bottom[family];

  const [current, setCurrent] = useState<Attempt | null>(null);
  const currentRef = useRef(current);
  currentRef.current = current;
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<TrainerAttempt[]>(() => getTrainerAttempts());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [revealed, setRevealed] = useState<string[] | null>(null);
  const [isRevealLoading, setIsRevealLoading] = useState(false);
  const [ladderEnabled, setLadderEnabled] = useState(() => localStorage.getItem(LADDER_STORAGE_KEY) === "true");
  const [info, setInfo] = useState<string | null>(null);
  const hintUsedRef = useRef(false);
  const viewPrefs = useCaseViewPrefs(family === "f2l", "trainer");
  const { backStickers, flatView } = viewPrefs;

  const phaseRef = useRef(state.phase);
  phaseRef.current = state.phase;
  const moveCounterRef = useRef(0);
  const generationSeqRef = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // ─── moves ───

  const handleMove = useCallback(
    (move: string, timestamp: number) => {
      moveCounterRef.current++;
      submitCubeMove(move, timestamp);
      // Case mode: the view shows the CASE — fiddling between attempts must not distort it.
      if (currentRef.current?.virtual && (phaseRef.current === "done" || phaseRef.current === "idle")) return;
      view.addMove(move);
    },
    [submitCubeMove, view]
  );
  const cube = useSmartCube({ onMove: handleMove });
  const sessionRef = useRef(cube.session);
  sessionRef.current = cube.session;

  // ─── generating a case ───

  const setTargetRef = useRef(setTarget);
  setTargetRef.current = setTarget;
  const confirmRef = useRef(confirmManualSetup);
  confirmRef.current = confirmManualSetup;

  const startNextAttempt = useCallback(async (retry?: { caseState: State; attempt: TrainerAttempt }) => {
    const seq = ++generationSeqRef.current;
    const s = settingsRef.current;
    const d = retry ? (trainerById(retry.attempt.type) ?? TRAINERS[0]) : (trainerById(s.type) ?? TRAINERS[0]);
    const fam = d.family;
    const v = retry ? (retry.attempt.slot ?? variantOf(d, s)) : variantOf(d, s);
    const slots = retry ? ((retry.attempt.slots as F2LSlot[] | undefined) ?? s.slots) : s.slots;
    const lvl = retry ? (retry.attempt.targetLength || null) : levelOf(d, s);
    const frame = retry && retry.attempt.frameId !== undefined ? FRAMES[retry.attempt.frameId] : frameForBottom(s.bottom[fam]);
    const bottomFace = frame.face.D;
    const virtual = s.virtual;
    setIsGenerating(true);
    setGenError(null);
    try {
      const solver = cubecoreSolver();
      for (let tries = 0; tries < 3; tries++) {
        const from = virtual ? solvedState() : (sessionRef.current?.state ?? solvedState());
        const movesAtStart = moveCounterRef.current;
        let caseState: State;
        let scramble: Move[];
        let cmllCase: string | undefined;
        if (retry) {
          caseState = retry.caseState;
          scramble = virtual ? [] : ((await solver.solveBetween(from, caseState)) ?? []);
        } else if (d.id === "cmll") {
          const pool = CMLL_CASES.filter((c) => v === "all" || c.group === v).filter((c) => c.group !== "Solved");
          const kase = pool[Math.floor(Math.random() * pool.length)];
          cmllCase = kase.id;
          caseState = unreframe(cmllCaseState(kase.id), frame);
          scramble = virtual ? [] : ((await solver.solveBetween(from, caseState)) ?? []);
        } else if (d.id === "oll" || d.id === "pll") {
          // A random case of the group, with random AUFs — for OLL a random permutation too (as it comes in a solve).
          const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
          const auf = () => pick(["", "U", "U2", "U'"]);
          const pool = (d.id === "oll" ? OLL_CASES : PLL_CASES).filter((c) => v === "all" || c.group === v);
          const kase = pick(pool);
          cmllCase = kase.id;
          const solution = d.id === "oll" ? `${auf()} ${kase.alg} ${auf()} ${pick(PLL_CASES).alg} ${auf()}` : `${auf()} ${kase.alg} ${auf()}`;
          // As face turns (rotations in the algorithms become the grip): the centres stay home.
          const turns = toFaceTurns(solution).moves;
          caseState = unreframe(applyMoves(solvedState(), invert(turns)), frame);
          scramble = virtual ? [] : ((await solver.solveBetween(from, caseState)) ?? []);
        } else if (d.id === "f2l") {
          const r = await solver.randomScramble({ preset: "f2l", keep: f2lKeep(slots, v === "free"), frame, from });
          caseState = r.state;
          scramble = r.moves;
        } else {
          const stage = d.stage(v, slots)!;
          const r = await solver.stageScramble({ stage, length: lvl!, frame, from });
          if (!r) throw new Error(`No ${d.label} case at ${lvl} moves`);
          caseState = r.state;
          scramble = r.moves;
        }
        if (generationSeqRef.current !== seq) return;
        // The scramble is only good from the state it was made for: the cube moved meanwhile → again.
        if (!virtual && moveCounterRef.current !== movesAtStart) continue;
        if (!virtual && sessionRef.current && !statesEqual(sessionRef.current.state, from)) continue;
        const attempt: Attempt = { def: d, variant: v, slots, frame, bottom: bottomFace, level: lvl, caseState, scramble: virtual ? [] : scramble, virtual, cmllCase };
        setCurrent(attempt);
        setHint(null);
        setRevealed(null);
        hintUsedRef.current = false;
        if (virtual) {
          view.setState(caseState);
          setTargetRef.current("");
          confirmRef.current();
        } else {
          setTargetRef.current(formatAlg(attempt.scramble));
        }
        return;
      }
      setGenError("Cube kept moving during generation — hold it still, then press refresh.");
    } catch (err) {
      if (generationSeqRef.current === seq) setGenError(err instanceof Error ? err.message : "Failed to generate a case");
    } finally {
      if (generationSeqRef.current === seq) setIsGenerating(false);
    }
  }, [view]);

  const regenerate = useCallback(() => {
    setSummary(null);
    void startNextAttempt();
  }, [startNextAttempt]);

  // Opened on one case (a solve's cross… — services/trainerNav): its trainer, level,
  // colour and mode, then that exact case as the first one.
  const pendingCase = useRef<{ caseState: State; attempt: TrainerAttempt } | null>(null);
  const [requestSeq, setRequestSeq] = useState(0);
  useEffect(() => {
    if (!request) return;
    const d = trainerById(request.type);
    if (!d) return;
    const s = settingsRef.current;
    setSettings({
      type: d.id,
      lastByFamily: { ...s.lastByFamily, [d.family]: d.id },
      levels: { ...s.levels, [d.id]: request.level },
      bottom: { ...s.bottom, [d.family]: request.bottom },
      virtual: request.virtual,
    });
    pendingCase.current = {
      caseState: request.caseState,
      attempt: { type: d.id, targetLength: request.level, frameId: frameForBottom(request.bottom).id } as TrainerAttempt,
    };
    setRequestSeq((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  // First case, and a new one whenever what's practised changes (or a requested case).
  const choiceKey = `${def.id}|${variant}|${level}|${settings.slots.join()}|${bottom}|${settings.virtual}`;
  useEffect(() => {
    const pending = pendingCase.current;
    pendingCase.current = null;
    if (pending) {
      setSummary(null);
      setInfo(`This case from your solve — optimal ${pending.attempt.targetLength}`);
      void startNextAttempt(pending);
    } else void startNextAttempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choiceKey, requestSeq]);

  // The view follows the real cube from where the scramble starts (case mode: set with the case).
  const targetStart = state.target?.start;
  useEffect(() => {
    if (!currentRef.current?.virtual && targetStart) view.setState(targetStart);
  }, [targetStart, view]);

  // ─── done? ───

  const nowState = useCallback(
    (a: Attempt) => (state.phase === "active" || state.phase === "done" ? applyMoves(a.caseState, state.moveLog.map((m) => m.move).join(" ")) : a.caseState),
    [state.phase, state.moveLog]
  );

  useEffect(() => {
    const a = current;
    if (!a || state.phase !== "active" || !state.moveLog.length) return;
    const now = nowState(a);
    const last = state.moveLog[state.moveLog.length - 1].timestamp;
    const local = doneLocally(a.def, now, a.frame, a.variant, a.slots);
    if (local !== null) {
      if (local) signalStop("stage-solved", last);
      return;
    }
    const stage = a.def.stage(a.variant, a.slots);
    if (!stage) return;
    let cancelled = false;
    void cubecoreSolver()
      .stageDistance(stage, now, { frame: a.frame })
      .then((d) => {
        if (!cancelled && d === 0 && phaseRef.current === "active") signalStop("stage-solved", last);
      });
    return () => {
      cancelled = true;
    };
  }, [current, state.phase, state.moveLog, nowState, signalStop]);

  // ─── hint / solution ───

  const solutionsFrom = useCallback(async (a: Attempt, from: State, limit: number): Promise<string[]> => {
    if (a.def.id === "cmll" || a.def.id === "oll" || a.def.id === "pll") {
      // The case's algorithm (after the AUF it needs), as held.
      try {
        const held = viewOf(from, a.frame);
        const m = a.def.id === "cmll" ? recognizeCmll(held) : a.def.id === "oll" ? recognizeOll(held) : recognizePll(held);
        if (m) {
          const alg = `${m.preAuf} ${m.alg}`.trim();
          if (a.def.id !== "pll") return [alg];
          // PLL ends with the cube solved: the last AUF too.
          const after = applyMoves(held, toFaceTurns(alg).moves);
          const auf = ["", "U", "U2", "U'"].find((u) => isSolved(u ? applyMoves(after, u) : after)) ?? "";
          return [`${alg} ${auf}`.trim()];
        }
        // Solved but for the AUF.
        for (const auf of ["U", "U2", "U'"]) if (a.def.id === "pll" && isSolved(applyMoves(held, auf))) return [auf];
        return [];
      } catch {
        return []; // not that step any more (e.g. F2L broken)
      }
    }
    const stage = a.def.stage(a.variant, a.slots);
    if (!stage) return [];
    const sols = await cubecoreSolver().stageSolve(stage, from, { frame: a.frame, all: limit > 1, limit });
    return sols.map((s) => heldAlg(s, a.frame));
  }, []);

  const requestHint = async () => {
    if (!current || isHintLoading) return;
    setIsHintLoading(true);
    try {
      const [first] = await solutionsFrom(current, nowState(current), 1);
      if (first) {
        setHint(first.split(" ")[0]);
        hintUsedRef.current = true;
      }
    } finally {
      setIsHintLoading(false);
    }
  };

  const requestReveal = async () => {
    if (!current || isRevealLoading) return;
    setIsRevealLoading(true);
    try {
      const sols = await solutionsFrom(current, nowState(current), OPTIMAL_SOLUTIONS_SHOWN);
      if (sols.length) {
        setRevealed(sols);
        hintUsedRef.current = true;
      }
    } finally {
      setIsRevealLoading(false);
    }
  };

  // A hint is for the state it was asked in — the next move makes it stale.
  const solveMoveCount = state.moveLog.length;
  useEffect(() => setHint(null), [solveMoveCount]);

  // ─── the verdict ───

  const solveTimeMs = selectSolveTimeMs(state);

  // When the case was there to recognise: shown (Recognize) or scrambled (the last scramble move).
  const readyAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (state.phase !== "ready") return;
    readyAtRef.current = currentRef.current?.virtual ? performance.now() : (state.moveLog.at(-1)?.timestamp ?? performance.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);
  const recognitionMs = state.phase === "active" || state.phase === "done" ? (state.moveLog[0] && readyAtRef.current !== null ? Math.max(0, state.moveLog[0].timestamp - readyAtRef.current) : null) : null;
  const ladderRef = useRef(ladderEnabled);
  ladderRef.current = ladderEnabled;
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (state.phase !== "done") {
      notifiedRef.current = false;
      return;
    }
    const a = current;
    if (notifiedRef.current || !a || solveTimeMs === null) return;
    notifiedRef.current = true;

    const solveMoves = state.moveLog.map((m) => m.move);
    const collapsed = collapseIdenticalMoves(solveMoves);
    const counted = a.def.stm ? collapseToStm(solveMoves) : collapsed;
    const moveLog = state.moveLog;
    const timeMs = solveTimeMs;

    void (async () => {
      const optimal = await solutionsFrom(a, a.caseState, OPTIMAL_SOLUTIONS_SHOWN).catch(() => []);
      // Cases solved by algorithm (CMLL, OLL, PLL): no optimum to measure against.
      const optimalLength = a.level ?? (["cmll", "oll", "pll"].includes(a.def.id) ? 0 : (optimal[0]?.split(" ").filter(Boolean).length ?? 0));
      // Which moves didn't bring the step closer: the solver's distance after each.
      const analysis: CrossMoveAnalysis[] = [];
      const stage = a.def.stage(a.variant, a.slots);
      if (stage && collapsed.length <= 40) {
        let s = a.caseState;
        let before = await cubecoreSolver().stageDistance(stage, s, { frame: a.frame });
        for (const move of collapsed) {
          s = applyMoves(s, move);
          const after = await cubecoreSolver().stageDistance(stage, s, { frame: a.frame });
          analysis.push({ move: heldAlg(parseAlg(move), a.frame), distBefore: before, distAfter: after, wasted: after >= before });
          before = after;
        }
      }
      const attempt: TrainerAttempt = {
        id: crypto.randomUUID(),
        endedAt: Date.now(),
        type: a.def.id,
        face: a.bottom as TrainerAttempt["face"],
        slot: a.variant || undefined,
        slots: a.def.id === "f2l" ? a.slots : undefined,
        targetLength: a.level ?? 0,
        scramble: a.virtual ? "" : formatAlg(a.scramble),
        timeMs,
        moves: moveLog,
        moveCount: counted.length,
        optimalLength,
        overhead: optimalLength ? counted.length - optimalLength : 0,
        wastedMoveCount: analysis.length ? analysis.filter((x) => x.wasted).length : undefined,
        hintUsed: hintUsedRef.current || undefined,
        caseState: encodeState(a.caseState) ?? undefined,
        frameId: a.frame.id,
        virtual: a.virtual || undefined,
        recognitionMs: moveLog[0] && readyAtRef.current !== null ? Math.max(0, moveLog[0].timestamp - readyAtRef.current) : undefined,
        caseName: a.cmllCase,
        isDNF: false,
        cube: activeCubeId(),
      };
      saveTrainerAttempt(attempt);
      setAttempts(getTrainerAttempts());
      setSummary({ attempt, analysis, optimalSolutions: optimal });

      // Ladder: level up after LADDER_WINDOW attempts at this level ≥ LADDER_THRESHOLD optimal.
      const s = settingsRef.current;
      const d = a.def;
      if (ladderRef.current && d.levels && a.level !== null && d.id === s.type && a.level === levelOf(d, s) && a.level < d.levels.max) {
        const recent = getTrainerAttempts()
          .filter((x) => x.type === d.id && x.targetLength === a.level)
          .slice(-LADDER_WINDOW);
        if (recent.length >= LADDER_WINDOW && recent.filter((x) => x.overhead <= 0).length / recent.length >= LADDER_THRESHOLD) {
          setInfo(`Level up! ≥${LADDER_THRESHOLD * 100}% optimal over ${LADDER_WINDOW} attempts — optimal ${a.level + 1}`);
          setSettings({ levels: { ...s.levels, [d.id]: a.level + 1 } });
          return; // the level change starts the next case
        }
      }
      void startNextAttempt();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, solveTimeMs]);

  // The verdict (and a notice) stays until the next scramble — or, in case mode, the next attempt — begins.
  useEffect(() => {
    if (!summary && !info) return;
    const started = (state.phase === "setup" || (current?.virtual && state.phase === "active")) && state.moveLog.length > 0;
    if (started) {
      setSummary(null);
      setInfo(null);
    }
  }, [summary, info, state.phase, state.moveLog.length, current]);

  // ─── choices ───

  const changeType = (t: TrainerType) => setSettings({ type: t, lastByFamily: { ...settings.lastByFamily, [trainerById(t)!.family]: t } });
  const changeFamily = (f: Family) => f !== family && changeType(settings.lastByFamily[f]);
  const changeVariant = (v: string) => setSettings({ variants: { ...settings.variants, [def.id]: v } });
  const changeLevel = (n: number) => setSettings({ levels: { ...settings.levels, [def.id]: n } });
  const changeBottom = (f: Face) => setSettings({ bottom: { ...settings.bottom, [family]: f } });
  const toggleSlot = (s: F2LSlot) => {
    const next = settings.slots.includes(s) ? settings.slots.filter((x) => x !== s) : SLOTS.filter((x) => settings.slots.includes(x) || x === s);
    if (next.length) setSettings({ slots: next });
  };
  const toggleLadder = () => {
    setLadderEnabled(!ladderEnabled);
    localStorage.setItem(LADDER_STORAGE_KEY, String(!ladderEnabled));
  };
  // "Mark as solved" (by the cube button) or a state the cube reports: a scramble to the case is planned again.
  const resyncs = cube.resyncs;
  const firstResyncRef = useRef(resyncs);
  useEffect(() => {
    if (resyncs === firstResyncRef.current || currentRef.current?.virtual) return;
    if (phaseRef.current === "setup" || phaseRef.current === "ready" || phaseRef.current === "idle") {
      const a = currentRef.current;
      setSummary(null);
      // The same case, from where the cube is now.
      if (a) void startNextAttempt({ caseState: a.caseState, attempt: { type: a.def.id, slot: a.variant, slots: a.slots, targetLength: a.level ?? 0, frameId: a.frame.id } as TrainerAttempt });
      else void startNextAttempt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resyncs]);
  const retryAttempt = (a: TrainerAttempt) => {
    const caseState = a.caseState ? decodeState(a.caseState) : null;
    if (!caseState) return;
    setSummary(null);
    setInfo(`Retrying the same ${trainerById(a.type)?.label ?? a.type} case${a.optimalLength ? ` (optimal ${a.optimalLength})` : ""}`);
    void startNextAttempt({ caseState, attempt: a });
  };

  // ─── stats ───

  const scopeAttempts = useMemo(() => {
    const set = [...settings.slots].sort().join(",");
    return attempts.filter(
      (a) =>
        a.type === def.id &&
        // Scramble and Recognize apart: their times don't compare.
        !!a.virtual === settings.virtual &&
        (!def.levels
          ? def.id !== "f2l" || ([...(a.slots ?? [])].sort().join(",") === set && (a.slot ?? "solved") === variant)
          : a.targetLength === level)
    );
  }, [attempts, def.id, def.levels, level, settings.slots, settings.virtual, variant]);
  const recognitions = scopeAttempts.flatMap((a) => (a.recognitionMs !== undefined ? [a.recognitionMs] : []));
  const avgRecognition = recognitions.length ? recognitions.reduce((x, y) => x + y, 0) / recognitions.length : null;
  const recognitionStat =
    avgRecognition !== null ? (
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Avg recognition</p>
        <p className="text-3xl font-mono tabular-nums font-bold text-white mt-1">{(avgRecognition / 1000).toFixed(2)} s</p>
      </div>
    ) : null;
  const optimalRate = scopeAttempts.length ? Math.round((scopeAttempts.filter((a) => a.overhead <= 0).length / scopeAttempts.length) * 100) : null;
  const avgOverhead = scopeAttempts.length ? scopeAttempts.reduce((sum, a) => sum + a.overhead, 0) / scopeAttempts.length : null;
  const avgMoves = scopeAttempts.length ? scopeAttempts.reduce((sum, a) => sum + a.moveCount, 0) / scopeAttempts.length : null;
  const bestMoves = scopeAttempts.length ? Math.min(...scopeAttempts.map((a) => a.moveCount)) : null;
  const recentAttempts = useMemo(() => [...scopeAttempts].reverse().slice(0, 30), [scopeAttempts]);

  // ─── view ───

  const shown = current ?? null;
  const shownDef = shown?.def ?? def;
  const frame = shown?.frame ?? frameForBottom(bottom);
  const mask = useMemo(
    () => buildMask(shownDef.mask(shown?.variant ?? variant, shown?.slots ?? settings.slots), frame),
    [shownDef, shown?.variant, shown?.slots, variant, settings.slots, frame]
  );
  const isRouxView = shownDef.family === "roux";

  const displaySec = useAnimationTimer(state.startTime, state.endTime, state.phase === "active");
  const moveCount = selectMoveCount(state);
  const progress = selectCurrentProgress(state);
  const targetTokens = state.targetNotation.trim().split(/\s+/).filter(Boolean);
  const timerState: "idle" | "solving" | "solved" = state.phase === "active" ? "solving" : state.phase === "done" ? "solved" : "idle";
  const hintText =
    state.phase === "setup"
      ? summary
        ? "Next scramble is ready — perform it when you are"
        : "Perform the scramble shown above"
      : state.phase === "ready"
        ? shown?.virtual
          ? "Recognise the case — your first move starts the clock"
          : "Make a move to start"
        : state.phase === "active"
          ? shown
            ? `${goalText(shown.def, shown.variant, shown.slots)}${recognitionMs !== null ? ` · recognised in ${(recognitionMs / 1000).toFixed(2)} s` : ""}`
            : null
          : state.phase === "done"
            ? shown?.level
              ? `${moveCount} moves · optimal ${shown.level}`
              : `${moveCount} moves`
            : null;
  const loadingText = isGenerating
    ? "Generating a case… (the first one of a kind builds its tables)"
    : (genError ?? (shown?.virtual ? "Recognize — no scramble: the case is on the screen; recognise it and solve it from there" : undefined));
  const canHint = shown && (["cmll", "oll", "pll"].includes(shown.def.id) || shown.def.stage(shown.variant, shown.slots) !== null);

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${active ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"}`;
  const chipStyle = (active: boolean) => (active ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined);

  return (
    <TrainerPanel
      title="Steps"
      header={
        <div className="w-full overflow-x-auto">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex items-center gap-0.5 shrink-0 rounded-xl bg-white/[0.03] p-0.5">
              {FAMILIES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => changeFamily(f.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-[10px] transition-all ${family === f.id ? "text-white bg-white/[0.1]" : "text-gray-500 hover:text-gray-300"}`}
                  style={family === f.id ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[9px] text-gray-600 uppercase tracking-wider mr-1">On</span>
              {BOTTOM_COLOURS.map(([face, name, colour]) => (
                <button
                  key={face}
                  onClick={() => changeBottom(face)}
                  title={`${name} down`}
                  className={`size-5 rounded-md border transition-all ${bottom === face ? "border-white/80 scale-110" : "border-white/10 opacity-50 hover:opacity-100"}`}
                  style={{ background: colour }}
                />
              ))}
            </div>
            <div className="flex items-center gap-0.5 shrink-0 rounded-xl bg-white/[0.03] p-0.5" title="Scramble: the case scrambled on your cube. Recognize: the case on the screen — recognise it and solve it from there (the time to your first turn is measured).">
              {([
                [false, "Scramble"],
                [true, "Recognize"],
              ] as const).map(([virtual, label]) => (
                <button
                  key={label}
                  onClick={() => setSettings({ virtual })}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-[10px] transition-all ${settings.virtual === virtual ? "text-white bg-white/[0.1]" : "text-gray-500 hover:text-gray-300"}`}
                  style={settings.virtual === virtual ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {def.levels && (
                <button
                  onClick={toggleLadder}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${
                    ladderEnabled ? "text-emerald-300 bg-emerald-500/10" : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]"
                  }`}
                  title={`Ladder: after each attempt, if at least ${LADDER_THRESHOLD * 100}% of your last ${LADDER_WINDOW} attempts at this optimal length were solved optimally, go one move longer (it never goes down)`}
                >
                  <TrendingUp size={12} /> Ladder
                </button>
              )}
              <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-1">
            <div className="flex items-center gap-1 shrink-0">
              {TRAINERS.filter((t) => t.family === family).map((t) => (
                <button
                  key={t.id}
                  onClick={() => changeType(t.id)}
                  className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1 text-xs font-semibold rounded-xl transition-all ${
                    def.id === t.id ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                  }`}
                  style={chipStyle(def.id === t.id)}
                >
                  <span className="w-5 h-5 rounded-md overflow-hidden shrink-0 bg-gray-950/40">
                    <TrainerIcon def={t} />
                  </span>
                  {t.label}
                </button>
              ))}
            </div>
            {def.id === "f2l" && (
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[9px] text-gray-600 uppercase tracking-wider mr-1">Slots</span>
                {SLOTS.map((s) => (
                  <button key={s} onClick={() => toggleSlot(s)} title="Toggle this slot — selected slots get scrambled together" className={chip(settings.slots.includes(s))} style={chipStyle(settings.slots.includes(s))}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {def.variants && (
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[9px] text-gray-600 uppercase tracking-wider mr-1">{def.variants.label}</span>
                {def.variants.options.map(([v, label]) => (
                  <button key={v} onClick={() => changeVariant(v)} className={`${chip(variant === v)} capitalize`} style={chipStyle(variant === v)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {def.levels && (
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[9px] text-gray-600 uppercase tracking-wider mr-1">Optimal</span>
                {Array.from({ length: def.levels.max - def.levels.min + 1 }, (_, i) => i + def.levels!.min).map((n) => (
                  <button key={n} onClick={() => changeLevel(n)} className={`${chip(level === n)} tabular-nums`} style={chipStyle(level === n)}>
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      }
      moves={targetTokens}
      progress={progress}
      tracking={selectTracking(state)}
      showRefresh
      onRefresh={regenerate}
      loading={isGenerating}
      loadingText={loadingText}
      loadingSpinner={isGenerating}
      sequenceTop={
        info || (summary && state.phase === "setup") ? (
          <div className="mb-1.5 px-1 flex items-center gap-3">
            {summary && state.phase === "setup" && <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Next scramble</p>}
            {info && <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{info}</p>}
          </div>
        ) : undefined
      }
      timeMs={displaySec * 1000}
      timerState={timerState}
      hintText={hintText}
      controls={
        <SolveControls
          mode="solve"
          isActive={state.phase === "active"}
          onDiscard={regenerate}
          onSaveAsDNF={regenerate}
          onResetCube={
            shown?.virtual
              ? () => {
                  view.setState(shown.caseState);
                  state.moveLog.forEach((m) => view.addMove(m.move));
                }
              : undefined
          }
          stopByCube
        />
      }
      centerBottom={
        (state.phase === "ready" || state.phase === "active") && canHint ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <button onClick={() => void requestHint()} disabled={isHintLoading} className="btn-secondary text-xs" title="Reveal the first move of an optimal solution from the current state (marks the attempt as hinted)">
                <Lightbulb size={13} /> {isHintLoading ? "Thinking…" : "Hint"}
              </button>
              <button onClick={() => void requestReveal()} disabled={isRevealLoading} className="btn-secondary text-xs" title="Reveal the optimal solution(s) from the current state (marks the attempt as hinted)">
                <Eye size={13} /> {isRevealLoading ? "Solving…" : "Solution"}
              </button>
              {hint && (
                <span className="text-sm font-mono font-bold text-amber-300">
                  Try: <span className="text-base">{hint}</span>
                </span>
              )}
            </div>
            {revealed && (
              <div className="flex flex-col items-center gap-1 max-h-32 overflow-y-auto">
                {revealed.map((sol) => (
                  <span key={sol} className="text-sm font-mono font-semibold text-amber-200 bg-white/[0.04] rounded-lg px-2.5 py-1">
                    {sol}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : undefined
      }
      cubeRef={cubeRef}
      visualization="3D"
      cubeMask={mask}
      cubeOrientation={frame}
      hintFacelets={backStickers ? "floating" : "none"}
      hintFaceletsElevation={viewPrefs.hintElevation}
      backView={viewPrefs.backView}
      flatCubeRef={flatCubeRef}
      showFlatView={flatView}
      cubeToolbar={<CaseViewToggles {...viewPrefs} />}
      cubeOverlay={
        isGenerating ? (
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <RefreshCw size={20} className="text-gray-500 animate-spin" />
            <span className="text-sm font-medium text-gray-400">{loadingText}</span>
          </div>
        ) : undefined
      }
      cameraLatitude={isRouxView ? -25 : undefined}
      cameraLongitude={isRouxView ? -35 : undefined}
      timesMs={scopeAttempts.map((a) => a.timeMs)}
      statsLabel={
        def.id === "cmll"
          ? `CMLL · ${variant}`
          : def.id === "f2l"
            ? `F2L · ${slotLabel(settings.slots)}${variant === "free" ? " · other slots free" : ""}`
            : def.levels
              ? `${def.label}${variant ? ` ${variant}` : ""} · optimal ${level}`
              : `${def.label} · ${variant}`
      }
      showAo12={false}
      layout="side"
      statsAside={
        summary ? (
          <TrainerSummary
            attempt={summary.attempt}
            analysis={summary.analysis}
            optimalSolutions={summary.optimalSolutions}
            onRetry={summary.attempt.caseState ? () => retryAttempt(summary.attempt) : undefined}
          />
        ) : !def.levels && avgMoves !== null ? (
          <div className="panel p-5 h-full flex flex-col justify-center gap-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Avg moves</p>
              <p className="text-3xl font-mono tabular-nums font-bold text-white mt-1">{avgMoves.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Fewest moves</p>
              <p className="text-3xl font-mono tabular-nums font-bold text-white mt-1">{bestMoves}</p>
            </div>
            {recognitionStat}
            <p className="text-[11px] text-gray-600">
              {scopeAttempts.length} {scopeAttempts.length === 1 ? "attempt" : "attempts"}
            </p>
          </div>
        ) : def.levels && optimalRate !== null ? (
          <div className="panel p-5 h-full flex flex-col justify-center gap-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Optimal rate</p>
              <p className="text-3xl font-mono tabular-nums font-bold text-white mt-1">{optimalRate}%</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Avg overhead</p>
              <p className="text-3xl font-mono tabular-nums font-bold text-white mt-1">+{(avgOverhead ?? 0).toFixed(2)}</p>
            </div>
            {recognitionStat}
            <p className="text-[11px] text-gray-600">
              {scopeAttempts.length} {scopeAttempts.length === 1 ? "attempt" : "attempts"} at optimal {level}
            </p>
          </div>
        ) : undefined
      }
      bottom={
        recentAttempts.length > 0 ? (
          <div className="flex flex-col">
            <div className="px-4 sm:px-6 pt-3 pb-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Recent attempts</span>
            </div>
            <div className="divide-y divide-gray-800/40">
              {recentAttempts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 sm:px-6 py-1.5 hover:bg-white/[0.03] transition-colors">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 w-24 sm:w-40 shrink-0 truncate">
                    {trainerById(a.type)?.label ?? a.type}
                    {a.slots ? ` ${slotLabel(a.slots)}` : a.slot ? ` ${a.slot}` : ""}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-white w-20 shrink-0">{formatTimeMs(a.timeMs)}</span>
                  <span className="text-xs font-mono tabular-nums text-gray-400 w-16 shrink-0">{a.optimalLength ? `${a.moveCount}/${a.optimalLength}` : `${a.moveCount} mv`}</span>
                  {a.optimalLength > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${a.overhead <= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                      {a.overhead <= 0 ? "optimal" : `+${a.overhead}`}
                    </span>
                  )}
                  {a.hintUsed && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 bg-sky-500/15 text-sky-300">hint</span>}
                  {a.caseName && <span className="text-[10px] font-semibold text-gray-300 shrink-0">{a.caseName}</span>}
                  {a.recognitionMs !== undefined && (
                    <span className="text-[10px] font-mono tabular-nums text-gray-500 shrink-0" title="Time to the first turn — recognition">
                      rec {(a.recognitionMs / 1000).toFixed(2)}
                    </span>
                  )}
                  {a.virtual && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 bg-white/[0.05] text-gray-400">case</span>}
                  <span className="text-xs text-gray-600 flex-1 truncate font-mono">{a.scramble}</span>
                  {cubeLabel(a.cube) && <span className="text-[10px] text-gray-500 shrink-0 max-w-32 truncate" title="Cube">{cubeLabel(a.cube)}</span>}
                  <span className="text-[10px] text-gray-700 shrink-0">{new Date(a.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {a.caseState && (
                    <button onClick={() => retryAttempt(a)} className="shrink-0 p-1.5 text-gray-600 hover:text-gray-200 transition-colors" title="Practise this exact case again (a scramble to it from wherever the cube is)">
                      <Repeat2 size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirmDeleteId === a.id) {
                        deleteTrainerAttempt(a.id);
                        setAttempts(getTrainerAttempts());
                        setConfirmDeleteId(null);
                      } else setConfirmDeleteId(a.id);
                    }}
                    className={`shrink-0 p-1.5 transition-colors ${confirmDeleteId === a.id ? "text-red-400" : "text-gray-600 hover:text-red-500"}`}
                    title={confirmDeleteId === a.id ? "Click again to delete" : "Delete attempt"}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : undefined
      }
    />
  );
}

/** A type tab's picture: the step's pieces in colour, seen from below (the cross / blocks are on the bottom). */
function TrainerIcon({ def }: { def: TrainerDef }) {
  const mask = useMemo(() => buildMask(def.mask(def.variants?.default ?? "", ["FR"])), [def]);
  const roux = def.family === "roux";
  return <AlgCaseVisualisation alg="" visualization="3D" cubeMask={mask} cameraLatitude={-25} cameraLongitude={roux ? -35 : 30} className="size-full" />;
}

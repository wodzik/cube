/**
 * CaseTrainerPage — targeted sub-state drills: cross and xcross.
 *
 * Thin controller over the shared session reducer + TrainerPanel, exactly
 * like SolvePage, with two trainer-specific mechanics:
 *
 * 1. Scrambles come from trainerScrambleService with a KNOWN exact optimal
 *    length, generated FROM THE CUBE'S CURRENT STATE — an attempt ends with
 *    the cube unsolved (target done, rest scrambled), so the next scramble
 *    is a path from wherever the cube actually is. The page tracks that
 *    physical state as a KTransformation fed by every hardware move
 *    (independent of the reducer, which drops moves outside tracked
 *    phases). The session must START from a solved cube; the "Resync"
 *    button re-declares solved if tracking ever drifts (missed BT events).
 *
 * 2. The attempt stops via useStageSolvedDetection ("stage-solved" stop
 *    method) the instant the trained target is solved — cross, or
 *    cross+slot for xcross — not when the whole cube is.
 *
 * Cross scrambles/verdicts come from the pure-TS engine (exact distance
 * table → wasted-move analysis + full optimal-solution list). XCross uses
 * the vendored or18 WASM engine (see or18TrainerWorkers.ts) — it builds
 * ~600 MB of tables on first use, gives one example optimal solution, and
 * has no cheap distance query, so xcross verdicts skip the wasted-move
 * breakdown.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Lightbulb, Repeat2, RotateCcw, Trash2, TrendingUp } from "lucide-react";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPuzzle, KTransformation } from "cubing/kpuzzle";
import { SessionProvider, useSession } from "../state/sessionContext";
import { selectCurrentProgress, selectMoveCount, selectSolveTimeMs } from "../state/sessionSelectors";
import { collapseIdenticalMoves } from "../logic/moveReduction";
import { isCrossSolvedOnFace, type Face } from "../logic/stageDetection/lastLayerShared";
import { isSlotSolved, type LiveCubeState } from "../logic/stageDetection/liveCubeState";
import { getCrossEngine, MAX_CROSS_DEPTH, type CrossMoveAnalysis } from "../logic/trainer/crossEngine";
import {
  crossStickeringMask,
  eocrossStickeringMask,
  xcrossStickeringMask,
  xxcrossStickeringMask,
} from "../logic/trainer/trainerMasks";
import {
  XCROSS_SLOT_FRAMES,
  XCROSS_SLOTS,
  XXCROSS_PAIRS,
  XXCROSS_PAIR_FRAMES,
  type XCrossSlot,
  type XXCrossPair,
} from "../logic/trainer/xcrossFrames";
import { pairingGoalSignatures, pairingSignature } from "../logic/trainer/pairingGoals";
import {
  isFbSolved,
  isFbSsSolved,
  isFsSolved,
  isFbdrSolved,
  isCmllSolved,
  isEolrSolved,
  eolrGoalPatterns,
  fbStickeringMask,
  ssStickeringMask,
  fsStickeringMask,
  fbdrStickeringMask,
  cmllStickeringMask,
  eolrStickeringMask,
  ROUX_SS_SIDES,
  type RouxSsSide,
} from "../logic/trainer/rouxTargets";
import {
  generateRouxScramble,
  regenerateRouxForTarget,
  rouxOptimalNextMove,
  rouxOptimalSolutions,
  isRouxEngineReady,
  FB_LEVEL_RANGE,
  SS_LEVEL_RANGE,
  FS_LEVEL_RANGE,
  FBDR_LEVEL_RANGE,
  EOLR_LEVEL_RANGE,
  type RouxTrainerType,
} from "../services/rouxTrainerService";
import { collapseToStm } from "../logic/moveReduction";
import {
  generateCrossScramble,
  generateF2LScramble,
  generateXCrossScramble,
  generateXXCrossScramble,
  generatePairScramble,
  generateEOCrossScramble,
  regenerateForTarget,
  optimalNextMove,
  optimalSolutionsFromCurrent,
  isEngineReady,
  TRAINER_MAX_DEPTHS,
  type EngineKey,
  type TrainerRetryTarget,
  type TrainerScramble,
} from "../services/trainerScrambleService";
import { getTrainerAttempts, saveTrainerAttempt, deleteTrainerAttempt } from "../services/trainerStore";
import { formatTimeMs } from "../logic/statistics";
import { useSmartCube } from "../hooks/useSmartCube";
import { useAnimationTimer } from "../hooks/useAnimationTimer";
import { useStageSolvedDetection } from "../hooks/useStageSolvedDetection";
import { TrainerPanel } from "../components/TrainerPanel";
import { ConnectionPanel } from "../components/ConnectionPanel";
import { SolveControls } from "../components/SolveControls";
import { TrainerSummary } from "../components/TrainerSummary";
import type { CubeVisualisationRef } from "../components/CubeVisualisation";
import type { SessionConfig } from "../types/session";
import type { TrainerAttempt, TrainerType } from "../types/trainer";

const TRAINER_FACE: Face = "U"; // white cross in the standard scramble frame (white top / green front)
const TYPE_STORAGE_KEY = "nact_trainer_type";
const SLOT_STORAGE_KEY = "nact_trainer_xcross_slot";
const PAIR_STORAGE_KEY = "nact_trainer_xxcross_pair";
const LENGTH_STORAGE_KEYS: Record<TrainerType, string> = {
  cross: "nact_trainer_cross_length",
  xcross: "nact_trainer_xcross_length",
  xxcross: "nact_trainer_xxcross_length",
  pair: "nact_trainer_pair_length",
  eocross: "nact_trainer_eocross_length",
  f2l: "nact_trainer_f2l_length", // unused (no optimal level) — kept for record-shape uniformity
  fb: "nact_trainer_fb_length",
  fs: "nact_trainer_fs_length",
  fbdr: "nact_trainer_fbdr_length",
  ss: "nact_trainer_ss_length",
  cmll: "nact_trainer_cmll_length", // unused (case-based, no level dial) — kept for record-shape uniformity
  eolr: "nact_trainer_eolr_length",
};
const MIN_DEPTHS: Record<TrainerType, number> = {
  cross: 1,
  xcross: 1,
  xxcross: 1,
  pair: 1,
  eocross: 1,
  f2l: 1,
  fb: FB_LEVEL_RANGE.min,
  fs: FS_LEVEL_RANGE.min,
  fbdr: FBDR_LEVEL_RANGE.min,
  ss: SS_LEVEL_RANGE.min,
  cmll: 1,
  eolr: EOLR_LEVEL_RANGE.min,
};
const MAX_DEPTHS: Record<TrainerType, number> = {
  cross: MAX_CROSS_DEPTH,
  xcross: TRAINER_MAX_DEPTHS.xcross,
  xxcross: TRAINER_MAX_DEPTHS["xxcross-adj"],
  pair: TRAINER_MAX_DEPTHS.pairing,
  eocross: TRAINER_MAX_DEPTHS.eocross,
  f2l: 1,
  fb: FB_LEVEL_RANGE.max,
  fs: FS_LEVEL_RANGE.max,
  fbdr: FBDR_LEVEL_RANGE.max,
  ss: SS_LEVEL_RANGE.max,
  cmll: 1,
  eolr: EOLR_LEVEL_RANGE.max,
};
const DEFAULT_LENGTHS: Record<TrainerType, number> = {
  cross: 5,
  xcross: 7,
  xxcross: 7,
  pair: 5,
  eocross: 6,
  f2l: 1,
  fb: 6,
  fs: 4,
  fbdr: 5,
  ss: 7,
  cmll: 1,
  eolr: 6,
};
const OPTIMAL_SOLUTIONS_SHOWN = 8;
const ROUX_TYPES: readonly TrainerType[] = ["fb", "fs", "fbdr", "ss", "cmll", "eolr"];

type TrainerFamily = "cfop" | "roux" | "f2l";
const FAMILY_STORAGE_KEY = "nact_trainer_family";
const FAMILIES: { id: TrainerFamily; label: string; types: TrainerType[] }[] = [
  { id: "cfop", label: "CFOP", types: ["cross", "xcross", "xxcross", "pair", "eocross"] },
  { id: "roux", label: "Roux", types: ["fs", "fb", "fbdr", "ss", "cmll", "eolr"] },
  { id: "f2l", label: "F2L", types: ["f2l"] },
];
const familyOf = (type: TrainerType): TrainerFamily =>
  type === "f2l" ? "f2l" : ROUX_TYPES.includes(type) ? "roux" : "cfop";
/** Which Roux types carry a front/back side dimension. */
const SIDED_ROUX_TYPES = ["ss", "fs", "fbdr"] as const;
type SidedRouxType = (typeof SIDED_ROUX_TYPES)[number];
const SIDE_STORAGE_KEYS: Record<SidedRouxType, string> = {
  ss: "nact_trainer_roux_ss_side",
  fs: "nact_trainer_roux_fs_side",
  fbdr: "nact_trainer_roux_fbdr_side",
};
const SIDE_LABELS: Record<SidedRouxType, string> = { ss: "Square", fs: "Square", fbdr: "Solved FS" };
const LADDER_STORAGE_KEY = "nact_trainer_ladder";
/** Ladder mode: bump the level after this many attempts at it with at least this optimal rate. */
const LADDER_WINDOW = 10;
const LADDER_THRESHOLD = 0.8;

const TRAINER_TYPES: { id: TrainerType; label: string }[] = [
  { id: "cross", label: "Cross" },
  { id: "xcross", label: "XCross" },
  { id: "xxcross", label: "XXCross" },
  { id: "pair", label: "Pair" },
  { id: "eocross", label: "EOCross" },
  { id: "f2l", label: "Pair to slot" },
  { id: "fs", label: "FS" },
  { id: "fb", label: "FB" },
  { id: "fbdr", label: "FB+DR" },
  { id: "ss", label: "SS" },
  { id: "cmll", label: "CMLL" },
  { id: "eolr", label: "EOLR" },
];

/** Which or18 WASM engine a type uses (null = pure-TS engines: cross / roux). */
function engineKeyFor(type: TrainerType, pair: XXCrossPair): EngineKey | null {
  switch (type) {
    case "xcross":
      return "xcross";
    case "eocross":
      return "eocross";
    case "pair":
      return "pairing";
    case "xxcross":
      return XXCROSS_PAIR_FRAMES[pair].pairType === "adj" ? "xxcross-adj" : "xxcross-opp";
    default:
      return null;
  }
}

const TRAINER_CONFIG: SessionConfig = {
  mode: "solve",
  startMethod: ["cube-move"],
  stopMethod: ["stage-solved"],
  useInspection: false,
  inspectionSeconds: 15,
};

function loadStoredType(): TrainerType {
  const raw = localStorage.getItem(TYPE_STORAGE_KEY) as TrainerType | null;
  return raw && TRAINER_TYPES.some((t) => t.id === raw) ? raw : "cross";
}

function loadStoredSlot(): XCrossSlot {
  const raw = localStorage.getItem(SLOT_STORAGE_KEY) as XCrossSlot | null;
  return raw && XCROSS_SLOTS.includes(raw) ? raw : "FR";
}

function loadStoredPair(): XXCrossPair {
  const raw = localStorage.getItem(PAIR_STORAGE_KEY) as XXCrossPair | null;
  return raw && XXCROSS_PAIRS.includes(raw) ? raw : "FR+BR";
}

function loadStoredSide(type: SidedRouxType): RouxSsSide {
  const raw = localStorage.getItem(SIDE_STORAGE_KEYS[type]) as RouxSsSide | null;
  return raw && ROUX_SS_SIDES.includes(raw) ? raw : "front";
}

function loadStoredLength(type: TrainerType): number {
  const raw = Number(localStorage.getItem(LENGTH_STORAGE_KEYS[type]));
  return Number.isInteger(raw) && raw >= MIN_DEPTHS[type] && raw <= MAX_DEPTHS[type] ? raw : DEFAULT_LENGTHS[type];
}

interface AttemptSummary {
  attempt: TrainerAttempt;
  analysis: CrossMoveAnalysis[];
  optimalSolutions: string[];
}

export default function CaseTrainerPage() {
  return (
    <SessionProvider config={TRAINER_CONFIG}>
      <CaseTrainerInner />
    </SessionProvider>
  );
}

function CaseTrainerInner() {
  const { state, submitCubeMove, setTarget } = useSession();
  const cubeRef = useRef<CubeVisualisationRef>(null);

  const [kpuzzle, setKpuzzle] = useState<KPuzzle | null>(null);
  const [trainerType, setTrainerType] = useState<TrainerType>(loadStoredType);
  const [slot, setSlot] = useState<XCrossSlot>(loadStoredSlot);
  const [pair, setPair] = useState<XXCrossPair>(loadStoredPair);
  const [sides, setSides] = useState<Record<SidedRouxType, RouxSsSide>>(() => ({
    ss: loadStoredSide("ss"),
    fs: loadStoredSide("fs"),
    fbdr: loadStoredSide("fbdr"),
  }));
  const family = familyOf(trainerType);
  // Last-used type per family, so switching families restores where you were.
  const lastTypeByFamilyRef = useRef<Record<TrainerFamily, TrainerType>>({
    cfop: family === "cfop" ? trainerType : "cross",
    roux: family === "roux" ? trainerType : "fb",
    f2l: "f2l",
  });
  lastTypeByFamilyRef.current[family] = trainerType;
  const [lengths, setLengths] = useState<Record<TrainerType, number>>(() =>
    Object.fromEntries(TRAINER_TYPES.map((t) => [t.id, loadStoredLength(t.id)])) as Record<TrainerType, number>
  );
  const [current, setCurrent] = useState<TrainerScramble | null>(null);
  const [basePattern, setBasePattern] = useState<LiveCubeState | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<TrainerAttempt[]>(() => getTrainerAttempts());
  const [summary, setSummary] = useState<AttemptSummary | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);
  /** Full solutions revealed on demand — stays visible while the user follows along. */
  const [revealed, setRevealed] = useState<string[] | null>(null);
  const [isRevealLoading, setIsRevealLoading] = useState(false);
  const [ladderEnabled, setLadderEnabled] = useState(() => localStorage.getItem(LADDER_STORAGE_KEY) === "true");
  /** Transient notice (e.g. ladder level-up) shown above the sequence bar until the next attempt starts. */
  const [info, setInfo] = useState<string | null>(null);
  /** Latched per attempt the moment a hint is revealed; recorded on the attempt. */
  const hintUsedRef = useRef(false);

  const targetLength = lengths[trainerType];

  // Physical cube state since session start (assumed solved) — EVERY
  // hardware move lands here, including ones the reducer ignores (phase
  // "done" fiddling), because the next scramble is generated from it.
  const physicalRef = useRef<KTransformation | null>(null);
  // Total hardware moves seen — used to detect "cube moved mid-generation".
  const moveCounterRef = useRef(0);
  // Only the latest generation request may apply its result.
  const generationSeqRef = useRef(0);
  // Config refs so startNextAttempt stays identity-stable (the context's
  // setTarget gets a NEW identity on every session dispatch — its useMemo
  // keys on state — so going through refs keeps the "first scramble" effect
  // from re-firing after every single move).
  const configRef = useRef({ trainerType, slot, pair, sides, targetLength });
  configRef.current = { trainerType, slot, pair, sides, targetLength };
  const setTargetRef = useRef(setTarget);
  setTargetRef.current = setTarget;

  useEffect(() => {
    let cancelled = false;
    cube3x3x3.kpuzzle().then((kp) => {
      if (cancelled) return;
      physicalRef.current = kp.identityTransformation();
      setKpuzzle(kp);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startNextAttempt = useCallback(
    async (kp: KPuzzle, retryOf?: TrainerRetryTarget) => {
      const seq = ++generationSeqRef.current;
      setIsGenerating(true);
      setGenError(null);
      try {
        // The scramble is only valid from the exact state it was generated
        // for — if the cube moved while the solver ran, regenerate from the
        // new state instead of handing out a stale path.
        for (let i = 0; i < 3; i++) {
          const { trainerType: type, slot: slotNow, pair: pairNow, sides: sidesNow, targetLength: len } = configRef.current;
          const snapshot = physicalRef.current ?? kp.identityTransformation();
          const movesAtSnapshot = moveCounterRef.current;
          const generated = retryOf
            ? ROUX_TYPES.includes(retryOf.type)
              ? await regenerateRouxForTarget(retryOf, snapshot)
              : await regenerateForTarget(retryOf, snapshot)
            : ROUX_TYPES.includes(type)
              ? await generateRouxScramble(
                  type as RouxTrainerType,
                  len,
                  (SIDED_ROUX_TYPES as readonly string[]).includes(type) ? sidesNow[type as SidedRouxType] : "front",
                  snapshot
                )
              : type === "f2l"
                ? await generateF2LScramble(slotNow, snapshot)
              : type === "cross"
                ? await generateCrossScramble(len, TRAINER_FACE, snapshot)
                : type === "xcross"
                  ? await generateXCrossScramble(len, slotNow, snapshot)
                  : type === "xxcross"
                    ? await generateXXCrossScramble(len, pairNow, snapshot)
                    : type === "pair"
                      ? await generatePairScramble(len, slotNow, snapshot)
                      : await generateEOCrossScramble(len, snapshot);
          if (generationSeqRef.current !== seq) return;
          if (moveCounterRef.current !== movesAtSnapshot) continue;
          setCurrent(generated);
          setBasePattern(kp.defaultPattern().applyTransformation(snapshot));
          cubeRef.current?.setSetupAlgorithm(generated.viewSetupAlg, "");
          setTargetRef.current(generated.scramble);
          setHint(null);
          setRevealed(null);
          hintUsedRef.current = false;
          return;
        }
        setGenError("Cube kept moving during generation — hold it still, then press refresh.");
      } catch (err) {
        if (generationSeqRef.current === seq) {
          setGenError(err instanceof Error ? err.message : "Failed to generate trainer scramble");
        }
      } finally {
        if (generationSeqRef.current === seq) setIsGenerating(false);
      }
    },
    []
  );

  // First scramble once the puzzle definition is ready.
  useEffect(() => {
    if (kpuzzle) void startNextAttempt(kpuzzle);
  }, [kpuzzle, startNextAttempt]);

  const regenerate = () => {
    if (kpuzzle) void startNextAttempt(kpuzzle);
  };

  const changeType = (type: TrainerType) => {
    setTrainerType(type);
    localStorage.setItem(TYPE_STORAGE_KEY, type);
    configRef.current = { ...configRef.current, trainerType: type, targetLength: lengths[type] };
    regenerate(); // abandon the current attempt at the old target
  };

  const changeSlot = (next: XCrossSlot) => {
    setSlot(next);
    localStorage.setItem(SLOT_STORAGE_KEY, next);
    configRef.current = { ...configRef.current, slot: next };
    regenerate();
  };

  const changePair = (next: XXCrossPair) => {
    setPair(next);
    localStorage.setItem(PAIR_STORAGE_KEY, next);
    configRef.current = { ...configRef.current, pair: next };
    regenerate();
  };

  const changeSide = (type: SidedRouxType, next: RouxSsSide) => {
    setSides((prev) => {
      const updated = { ...prev, [type]: next };
      configRef.current = { ...configRef.current, sides: updated };
      return updated;
    });
    localStorage.setItem(SIDE_STORAGE_KEYS[type], next);
    regenerate();
  };

  const changeFamily = (next: TrainerFamily) => {
    if (next === family) return;
    localStorage.setItem(FAMILY_STORAGE_KEY, next);
    changeType(lastTypeByFamilyRef.current[next]);
  };

  const changeLength = (length: number) => {
    setLengths((prev) => ({ ...prev, [trainerType]: length }));
    localStorage.setItem(LENGTH_STORAGE_KEYS[trainerType], String(length));
    configRef.current = { ...configRef.current, targetLength: length };
    regenerate();
  };

  /** Declare the physical cube solved again — recovery for tracking drift (missed BT events). */
  const resync = () => {
    if (!kpuzzle) return;
    physicalRef.current = kpuzzle.identityTransformation();
    cubeRef.current?.reset();
    setSummary(null);
    void startNextAttempt(kpuzzle);
  };

  const handleMove = useCallback(
    (move: string, timestamp: number) => {
      if (physicalRef.current) physicalRef.current = physicalRef.current.applyMove(move);
      moveCounterRef.current++;
      submitCubeMove(move, timestamp);
      cubeRef.current?.addMove(move);
    },
    [submitCubeMove]
  );

  const cube = useSmartCube({ onMove: handleMove });

  const ladderRef = useRef(ladderEnabled);
  ladderRef.current = ladderEnabled;

  const toggleLadder = () => {
    const next = !ladderEnabled;
    setLadderEnabled(next);
    localStorage.setItem(LADDER_STORAGE_KEY, String(next));
  };

  /** Re-drill the exact case of a past attempt (fresh scramble, same target sub-state). */
  const retryAttempt = (a: TrainerRetryTarget) => {
    if (!kpuzzle) return;
    setSummary(null);
    setInfo(a.type === "f2l" ? "Retrying the same F2L case" : `Retrying the same ${a.type} case (optimal ${a.optimalLength})`);
    void startNextAttempt(kpuzzle, a);
  };

  const canRetry = (a: TrainerRetryTarget & { targetGenerator?: string }) =>
    a.type === "cross"
      ? a.startCrossState !== undefined
      : a.type === "fb" || a.type === "ss" || a.type === "f2l"
        ? Boolean(a.targetGenerator)
        : Boolean(a.nativeTargetSolution);

  /** Reveal the first move of an optimal solution from the CURRENT state. */
  const requestHint = async () => {
    if (!current || isHintLoading) return;
    setIsHintLoading(true);
    try {
      const movesSoFar = state.phase === "active" ? state.moveLog.map((m) => m.move) : [];
      const move = ROUX_TYPES.includes(current.type)
        ? await rouxOptimalNextMove(current, movesSoFar)
        : await optimalNextMove(current, movesSoFar);
      if (move) {
        setHint(move);
        hintUsedRef.current = true;
      }
    } catch {
      setHint(null);
    } finally {
      setIsHintLoading(false);
    }
  };

  /** Reveal FULL optimal solution(s) from the current state — the big hint. */
  const requestReveal = async () => {
    if (!current || isRevealLoading) return;
    setIsRevealLoading(true);
    try {
      const movesSoFar = state.phase === "active" ? state.moveLog.map((m) => m.move) : [];
      const solutions = ROUX_TYPES.includes(current.type)
        ? await rouxOptimalSolutions(current, movesSoFar)
        : await optimalSolutionsFromCurrent(current, movesSoFar);
      if (solutions.length > 0) {
        setRevealed(solutions);
        hintUsedRef.current = true;
      }
    } catch {
      setRevealed(null);
    } finally {
      setIsRevealLoading(false);
    }
  };

  // A revealed single-move hint is only valid for the state it was computed
  // from — the next physical move invalidates it. Full revealed solutions
  // stay up (the user is following them).
  const solveMoveCount = state.moveLog.length;
  useEffect(() => {
    setHint(null);
  }, [solveMoveCount]);

  // Stop predicate for the attempt IN PLAY (from `current`, not the UI
  // selection — switching type/slot mid-attempt regenerates, but until the
  // new scramble lands the old attempt must keep its own target).
  const stagePredicate = useMemo(() => {
    if (!current) return null;
    switch (current.type) {
      case "cross":
        return (s: LiveCubeState) => isCrossSolvedOnFace(s, current.face);
      case "eocross":
        return (s: LiveCubeState) =>
          isCrossSolvedOnFace(s, current.face) && s.patternData.EDGES.orientation.every((o) => o === 0);
      case "xcross":
      case "f2l": {
        // Both targets: cross intact + the trained slot's pair inserted.
        const frame = XCROSS_SLOT_FRAMES[(current.slot as XCrossSlot) ?? "FR"];
        return (s: LiveCubeState) =>
          isCrossSolvedOnFace(s, current.face) &&
          isSlotSolved(s.patternData.CORNERS, frame.cornerSlot) &&
          isSlotSolved(s.patternData.EDGES, frame.edgeSlot);
      }
      case "xxcross": {
        const frames = XXCROSS_PAIR_FRAMES[(current.slot as XXCrossPair) ?? "FR+BR"].slots.map(
          (sl) => XCROSS_SLOT_FRAMES[sl]
        );
        return (s: LiveCubeState) =>
          isCrossSolvedOnFace(s, current.face) &&
          frames.every(
            (f) => isSlotSolved(s.patternData.CORNERS, f.cornerSlot) && isSlotSolved(s.patternData.EDGES, f.edgeSlot)
          );
      }
      case "pair": {
        if (!kpuzzle) return null;
        const pairSlot = (current.slot as XCrossSlot) ?? "FR";
        const goals = pairingGoalSignatures(kpuzzle, pairSlot);
        return (s: LiveCubeState) => goals.has(pairingSignature(s, pairSlot));
      }
      case "fb":
        return isFbSolved;
      case "fbdr":
        return isFbdrSolved;
      case "cmll":
        return isCmllSolved;
      case "eolr": {
        if (!kpuzzle) return null;
        const goals = eolrGoalPatterns(kpuzzle);
        return (s: LiveCubeState) => isEolrSolved(s, goals);
      }
      case "fs": {
        const side = (current.slot as RouxSsSide) ?? "front";
        return (s: LiveCubeState) => isFsSolved(s, side);
      }
      case "ss": {
        const side = (current.slot as RouxSsSide) ?? "front";
        return (s: LiveCubeState) => isFbSsSolved(s, side);
      }
    }
  }, [current, kpuzzle]);
  useStageSolvedDetection(stagePredicate, basePattern);

  const stickeringMask = useMemo(() => {
    const type = current?.type ?? trainerType;
    switch (type) {
      case "cross":
        return crossStickeringMask(TRAINER_FACE);
      case "eocross":
        return eocrossStickeringMask(TRAINER_FACE);
      case "xxcross":
        return xxcrossStickeringMask(TRAINER_FACE, (current?.slot as XXCrossPair) ?? pair);
      case "fb":
        return fbStickeringMask();
      case "cmll":
        return cmllStickeringMask();
      case "eolr":
        return eolrStickeringMask();
      case "fs":
        return fsStickeringMask((current?.slot as RouxSsSide) ?? sides.fs);
      case "fbdr":
        return fbdrStickeringMask((current?.slot as RouxSsSide) ?? sides.fbdr);
      case "ss":
        return ssStickeringMask((current?.slot as RouxSsSide) ?? sides.ss);
      default:
        return xcrossStickeringMask(TRAINER_FACE, (current?.slot as XCrossSlot) ?? slot);
    }
  }, [current, trainerType, slot, pair, sides]);

  // Roux blocks live on the L/D faces — tilt the camera so they're visible.
  const isRouxView = ROUX_TYPES.includes(current?.type ?? trainerType);

  const displaySec = useAnimationTimer(state.startTime, state.endTime, state.phase === "active");
  const solveTimeMs = selectSolveTimeMs(state);
  const moveCount = selectMoveCount(state);
  const progress = selectCurrentProgress(state);
  const targetTokens = state.targetNotation.trim().split(/\s+/).filter(Boolean);

  // Persist + build the verdict exactly once per completed attempt, then
  // immediately generate the next scramble (from the post-target state) —
  // the summary stays up until the first move of that next scramble.
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (state.phase !== "done") {
      notifiedRef.current = false;
      return;
    }
    if (notifiedRef.current || !current || !kpuzzle || solveTimeMs === null || state.endTime === null) return;
    notifiedRef.current = true;

    const attemptScramble = current;
    const isF2l = attemptScramble.type === "f2l";
    const solveMoves = state.moveLog.map((m) => m.move);
    const collapsed = collapseIdenticalMoves(solveMoves);
    // Roux verdicts count in STM: the solver's optimum treats M/E/S slices
    // as one move, but hardware reports a physical slice as two face turns.
    const counted = ROUX_TYPES.includes(attemptScramble.type) ? collapseToStm(solveMoves) : collapsed;
    const endedAt = Date.now();
    const moveLog = state.moveLog;
    const timeMs = solveTimeMs;

    const baseAttempt: Omit<TrainerAttempt, "wastedMoveCount"> = {
      id: crypto.randomUUID(),
      endedAt,
      type: attemptScramble.type,
      face: attemptScramble.face,
      slot: attemptScramble.slot,
      targetLength: attemptScramble.optimalLength,
      scramble: attemptScramble.scramble,
      timeMs,
      moves: moveLog,
      moveCount: counted.length,
      optimalLength: attemptScramble.optimalLength,
      // f2l cases have no computed optimum — overhead is meaningless there.
      overhead: isF2l ? 0 : counted.length - attemptScramble.optimalLength,
      hintUsed: hintUsedRef.current || undefined,
      startCrossState: attemptScramble.startCrossState,
      nativeTargetSolution: attemptScramble.nativeTargetSolution,
      nativeTargetAppl: attemptScramble.nativeTargetAppl,
      targetGenerator: attemptScramble.targetGenerator,
      isDNF: false,
    };

    // Persist, then either level up (ladder mode) or roll into the next
    // attempt at the current settings. Returns true when a level-up already
    // kicked off the next generation.
    const finishAndAdvance = (attempt: TrainerAttempt): void => {
      saveTrainerAttempt(attempt);
      setAttempts(getTrainerAttempts());
      const cfg = configRef.current;
      const t = attempt.type;
      const len = attempt.optimalLength;
      if (
        ladderRef.current &&
        t !== "f2l" && // no optimal level to climb
        t === cfg.trainerType &&
        len === cfg.targetLength &&
        len < MAX_DEPTHS[t]
      ) {
        const recent = getTrainerAttempts()
          .filter((x) => x.type === t && x.targetLength === len)
          .slice(-LADDER_WINDOW);
        if (
          recent.length >= LADDER_WINDOW &&
          recent.filter((x) => x.overhead <= 0).length / recent.length >= LADDER_THRESHOLD
        ) {
          setInfo(`Level up! ≥${LADDER_THRESHOLD * 100}% optimal over ${LADDER_WINDOW} attempts — optimal ${len + 1}`);
          setLengths((prev) => ({ ...prev, [t]: len + 1 }));
          localStorage.setItem(LENGTH_STORAGE_KEYS[t], String(len + 1));
          configRef.current = { ...configRef.current, targetLength: len + 1 };
        }
      }
      void startNextAttempt(kpuzzle);
    };

    if (attemptScramble.type === "cross" && attemptScramble.startCrossState !== undefined) {
      const startCrossState = attemptScramble.startCrossState;
      void (async () => {
        const engine = await getCrossEngine(TRAINER_FACE);
        const analysis = engine.analyzeSolve(startCrossState, collapsed);
        const attempt: TrainerAttempt = { ...baseAttempt, wastedMoveCount: analysis.filter((a) => a.wasted).length };
        setSummary({
          attempt,
          analysis,
          optimalSolutions: engine.optimalSolutions(startCrossState, OPTIMAL_SOLUTIONS_SHOWN),
        });
        finishAndAdvance(attempt);
      })();
    } else {
      // WASM types: no cheap distance query — verdict is move count vs
      // optimal, plus the example optimal solution from generation time.
      const attempt: TrainerAttempt = { ...baseAttempt };
      setSummary({
        attempt,
        analysis: [],
        optimalSolutions:
          attemptScramble.exampleSolutions ??
          (attemptScramble.exampleSolution ? [attemptScramble.exampleSolution] : []),
      });
      finishAndAdvance(attempt);
    }
  }, [state.phase, state.endTime, state.moveLog, solveTimeMs, current, kpuzzle, startNextAttempt]);

  // Dismiss the verdict (and any transient notice) the moment the user
  // starts performing the next scramble.
  useEffect(() => {
    if (!summary && !info) return;
    if (state.phase === "setup" && state.moveLog.length > 0) {
      setSummary(null);
      setInfo(null);
    }
  }, [summary, info, state.phase, state.moveLog.length]);

  // CMLL is case-based (its "level" varies per case) and f2l has no level
  // at all — those pool the whole type.
  const lengthAttempts = useMemo(
    () =>
      attempts.filter(
        (a) =>
          a.type === trainerType &&
          (trainerType === "cmll" || trainerType === "f2l" || a.targetLength === targetLength)
      ),
    [attempts, trainerType, targetLength]
  );
  const optimalRate = lengthAttempts.length
    ? Math.round((lengthAttempts.filter((a) => a.overhead <= 0).length / lengthAttempts.length) * 100)
    : null;
  const avgOverhead = lengthAttempts.length
    ? lengthAttempts.reduce((sum, a) => sum + a.overhead, 0) / lengthAttempts.length
    : null;
  // f2l has no optimum — its aside shows move-count stats instead.
  const avgMoves = lengthAttempts.length
    ? lengthAttempts.reduce((sum, a) => sum + a.moveCount, 0) / lengthAttempts.length
    : null;
  const bestMoves = lengthAttempts.length ? Math.min(...lengthAttempts.map((a) => a.moveCount)) : null;

  // Same scope as the stats above: only the case being trained right now
  // (type + level; CMLL pools the whole type).
  const recentAttempts = useMemo(() => [...lengthAttempts].reverse().slice(0, 30), [lengthAttempts]);

  function handleDeleteAttempt(id: string) {
    deleteTrainerAttempt(id);
    setAttempts(getTrainerAttempts());
    setConfirmDeleteId(null);
  }

  const timerState: "idle" | "solving" | "solved" =
    state.phase === "active" ? "solving" : state.phase === "done" ? "solved" : "idle";

  const attemptType = current?.type ?? trainerType;
  const activeHint =
    attemptType === "f2l"
      ? `Insert the ${current?.slot ?? slot} pair (cross stays)!`
      : attemptType === "cross"
      ? "Solve the cross!"
      : attemptType === "eocross"
        ? "Solve the cross with all edges oriented!"
        : attemptType === "pair"
          ? `Form the ${current?.slot ?? slot} pair (cross stays)!`
          : attemptType === "xxcross"
            ? `Solve the cross + ${current?.slot ?? pair} pairs!`
            : attemptType === "fb"
              ? "Build the first block (left 1×2×3)!"
              : attemptType === "fs"
                ? `Build the ${current?.slot ?? sides.fs} first square!`
                : attemptType === "fbdr"
                  ? "Finish the first block + DR edge!"
                  : attemptType === "ss"
                    ? `Solve the ${current?.slot ?? sides.ss} second square (FB stays)!`
                    : attemptType === "cmll"
                      ? "Recognize and solve the CMLL case!"
                      : attemptType === "eolr"
                        ? "Solve EOLR (orient edges, prepare UL/UR)!"
                        : `Solve the cross + ${current?.slot ?? slot} pair!`;
  const hintText =
    state.phase === "setup"
      ? summary
        ? "Next scramble is ready — perform it when you are"
        : "Perform the scramble shown above"
      : state.phase === "ready"
        ? "Make a move to start"
        : state.phase === "active"
          ? activeHint
          : state.phase === "done"
            ? attemptType === "f2l"
              ? `${moveCount} moves`
              : `${moveCount} moves · optimal ${current?.optimalLength ?? "—"}`
            : null;

  const isRouxType = ROUX_TYPES.includes(trainerType);
  const engineKey = isRouxType ? null : engineKeyFor(trainerType, pair);
  const engineNotReady = isRouxType ? !isRouxEngineReady() : engineKey !== null && !isEngineReady(engineKey);
  const loadingText = isGenerating
    ? engineNotReady
      ? `Preparing ${TRAINER_TYPES.find((t) => t.id === trainerType)?.label} engine — first run builds tables…`
      : "Generating scramble…"
    : (genError ?? undefined);

  return (
    <TrainerPanel
      header={
        <div className="flex items-center gap-3 w-full overflow-x-auto">
          <div className="flex items-center gap-0.5 shrink-0 rounded-xl bg-white/[0.03] p-0.5">
            {FAMILIES.map((f) => (
              <button
                key={f.id}
                onClick={() => changeFamily(f.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-[10px] transition-all ${
                  family === f.id ? "text-white bg-white/[0.1]" : "text-gray-500 hover:text-gray-300"
                }`}
                style={family === f.id ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {TRAINER_TYPES.filter((t) => familyOf(t.id) === family).map((t) => (
              <button
                key={t.id}
                onClick={() => changeType(t.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  trainerType === t.id ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                }`}
                style={trainerType === t.id ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
          {(trainerType === "xcross" || trainerType === "pair" || trainerType === "f2l") && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[9px] text-gray-600 uppercase tracking-wider mr-1">Slot</span>
              {XCROSS_SLOTS.map((s) => (
                <button
                  key={s}
                  onClick={() => changeSlot(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    slot === s ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                  }`}
                  style={slot === s ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {trainerType === "xxcross" && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[9px] text-gray-600 uppercase tracking-wider mr-1">Slots</span>
              {XXCROSS_PAIRS.map((p) => (
                <button
                  key={p}
                  onClick={() => changePair(p)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    pair === p ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                  }`}
                  style={pair === p ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          {(SIDED_ROUX_TYPES as readonly string[]).includes(trainerType) && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[9px] text-gray-600 uppercase tracking-wider mr-1">
                {SIDE_LABELS[trainerType as SidedRouxType]}
              </span>
              {ROUX_SS_SIDES.map((s) => (
                <button
                  key={s}
                  onClick={() => changeSide(trainerType as SidedRouxType, s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                    sides[trainerType as SidedRouxType] === s
                      ? "text-white bg-white/[0.08]"
                      : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                  }`}
                  style={
                    sides[trainerType as SidedRouxType] === s
                      ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" }
                      : undefined
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {trainerType !== "cmll" && trainerType !== "f2l" && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[9px] text-gray-600 uppercase tracking-wider mr-1">Optimal</span>
            {Array.from(
              { length: MAX_DEPTHS[trainerType] - MIN_DEPTHS[trainerType] + 1 },
              (_, i) => i + MIN_DEPTHS[trainerType]
            ).map((n) => (
              <button
                key={n}
                onClick={() => changeLength(n)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold tabular-nums transition-all ${
                  targetLength === n ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                }`}
                style={targetLength === n ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined}
              >
                {n}
              </button>
            ))}
          </div>
          )}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {trainerType !== "f2l" && (
            <button
              onClick={toggleLadder}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${
                ladderEnabled ? "text-emerald-300 bg-emerald-500/10" : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]"
              }`}
              title={`Ladder mode: raise the optimal length automatically once ${LADDER_WINDOW} straight attempts are ≥${LADDER_THRESHOLD * 100}% optimal`}
            >
              <TrendingUp size={12} /> Ladder
            </button>
            )}
            <button
              onClick={resync}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-gray-500 hover:text-gray-200 hover:bg-white/[0.04] transition-colors"
              title="My physical cube is solved — restart state tracking from it"
            >
              <RotateCcw size={12} /> Resync
            </button>
            <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
          </div>
        </div>
      }
      moves={targetTokens}
      progress={progress}
      showRefresh
      onRefresh={regenerate}
      loadingText={loadingText}
      sequenceTop={
        info || (summary && state.phase === "setup") ? (
          <div className="mb-1.5 px-1 flex items-center gap-3">
            {summary && state.phase === "setup" && (
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Next scramble</p>
            )}
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
          onResetCube={() => {
            if (!current) return;
            cubeRef.current?.reset();
            cubeRef.current?.setSetupAlgorithm(current.viewSetupAlg, "");
            state.moveLog.forEach((m) => cubeRef.current?.addMove(m.move));
          }}
          stopByCube
        />
      }
      centerBottom={
        (state.phase === "ready" || state.phase === "active") && current && current.type !== "f2l" ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => void requestHint()}
                disabled={isHintLoading}
                className="btn-secondary text-xs"
                title="Reveal the first move of an optimal solution from the current state (marks the attempt as hinted)"
              >
                <Lightbulb size={13} /> {isHintLoading ? "Thinking…" : "Hint"}
              </button>
              <button
                onClick={() => void requestReveal()}
                disabled={isRevealLoading}
                className="btn-secondary text-xs"
                title="Reveal full optimal solution(s) from the current state (marks the attempt as hinted)"
              >
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
      visualization="PG3D"
      stickeringMaskOrbits={stickeringMask}
      cameraLatitude={isRouxView ? -25 : undefined}
      cameraLongitude={isRouxView ? -35 : undefined}
      timesMs={lengthAttempts.map((a) => a.timeMs)}
      statsLabel={
        trainerType === "cmll"
          ? "CMLL"
          : trainerType === "f2l"
            ? `F2L · ${slot} slot`
            : `${TRAINER_TYPES.find((t) => t.id === trainerType)?.label} · optimal ${targetLength}`
      }
      showAo12={false}
      statsAside={
        summary ? (
          <TrainerSummary
            attempt={summary.attempt}
            analysis={summary.analysis}
            optimalSolutions={summary.optimalSolutions}
            onRetry={canRetry(summary.attempt) ? () => retryAttempt(summary.attempt) : undefined}
          />
        ) : trainerType === "f2l" && avgMoves !== null ? (
          <div className="panel p-5 h-full flex flex-col justify-center gap-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Avg moves</p>
              <p className="text-3xl font-mono tabular-nums font-bold text-white mt-1">{avgMoves.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Fewest moves</p>
              <p className="text-3xl font-mono tabular-nums font-bold text-white mt-1">{bestMoves}</p>
            </div>
            <p className="text-[11px] text-gray-600">
              {lengthAttempts.length} {lengthAttempts.length === 1 ? "attempt" : "attempts"}
            </p>
          </div>
        ) : trainerType !== "f2l" && optimalRate !== null ? (
          <div className="panel p-5 h-full flex flex-col justify-center gap-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Optimal rate</p>
              <p className="text-3xl font-mono tabular-nums font-bold text-white mt-1">{optimalRate}%</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Avg overhead</p>
              <p className="text-3xl font-mono tabular-nums font-bold text-white mt-1">
                +{(avgOverhead ?? 0).toFixed(2)}
              </p>
            </div>
            <p className="text-[11px] text-gray-600">
              {lengthAttempts.length} {lengthAttempts.length === 1 ? "attempt" : "attempts"} at optimal {targetLength}
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
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 w-24 shrink-0">
                    {a.type}
                    {a.slot ? ` ${a.slot}` : ""}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-white w-20 shrink-0">{formatTimeMs(a.timeMs)}</span>
                  <span className="text-xs font-mono tabular-nums text-gray-400 w-16 shrink-0">
                    {a.type === "f2l" ? `${a.moveCount} mv` : `${a.moveCount}/${a.optimalLength}`}
                  </span>
                  {a.type !== "f2l" && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                        a.overhead <= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {a.overhead <= 0 ? "optimal" : `+${a.overhead}`}
                    </span>
                  )}
                  {a.hintUsed && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 bg-sky-500/15 text-sky-300">hint</span>
                  )}
                  <span className="text-xs text-gray-600 flex-1 truncate font-mono">{a.scramble}</span>
                  <span className="text-[10px] text-gray-700 shrink-0">
                    {new Date(a.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {canRetry(a) && (
                    <button
                      onClick={() => retryAttempt(a)}
                      className="shrink-0 p-1.5 text-gray-600 hover:text-gray-200 transition-colors"
                      title="Practice this exact case again (fresh scramble, same target state)"
                    >
                      <Repeat2 size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (confirmDeleteId === a.id) handleDeleteAttempt(a.id);
                      else setConfirmDeleteId(a.id);
                    }}
                    className={`shrink-0 p-1.5 transition-colors ${
                      confirmDeleteId === a.id ? "text-red-400" : "text-gray-600 hover:text-red-500"
                    }`}
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

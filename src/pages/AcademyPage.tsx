/**
 * AcademyPage — guided lessons with a FIXED curriculum (currently: 4-Look
 * Last Layer, corners first — see data/academy.ts).
 *
 * Two levels of navigation: a LESSON picker (so future lessons — 4LLL
 * edge-first, cross, F2L — slot in beside this one) and the lesson's STEPS
 * as tabs (the way OLL/PLL groups are tabs in Practice). Each step shows
 * its algorithms as selectable preview cards, and the drill cycles through
 * the SELECTED algorithms of the active step. Same drill machinery as
 * Practice (pending-move buffer, drill-round restart, batched-render-safe
 * attempt guard). Differences: the algorithm set is fixed (no editing, no
 * variants), notation shows trigger grouping — "F (R U R' U') F'" — and
 * attempts are session-scratch only (Academy is for learning, not stats).
 *
 * Cube views are CUSTOM masks per step (academyStepMask) — even the plain
 * steps use an all-regular mask, because a mounted TwistyPlayer can't
 * switch from a mask back to a named stickering (see CubeVisualisation).
 * "corners" blacks out the LL edges the way EOCross masks its ignored
 * pieces; "last-layer" is the classic OLL look.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { GraduationCap } from "lucide-react";
import { SessionProvider, useSession } from "../state/sessionContext";
import { selectCurrentProgress } from "../state/sessionSelectors";
import { buildSequenceTarget, computeSequenceProgress } from "../logic/sequenceTracker";
import { invertSequence } from "../logic/moveParser";
import { formatTimeMs } from "../logic/statistics";
import { useSmartCube } from "../hooks/useSmartCube";
import { useAnimationTimer } from "../hooks/useAnimationTimer";
import { useMaskMoves } from "../hooks/useMaskMoves";
import { usePendingMoveBuffer } from "../hooks/usePendingMoveBuffer";
import { TrainerPanel } from "../components/TrainerPanel";
import { ConnectionPanel } from "../components/ConnectionPanel";
import { AcademyAlgCard } from "../components/AcademyAlgCard";
import type { CubeVisualisationRef } from "../components/CubeVisualisation";
import type { SessionConfig } from "../types/session";
import { ACADEMY_LESSONS, parseDecoratedAlg, type AcademyStep } from "../data/academy";
import { academyStepMask } from "../logic/trainer/trainerMasks";

const ACADEMY_CONFIG: SessionConfig = {
  mode: "algorithm",
  startMethod: ["cube-move"],
  stopMethod: ["cube-solved"],
  useInspection: false,
  inspectionSeconds: 15,
};

const SELECTED_STORAGE_KEY = "nact_academy_selected";

/** Per-step selection, persisted; a step the user never touched defaults to its REQUIRED algs. */
function loadSelected(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(SELECTED_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function selectedInStep(step: AcademyStep, stored: Record<string, string[]>): string[] {
  const ids = new Set(step.algs.map((a) => a.id));
  const fromStore = stored[step.id]?.filter((id) => ids.has(id));
  return fromStore ?? step.algs.filter((a) => a.required).map((a) => a.id);
}

export default function AcademyPage() {
  return (
    <SessionProvider config={ACADEMY_CONFIG}>
      <AcademyInner />
    </SessionProvider>
  );
}

function AcademyInner() {
  const { state, submitCubeMove, setTarget, reset } = useSession();
  const cubeRef = useRef<CubeVisualisationRef>(null);
  const { maskMoves, toggleMaskMoves } = useMaskMoves();
  const moveBuffer = usePendingMoveBuffer(state.phase);

  const [lessonId, setLessonId] = useState(ACADEMY_LESSONS[0].id);
  const lesson = ACADEMY_LESSONS.find((l) => l.id === lessonId) ?? ACADEMY_LESSONS[0];
  const [stepId, setStepId] = useState(lesson.steps[0].id);
  const [stored, setStored] = useState<Record<string, string[]>>(loadSelected);
  const [drillIdx, setDrillIdx] = useState(0);
  const [drillRound, setDrillRound] = useState(0);
  /** Session-scratch attempt times per alg id — never persisted. */
  const [attemptsMs, setAttemptsMs] = useState<Record<string, number[]>>({});

  const step: AcademyStep = lesson.steps.find((s) => s.id === stepId) ?? lesson.steps[0];
  const stepMask = useMemo(() => academyStepMask(step.view), [step.view]);
  const selectedIds = useMemo(() => selectedInStep(step, stored), [step, stored]);
  const selectedAlgs = useMemo(() => step.algs.filter((a) => selectedIds.includes(a.id)), [step, selectedIds]);
  const alg = selectedAlgs[Math.min(drillIdx, Math.max(selectedAlgs.length - 1, 0))];
  const decorated = useMemo(() => (alg ? parseDecoratedAlg(alg.alg) : null), [alg]);

  const setSelection = (algId: string, selected: boolean) => {
    const next = { ...stored, [step.id]: selectedIds.filter((id) => id !== algId).concat(selected ? [algId] : []) };
    // Keep curriculum order within the stored list.
    next[step.id] = step.algs.map((a) => a.id).filter((id) => next[step.id].includes(id));
    setStored(next);
    localStorage.setItem(SELECTED_STORAGE_KEY, JSON.stringify(next));
  };

  const switchStep = (id: string) => {
    moveBuffer.clear();
    setStepId(id);
    setDrillIdx(0);
  };

  const switchLesson = (id: string) => {
    const next = ACADEMY_LESSONS.find((l) => l.id === id);
    if (!next || next.id === lessonId) return;
    moveBuffer.clear();
    setLessonId(next.id);
    setStepId(next.steps[0].id);
    setDrillIdx(0);
  };

  const practiceNow = (algId: string) => {
    moveBuffer.clear();
    if (!selectedIds.includes(algId)) setSelection(algId, true);
    // Index within the (possibly just-extended) selection, in curriculum order.
    const ids = step.algs.map((a) => a.id).filter((id) => selectedIds.includes(id) || id === algId);
    setDrillIdx(Math.max(0, ids.indexOf(algId)));
  };

  // Arm the drilled algorithm (and re-arm after each completed round).
  const algIdKey = alg?.id;
  useEffect(() => {
    if (!decorated || decorated.tokens.length === 0) return;
    reset();
    const plain = decorated.tokens.join(" ");
    setTarget(plain);
    cubeRef.current?.reset();
    cubeRef.current?.setSetupAlgorithm(invertSequence(decorated.tokens).join(" "), "");
    // Replay moves chained straight out of the previous round — stop at
    // completion, tail waits a round (see usePendingMoveBuffer).
    const flushTarget = buildSequenceTarget(plain);
    const delivered: string[] = [];
    moveBuffer.flush((move, timestamp) => {
      submitCubeMove(move, timestamp);
      cubeRef.current?.addMove(move);
      delivered.push(move);
      return !computeSequenceProgress(flushTarget, delivered).isCompleted;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [algIdKey, drillRound]);

  const cube = useSmartCube({
    onMove: (move, timestamp) => {
      if (moveBuffer.capture(move, timestamp)) return;
      submitCubeMove(move, timestamp);
      cubeRef.current?.addMove(move);
    },
  });

  const displaySec = useAnimationTimer(state.startTime, state.endTime, state.phase === "active");

  // Record (session-only) + auto-advance to the next selected alg. Guarded
  // by attempt identity — buffered replays complete within one batched
  // render (see TrainingPage's comment).
  const lastRecordedEndRef = useRef<number | null>(null);
  useEffect(() => {
    if (state.phase !== "done") return;
    if (!alg || state.startTime === null || state.endTime === null) return;
    if (lastRecordedEndRef.current === state.endTime) return;
    lastRecordedEndRef.current = state.endTime;
    const timeMs = state.endTime - state.startTime;
    setAttemptsMs((prev) => ({ ...prev, [alg.id]: [...(prev[alg.id] ?? []), timeMs] }));
    const timer = setTimeout(() => {
      setDrillIdx((i) => (i + 1) % Math.max(selectedAlgs.length, 1));
      setDrillRound((r) => r + 1);
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.startTime, state.endTime]);

  const progress = selectCurrentProgress(state);
  const algTimes = alg ? (attemptsMs[alg.id] ?? []) : [];
  const bestMs = algTimes.length > 0 ? Math.min(...algTimes) : null;

  const timerState: "idle" | "solving" | "solved" =
    state.phase === "active" ? "solving" : state.phase === "done" ? "solved" : "idle";
  const hintText = !alg
    ? "Select algorithms below to practice"
    : state.phase === "setup"
      ? "Make a move on the cube to start"
      : state.phase === "done"
        ? "Nice — next one coming up…"
        : null;

  return (
    <TrainerPanel
      header={
        <div className="flex items-center gap-1 w-full overflow-x-auto">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-widest shrink-0 mr-2">
            <GraduationCap size={14} /> Academy
          </span>
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-white/[0.03] shrink-0">
            {ACADEMY_LESSONS.map((l) => (
              <button
                key={l.id}
                onClick={() => switchLesson(l.id)}
                title={l.description}
                className={`px-3 py-1 text-xs font-semibold rounded-[10px] transition-all ${
                  lessonId === l.id ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300"
                }`}
                style={lessonId === l.id ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined}
              >
                {l.title}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-white/[0.08] mx-1.5 shrink-0" />
          {lesson.steps.map((s) => (
            <button
              key={s.id}
              onClick={() => switchStep(s.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all shrink-0 ${
                stepId === s.id ? "text-white bg-white/[0.08]" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
              }`}
              style={stepId === s.id ? { boxShadow: "inset 0 0 0 1px var(--accent-glow)" } : undefined}
            >
              {s.title}
            </button>
          ))}
          <div className="ml-auto shrink-0">
            <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
          </div>
        </div>
      }
      moves={decorated?.tokens ?? []}
      progress={progress}
      sequenceDecorations={decorated?.decorations}
      showMaskToggle
      maskMoves={maskMoves}
      onToggleMask={toggleMaskMoves}
      loadingText={!alg ? "No algorithm selected" : undefined}
      completeText="Algorithm complete!"
      centerTop={
        alg ? (
          <div className="flex flex-col items-center gap-1 text-center">
            <h2 className="text-lg font-bold text-white">{alg.name}</h2>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                alg.required ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300"
              }`}
            >
              {alg.required ? "required" : "nice to know"}
            </span>
            {alg.description && <p className="text-xs text-gray-500 max-w-md">{alg.description}</p>}
            <p className="text-[11px] text-gray-700 tabular-nums font-mono">
              {Math.min(drillIdx, Math.max(selectedAlgs.length - 1, 0)) + 1} / {selectedAlgs.length}
            </p>
          </div>
        ) : null
      }
      timeMs={displaySec * 1000}
      timerState={timerState}
      hintText={hintText}
      cubeRef={cubeRef}
      visualization="PG3D"
      stickeringMaskOrbits={stepMask}
      cameraLatitude={35}
      cameraLongitude={30}
      cubeSetupAlg=""
      timesMs={algTimes}
      statsLabel={alg ? `This session — ${alg.name}` : "This session"}
      showAo12={false}
      statsAside={
        algTimes.length > 0 ? (
          <div className="panel p-5 h-full flex flex-col gap-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              Attempts{bestMs !== null && (
                <>
                  {" "}· best <span className="text-emerald-400">{formatTimeMs(bestMs)}</span>
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {algTimes.map((ms, i) => (
                <span
                  key={i}
                  className={`px-2 py-0.5 rounded-md text-xs font-mono tabular-nums ${
                    ms === bestMs ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.05] text-gray-300"
                  }`}
                >
                  {formatTimeMs(ms)}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-gray-600 mt-auto">Academy attempts are practice-only — not saved to stats.</p>
          </div>
        ) : undefined
      }
      bottom={
        <div className="flex flex-col px-4 sm:px-6 py-4">
          <h3 className="text-sm font-bold text-white">{step.title}</h3>
          <p className="text-xs text-gray-500 mt-1 mb-4 max-w-3xl">{step.description}</p>
          {step.algs.length === 0 ? (
            <p className="text-xs text-gray-600 italic">Coming soon.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
              {step.algs.map((a) => (
                <AcademyAlgCard
                  key={a.id}
                  alg={a}
                  stickeringMaskOrbits={stepMask}
                  selected={selectedIds.includes(a.id)}
                  onSelectedChange={(sel) => setSelection(a.id, sel)}
                  onPractice={() => practiceNow(a.id)}
                />
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}

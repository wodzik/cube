/**
 * VariantTest — "test drive" popup for a single algorithm variant, opened
 * from CaseEdit's variant list: cube preview pre-set to the case state +
 * the algorithm as a tracked move bar, so the variant can be tried on the
 * physical cube a few times BEFORE committing to it as the default.
 *
 * Self-contained: its own SessionProvider (mode "algorithm", nested inside
 * the host page's provider — context shadowing keeps them independent) and
 * its own useSmartCube listener against the app-global cube connection.
 * NOTE FOR HOST PAGES: every useSmartCube listener receives every move, so
 * a page rendering CaseEdit must suppress its own onMove while the edit
 * modal is open — otherwise test moves would also drive the drill running
 * underneath (see TrainingPage/AttackPage).
 *
 * Attempts here are deliberately NOT recorded to the variant's stats —
 * it's a scratch space for deciding, not practice.
 */

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { SessionProvider, useSession } from "../state/sessionContext";
import { selectCurrentProgress } from "../state/sessionSelectors";
import { buildSequenceTarget, computeSequenceProgress } from "../logic/sequenceTracker";
import { invertSequence } from "../logic/moveParser";
import { resolveStickeringProps } from "../services/algGroupRegistry";
import { formatTimeMs } from "../logic/statistics";
import { useSmartCube } from "../hooks/useSmartCube";
import { useAnimationTimer } from "../hooks/useAnimationTimer";
import { usePendingMoveBuffer } from "../hooks/usePendingMoveBuffer";
import { MoveSequenceDisplay } from "./MoveSequenceDisplay";
import { CubeVisualisation, type CubeVisualisationRef } from "./CubeVisualisation";
import { ConnectionPanel } from "./ConnectionPanel";
import { TimerDisplay } from "./TimerDisplay";
import type { SessionConfig } from "../types/session";
import type { DisplayConfig } from "../types/algorithm";

const TEST_CONFIG: SessionConfig = {
  mode: "algorithm",
  startMethod: ["cube-move"],
  stopMethod: ["cube-solved"],
  useInspection: false,
  inspectionSeconds: 15,
};

interface VariantTestProps {
  caseName: string;
  variantName: string;
  alg: string;
  displayConfig: DisplayConfig;
  onClose: () => void;
}

export function VariantTest(props: VariantTestProps) {
  return (
    <SessionProvider config={TEST_CONFIG}>
      <VariantTestInner {...props} />
    </SessionProvider>
  );
}

function VariantTestInner({ caseName, variantName, alg, displayConfig, onClose }: VariantTestProps) {
  const { state, submitCubeMove, setTarget, reset } = useSession();
  const cubeRef = useRef<CubeVisualisationRef>(null);
  const [attemptsMs, setAttemptsMs] = useState<number[]>([]);
  const moveBuffer = usePendingMoveBuffer(state.phase);

  const loadTarget = () => {
    reset();
    setTarget(alg);
    cubeRef.current?.reset();
    const tokens = alg.trim().split(/\s+/).filter(Boolean);
    if (tokens.length > 0) cubeRef.current?.setSetupAlgorithm(invertSequence(tokens).join(" "), "");
    // Replay moves made while the previous attempt was wrapping up — lets
    // the variant be executed several times back-to-back without waiting
    // for the reset delay. Stop at completion; any tail waits for the next
    // reload.
    const flushTarget = buildSequenceTarget(alg);
    const delivered: string[] = [];
    moveBuffer.flush((move, timestamp) => {
      submitCubeMove(move, timestamp);
      cubeRef.current?.addMove(move);
      delivered.push(move);
      return !computeSequenceProgress(flushTarget, delivered).isCompleted;
    });
  };

  // Depend on `alg` only — reset/setTarget get a NEW identity from
  // useSession's context memo after every dispatch, so listing them (or a
  // useCallback built on them) as deps re-runs this effect after each of
  // its own dispatches: an infinite loop. Same pattern as TrainingPage's
  // case-loading effect.
  useEffect(() => {
    loadTarget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alg]);

  const cube = useSmartCube({
    onMove: (move, timestamp) => {
      if (moveBuffer.capture(move, timestamp)) return;
      submitCubeMove(move, timestamp);
      cubeRef.current?.addMove(move);
    },
  });

  const displaySec = useAnimationTimer(state.startTime, state.endTime, state.phase === "active");

  // Record the attempt locally (never persisted) and reload for another go.
  // Guarded by attempt identity (endTime) — see TrainingPage's comment: a
  // buffered replay can complete an attempt within one batched render.
  const lastRecordedEndRef = useRef<number | null>(null);
  useEffect(() => {
    if (state.phase !== "done") return;
    if (state.startTime === null || state.endTime === null) return;
    if (lastRecordedEndRef.current === state.endTime) return;
    lastRecordedEndRef.current = state.endTime;
    setAttemptsMs((a) => [...a, state.endTime! - state.startTime!]);
    const timer = setTimeout(loadTarget, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.startTime, state.endTime]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const progress = selectCurrentProgress(state);
  const tokens = alg.trim().split(/\s+/).filter(Boolean);
  const bestMs = attemptsMs.length > 0 ? Math.min(...attemptsMs) : null;

  const timerState: "idle" | "solving" | "solved" =
    state.phase === "active" ? "solving" : state.phase === "done" ? "solved" : "idle";
  const hintText = !cube.connected
    ? "Connect your cube to try this variant"
    : state.phase === "setup"
      ? "Make a move on the cube to start"
      : state.phase === "done"
        ? "Nice — resetting for another go…"
        : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-white font-semibold text-base">Test variant — {variantName}</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {caseName} · attempts here are not saved to its stats
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionPanel cube={cube} onConnectCube={cube.connect} onDisconnectCube={cube.disconnect} />
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-200 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 border-b border-white/[0.06]">
          <MoveSequenceDisplay moves={tokens} progress={progress} completeText="Variant complete!" />
        </div>

        <div className="flex flex-col sm:flex-row flex-1 overflow-y-auto">
          <div className="sm:w-80 shrink-0 p-5 flex items-center justify-center sm:border-r border-white/[0.06]">
            <div className="w-64 h-64 rounded-xl overflow-hidden bg-gray-950/50">
              <CubeVisualisation
                ref={cubeRef}
                visualization="3D"
                cameraLatitude={displayConfig.cameraLatitude}
                cameraLongitude={displayConfig.cameraLongitude}
                {...resolveStickeringProps(displayConfig.stickering)}
                setupAlg=""
                className="size-full"
              />
            </div>
          </div>

          <div className="flex-1 p-5 flex flex-col items-center justify-center gap-3">
            <TimerDisplay timeMs={displaySec * 1000} state={timerState} className="text-5xl font-extrabold" />
            {hintText && <p className="text-gray-500 text-sm tracking-wide animate-pulse text-center">{hintText}</p>}

            {attemptsMs.length > 0 && (
              <div className="w-full mt-2">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5 text-center">
                  Attempts {bestMs !== null && <>· best <span className="text-emerald-400">{formatTimeMs(bestMs)}</span></>}
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {attemptsMs.map((ms, i) => (
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

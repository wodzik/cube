/**
 * Small, non-interactive cube player that auto-plays a single demo alg on
 * a loop — used by the Academy guides for single moves and triggers shown
 * side by side (see data/guides). No controls, no drag — purely
 * decorative, same "read-only preview" posture as AlgCaseVisualisation's
 * case cards.
 *
 * "Loop" is a long repeat of `alg`, restarted from the top on a timer —
 * TwistyPlayer has no loop/replay event to hook (see git history for the
 * investigation), so re-triggering playback periodically stands in for a
 * true infinite loop without reaching into cubing.js internals. The
 * restart is invisible for single moves: every rep looks identical, so
 * snapping back mid-cycle reads as continuous motion, not a jump. A demo
 * with a finite `repeat` (triggers, which return to solved) instead plays
 * the whole run before restarting, so the full cycle is seen.
 *
 * The player is only mounted while the demo is on screen (useInView) — a
 * guide page shows dozens of these at once.
 */
import { useEffect, useMemo, useRef } from "react";
import { CubeVisualisation, type CubeVisualisationRef } from "./CubeVisualisation";
import { useInView } from "../hooks/useInView";
import type { StickeringMaskOrbits } from "../types/cube";

interface LoopingCubeDemoProps {
  alg: string;
  setupAlg?: string;
  repeat?: number;
  label?: string;
  mask?: StickeringMaskOrbits;
  cameraLatitude?: number;
  className?: string;
}

/** Restart period for the open-ended loops (single moves, repeat 60): comfortably shorter than the full repeat, and a multiple of 4 quarter turns so the snap back looks continuous. */
const RESTART_INTERVAL_MS = 8000;
/** A demo with a finite `repeat` (a trigger that returns to solved after 6) restarts only once the whole run has played, plus this pause. */
const FULL_RUN_PAUSE_MS = 1500;
/** TwistyPlayer plays a quarter turn in 1s and a half turn in 1.5s at tempoScale 1 (see cubing.js AlgDuration). */
const MS_PER_MOVE = 1000;
const MS_PER_HALF_TURN = 1500;
const OPEN_ENDED_REPEAT = 60;

function playbackMs(alg: string, repeat: number): number {
  const once = alg.split(/\s+/).filter(Boolean).reduce((ms, move) => ms + (move.endsWith("2") ? MS_PER_HALF_TURN : MS_PER_MOVE), 0);
  return once * repeat;
}

function Player({ alg, setupAlg, repeat, mask, cameraLatitude }: Omit<LoopingCubeDemoProps, "label" | "className">) {
  const cubeRef = useRef<CubeVisualisationRef>(null);
  const repeats = Math.max(repeat ?? OPEN_ENDED_REPEAT, 1);
  const repeatedAlg = useMemo(() => Array(repeats).fill(alg).join(" "), [alg, repeats]);
  const restartMs = repeats < OPEN_ENDED_REPEAT ? Math.max(RESTART_INTERVAL_MS, playbackMs(alg, repeats) + FULL_RUN_PAUSE_MS) : RESTART_INTERVAL_MS;

  useEffect(() => {
    const restart = () => {
      cubeRef.current?.setSetupAlgorithm(setupAlg ?? "", repeatedAlg, "start");
      cubeRef.current?.play();
    };
    restart();
    const intervalId = setInterval(restart, restartMs);
    return () => clearInterval(intervalId);
  }, [repeatedAlg, setupAlg, restartMs]);

  return (
    <CubeVisualisation
      ref={cubeRef}
      visualization="3D"
      background="none"
      controlPanel="none"
      dragInput="none"
      tempoScale={1}
      stickeringMaskOrbits={mask}
      cameraLatitude={cameraLatitude ?? 20}
      cameraLongitude={20}
      className="size-full"
    />
  );
}

export function LoopingCubeDemo({ alg, setupAlg, repeat = 60, label, mask, cameraLatitude, className = "" }: LoopingCubeDemoProps) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="w-full aspect-square rounded-xl border border-white/[0.08] p-2">
        {inView && <Player alg={alg} setupAlg={setupAlg} repeat={repeat} mask={mask} cameraLatitude={cameraLatitude} />}
      </div>
      {label && <span className="text-sm font-mono font-bold text-gray-300 text-center">{label}</span>}
    </div>
  );
}

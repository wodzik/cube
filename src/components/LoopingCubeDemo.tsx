/**
 * Small, non-interactive cube player that auto-plays a single demo alg on
 * a loop — used for onboarding slides that show several moves side by
 * side (see data/onboarding.ts's OnboardingSlide.demos). No controls, no
 * drag — purely decorative, same "read-only preview" posture as
 * AlgCaseVisualisation's case cards.
 *
 * "Loop" is a long repeat of `alg`, restarted from the top on a timer —
 * TwistyPlayer has no loop/replay event to hook (see git history for the
 * investigation), so re-triggering playback periodically stands in for a
 * true infinite loop without reaching into cubing.js internals. The
 * restart is invisible for these demos: every rep of a single move looks
 * identical, so snapping back to the start mid-cycle reads as continuous
 * motion, not a jump.
 */
import { useEffect, useMemo, useRef } from "react";
import { CubeVisualisation, type CubeVisualisationRef } from "./CubeVisualisation";

interface LoopingCubeDemoProps {
  alg: string;
  setupAlg?: string;
  repeat?: number;
  label?: string;
  className?: string;
}

/** Comfortably shorter than any repeat*move-count could plausibly take to play out, so a restart always lands well before playback would otherwise idle out. */
const RESTART_INTERVAL_MS = 8000;

export function LoopingCubeDemo({ alg, setupAlg, repeat = 60, label, className = "" }: LoopingCubeDemoProps) {
  const cubeRef = useRef<CubeVisualisationRef>(null);
  const repeatedAlg = useMemo(() => Array(Math.max(repeat, 1)).fill(alg).join(" "), [alg, repeat]);

  useEffect(() => {
    const restart = () => {
      cubeRef.current?.setSetupAlgorithm(setupAlg ?? "", repeatedAlg, "start");
      cubeRef.current?.play();
    };
    restart();
    const intervalId = setInterval(restart, RESTART_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [repeatedAlg, setupAlg]);

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="w-full aspect-square rounded-xl border border-white/[0.08] p-2">
        <CubeVisualisation
          ref={cubeRef}
          visualization="3D"
          background="none"
          controlPanel="none"
          dragInput="none"
          tempoScale={1}
          cameraLatitude={20}
          cameraLongitude={20}
          className="size-full"
        />
      </div>
      {label && <span className="text-sm font-mono font-bold text-gray-300">{label}</span>}
    </div>
  );
}

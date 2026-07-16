/**
 * TrainerPanel — shared session UI for all trainer modes (Solve, Algorithm
 * training, Attack). Composes TrainLayout with the concrete trainer
 * components so every page gets identical structure without duplicating
 * layout code.
 *
 * This is the "one shared shell" from plan.md §9 — pages differ only in
 * what they pass into these slots (header content, bottom content, cube
 * setup, target moves), never in layout or in which components render.
 *
 *   sequence slot → MoveSequenceDisplay
 *   center  slot  → centerTop + TimerDisplay/InspectionCountdown + hintText + controls + centerBottom
 *   cube    slot  → CubeVisualisation
 *   stats   slot  → StatsChart
 */

import type { ReactNode, RefObject } from "react";
import { TrainLayout } from "./TrainLayout";
import { MoveSequenceDisplay } from "./MoveSequenceDisplay";
import { CubeVisualisation, type CubeVisualisationRef, type VisualizationMode } from "./CubeVisualisation";
import type { StickeringMaskOrbits } from "../types/cube";
import { TimerDisplay } from "./TimerDisplay";
import { InspectionCountdown } from "./InspectionCountdown";
import { StatsChart } from "./StatsChart";
import type { SequenceProgress } from "../logic/sequenceTracker";

export interface TrainerPanelProps {
  // ── Layout ──
  header: ReactNode;
  bottom?: ReactNode;

  // ── Sequence bar ──
  sequenceContent?: ReactNode;
  moves: string[];
  progress: SequenceProgress | null;
  onRefresh?: () => void;
  showRefresh?: boolean;
  maxErrors?: number;
  totalErrorCount?: number;
  onReset?: () => void;
  loadingText?: string;
  completeText?: string;
  /** Show the eye icon that toggles maskMoves. */
  showMaskToggle?: boolean;
  /** Replace move letters with dots (progress coloring stays) — the "hide algorithm" toggle. */
  maskMoves?: boolean;
  onToggleMask?: () => void;
  showErrorCount?: boolean;
  errorLabel?: string;
  sequenceTrailing?: ReactNode;
  /** Rendered above the sequence bar — e.g. a "Next scramble" label while the previous solve's summary is still up (see SolvePage.tsx). */
  sequenceTop?: ReactNode;
  /** Per-token prefix/suffix decorations (trigger parentheses) — see MoveSequenceDisplay. */
  sequenceDecorations?: Partial<Record<number, { prefix?: string; suffix?: string }>>;

  // ── Center column ──
  centerTop?: ReactNode;
  isInspecting?: boolean;
  inspectionSecondsLeft?: number;
  inspectionMode?: "wca" | "custom" | "unlimited";
  timeMs: number;
  timerState: "idle" | "holding" | "armed" | "inspecting" | "solving" | "solved" | "dnf";
  timerClassName?: string;
  hintText?: string | null;
  controls?: ReactNode;
  centerBottom?: ReactNode;

  // ── Cube ──
  cubeRef: RefObject<CubeVisualisationRef | null>;
  visualization?: VisualizationMode;
  stickering?: string;
  stickeringMaskOrbits?: StickeringMaskOrbits;
  background?: "none" | "checkered-transparent";
  controlPanel?: "none" | "bottom-row";
  dragInput?: "auto" | "none";
  /** Show translucent copies of the hidden faces' stickers (F2L back-sticker aid). */
  hintFacelets?: "none" | "floating";
  cameraLatitude?: number;
  cameraLongitude?: number;
  cubeSetupAlg?: string;
  cubeSetupAnchor?: "start" | "end";
  cubeAlg?: string;

  // ── Stats chart ──
  timesMs: number[];
  statsLabel?: string;
  statsHeight?: number;
  showAo12?: boolean;
  /** Rendered BESIDE the chart (own sub-column, chart to its right; stacks above it on narrow screens) — e.g. the just-finished solve's inline summary (see SolvePage.tsx). */
  statsAside?: ReactNode;
}

export function TrainerPanel({
  header,
  bottom,
  sequenceContent,
  moves,
  progress,
  onRefresh,
  showRefresh,
  maxErrors,
  totalErrorCount,
  onReset,
  loadingText,
  completeText,
  showMaskToggle,
  maskMoves,
  onToggleMask,
  showErrorCount,
  errorLabel,
  sequenceTrailing,
  sequenceTop,
  sequenceDecorations,
  centerTop,
  isInspecting = false,
  inspectionSecondsLeft = 0,
  inspectionMode = "wca",
  timeMs,
  timerState,
  timerClassName = "text-6xl xl:text-7xl font-extrabold",
  hintText,
  controls,
  centerBottom,
  cubeRef,
  visualization = "PG3D",
  stickering,
  stickeringMaskOrbits,
  background = "none",
  controlPanel = "none",
  dragInput = "auto",
  hintFacelets,
  cameraLatitude,
  cameraLongitude,
  cubeSetupAlg,
  cubeSetupAnchor,
  cubeAlg,
  timesMs,
  statsLabel = "Statistics",
  statsHeight = 180,
  showAo12,
  statsAside,
}: TrainerPanelProps) {
  return (
    <TrainLayout
      header={header}
      sequence={
        <>
          {sequenceTop}
          {sequenceContent ?? (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <MoveSequenceDisplay
                  moves={moves}
                  progress={progress}
                  decorations={sequenceDecorations}
                  onRefresh={onRefresh}
                  showRefresh={showRefresh}
                  maxErrors={maxErrors}
                  totalErrorCount={totalErrorCount}
                  onReset={onReset}
                  loadingText={loadingText}
                  completeText={completeText}
                  showMaskToggle={showMaskToggle}
                  maskMoves={maskMoves}
                  onToggleMask={onToggleMask}
                  showErrorCount={showErrorCount}
                  errorLabel={errorLabel}
                />
              </div>
              {sequenceTrailing}
            </div>
          )}
        </>
      }
      center={
        <>
          {centerTop}

          {isInspecting ? (
            <InspectionCountdown secondsLeft={inspectionSecondsLeft} mode={inspectionMode} />
          ) : (
            <TimerDisplay timeMs={timeMs} state={timerState} className={timerClassName} />
          )}

          {hintText && <p className="text-gray-500 text-sm tracking-wide animate-pulse">{hintText}</p>}

          {controls}

          {centerBottom}
        </>
      }
      cube={
        <div className="w-full max-w-90 lg:max-w-none aspect-square">
          <CubeVisualisation
            ref={cubeRef}
            visualization={visualization}
            stickering={stickering}
            stickeringMaskOrbits={stickeringMaskOrbits}
            background={background}
            controlPanel={controlPanel}
            dragInput={dragInput}
            hintFacelets={hintFacelets}
            cameraLatitude={cameraLatitude}
            cameraLongitude={cameraLongitude}
            setupAlg={cubeSetupAlg}
            setupAnchor={cubeSetupAnchor}
            alg={cubeAlg}
            className="size-full"
          />
        </div>
      }
      stats={
        <div className="px-5 sm:px-6 py-6 flex flex-col xl:flex-row gap-5 h-full">
          {statsAside && <div className="xl:w-80 shrink-0">{statsAside}</div>}
          <div className="flex-1 min-w-0 flex flex-col">
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-4">
              {statsLabel}
            </h3>
            <div className="panel p-4 flex-1 flex flex-col justify-center">
              <StatsChart timesMs={timesMs} height={statsHeight} showAo12={showAo12} />
            </div>
          </div>
        </div>
      }
      bottom={bottom}
    />
  );
}

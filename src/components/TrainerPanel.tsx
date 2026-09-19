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
 *   sequence slot → MoveSequenceDisplay + the just-finished-solve `summary` under it
 *   center  slot  → centerTop + [TimerDisplay/InspectionCountdown | controls + centerBottom] row + hintText
 *   cube    slot  → CubeVisualisation (+ flat view beside it) + cubeToolbar
 *   stats   slot  → StatsChart
 */

import type { ReactNode, RefObject } from "react";
import { TrainLayout, type TrainLayoutMode } from "./TrainLayout";
import { MoveSequenceDisplay } from "./MoveSequenceDisplay";
import { CubeVisualisation, type CubeVisualisationRef, type VisualizationMode } from "./CubeVisualisation";
import type { StickeringMaskOrbits } from "../types/cube";
import { TimerDisplay } from "./TimerDisplay";
import { InspectionCountdown } from "./InspectionCountdown";
import { StatsChart } from "./StatsChart";
import type { SequenceProgress } from "../logic/sequenceTracker";
import { useT } from "../i18n/useT";

// Singles are whole moves; averages (Ao5 etc.) and axis ticks aren't.
const formatMoveCount = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(2));

/** Wraps children in a real button only when there's something to do on click — otherwise a plain container, so idle timers aren't announced as buttons. */
function Tap({ onClick, className = "", children }: { onClick?: () => void; className?: string; children: ReactNode }) {
  const { t } = useT();
  if (!onClick) return <div className={className}>{children}</div>;
  return (
    // No opacity/filter hover effect on purpose: either would create a
    // stacking context, which pushed the timing bar's hover popup (inside
    // this button) behind the cube rendered next in the DOM. No native
    // `title` either — its tooltip sat on top of that same popup.
    <button
      type="button"
      onClick={onClick}
      aria-label={t("trainerPanel.openAnalysis")}
      className={`text-left rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${className}`}
    >
      {children}
    </button>
  );
}

export interface TrainerPanelProps {
  // ── Layout ──
  header: ReactNode;
  bottom?: ReactNode;
  /** A page's own persistent sidebar, in its own column left of everything else — e.g. a recent-times list (see TrainLayout). */
  leftAside?: ReactNode;
  /** "side" (default): scramble above, timer beside the cube, chart + bottom list across the full width. "stack": timer above the cube, chart as a right column (unused) — see TrainLayout. */
  layout?: TrainLayoutMode;

  // ── Sequence bar ──
  sequenceContent?: ReactNode;
  moves: string[];
  progress: SequenceProgress | null;
  onRefresh?: () => void;
  showRefresh?: boolean;
  maxErrors?: number;
  totalErrorCount?: number;
  onReset?: () => void;
  /** Force the scramble/algorithm loading overlay even while `moves` still shows the previous (stale) sequence — see MoveSequenceDisplay. */
  loading?: boolean;
  loadingText?: string;
  /** See MoveSequenceDisplay — false for a static loadingText that isn't actually waiting on anything. */
  loadingSpinner?: boolean;
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
  /** Show move count instead of time on the big timer, and chart `moveCounts` instead of `timesMs` — see StoredSession.moveCountOnly. */
  moveCountOnly?: boolean;
  moveCount?: number;
  hintText?: string | null;
  controls?: ReactNode;
  centerBottom?: ReactNode;
  /** Rendered directly UNDER the scramble bar, above the timer and cube — e.g. SolvePage's just-finished solve summary (TPS · turns · stage bar). */
  summary?: ReactNode;
  /** Makes the timer and `summary` clickable (e.g. to open the full solve analysis while the last result is being held). */
  onCenterClick?: () => void;

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
  /** Distance of the floating hint stickers from the cube — see CubeVisualisation. */
  hintFaceletsElevation?: number;
  /**
   * Ref for an auxiliary FLAT (unfolded-net "2D") view under the main cube.
   * When provided the flat player is ALWAYS mounted — so it stays in sync
   * with every imperative call the page fans out to it — and merely hidden
   * via CSS while `showFlatView` is false.
   */
  flatCubeRef?: RefObject<CubeVisualisationRef | null>;
  showFlatView?: boolean;
  /** Rendered under the cube (below the flat view) — e.g. the back-stickers / flat-view toggles. */
  cubeToolbar?: ReactNode;
  /**
   * Rendered as a full-cover overlay directly on top of the cube (dimming
   * it) — e.g. a "Preparing engine…" state while a trainer regenerates for
   * a newly-picked type. Without this the cube keeps showing the PREVIOUS
   * type's scramble/mask (stale, sometimes actively misleading) until the
   * new one is ready, since the cube itself has no other loading affordance.
   */
  cubeOverlay?: ReactNode;
  cameraLatitude?: number;
  cameraLongitude?: number;
  cubeSetupAlg?: string;
  cubeSetupAnchor?: "start" | "end";
  cubeAlg?: string;

  // ── Stats chart ──
  timesMs: number[];
  /** Per-solve move counts, same order as `timesMs` — charted instead of times when `moveCountOnly` is set. */
  moveCounts?: number[];
  statsLabel?: string;
  /** Defaults to "fill" (matches the timer+cube column's height) in "stack" layout, or 280px in "side" layout (every page), where the chart is a fixed-height block above the case list. */
  statsHeight?: number | "fill";
  showAo12?: boolean;
  /** Rendered ABOVE the chart, inside the same (now fixed-width, page-height) stats column — e.g. a page's own attempt-summary card. Not used by SolvePage, which shows its just-finished solve via `centerReplacement` instead (see SolvePage.tsx). */
  statsAside?: ReactNode;
}

export function TrainerPanel({
  header,
  bottom,
  leftAside,
  layout = "side",
  sequenceContent,
  moves,
  progress,
  onRefresh,
  showRefresh,
  maxErrors,
  totalErrorCount,
  onReset,
  loading,
  loadingText,
  loadingSpinner,
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
  moveCountOnly = false,
  moveCount = 0,
  hintText,
  controls,
  centerBottom,
  summary,
  onCenterClick,
  cubeRef,
  visualization = "3D",
  stickering,
  stickeringMaskOrbits,
  background = "none",
  controlPanel = "none",
  dragInput = "auto",
  hintFacelets,
  hintFaceletsElevation,
  flatCubeRef,
  showFlatView = false,
  cubeToolbar,
  cubeOverlay,
  cameraLatitude,
  cameraLongitude,
  cubeSetupAlg,
  cubeSetupAnchor,
  cubeAlg,
  timesMs,
  moveCounts = [],
  statsLabel,
  statsHeight = layout === "side" ? 280 : "fill",
  showAo12,
  statsAside,
}: TrainerPanelProps) {
  const { t } = useT();
  return (
    <TrainLayout
      header={header}
      leftAside={leftAside}
      layout={layout}
      sequence={
        <>
          {sequenceTop}
          {sequenceContent ?? (
            <MoveSequenceDisplay
              moves={moves}
              progress={progress}
              decorations={sequenceDecorations}
              onRefresh={onRefresh}
              showRefresh={showRefresh}
              maxErrors={maxErrors}
              totalErrorCount={totalErrorCount}
              onReset={onReset}
              loading={loading}
              loadingText={loadingText}
              loadingSpinner={loadingSpinner}
              completeText={completeText}
              showMaskToggle={showMaskToggle}
              maskMoves={maskMoves}
              onToggleMask={onToggleMask}
              showErrorCount={showErrorCount}
              errorLabel={errorLabel}
              extraControls={sequenceTrailing}
            />
          )}

          {/* The just-finished-solve summary (stats + stage timing bar) sits
              right under the scramble — above the timer and cube, spanning
              the same block — instead of squeezed under the timer. Still
              clickable: opens the solve analysis. */}
          {summary && (
            <Tap onClick={onCenterClick} className="w-full flex justify-center mt-4">
              {summary}
            </Tap>
          )}
        </>
      }
      center={
        <>
          {centerTop}

          {/* Timer row: the big number with its controls (reset/cancel/ready)
              sitting BESIDE it, so the column under the scramble stays one
              compact block instead of a tall stack of separate rows. On
              narrow screens the controls wrap under the timer. */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <Tap onClick={onCenterClick}>
              {isInspecting ? (
                <InspectionCountdown secondsLeft={inspectionSecondsLeft} mode={inspectionMode} />
              ) : (
                <TimerDisplay
                  timeMs={timeMs}
                  state={timerState}
                  className={timerClassName}
                  moveCountOnly={moveCountOnly}
                  moveCount={moveCount}
                />
              )}
            </Tap>
            {(controls || centerBottom) && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {controls}
                {centerBottom}
              </div>
            )}
          </div>

          {hintText && <p className="text-gray-500 text-sm tracking-wide animate-pulse">{hintText}</p>}
        </>
      }
      cube={
        <div className="flex flex-col items-center gap-3">
          {/* Cube alone: centered. With the flat view shown: the two sit
              side by side as equal cells, symmetric about the column's
              center (stacked on phones). */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
            <div className="relative w-72 sm:w-80 xl:w-96 aspect-square">
              <CubeVisualisation
                ref={cubeRef}
                visualization={visualization}
                stickering={stickering}
                stickeringMaskOrbits={stickeringMaskOrbits}
                background={background}
                controlPanel={controlPanel}
                dragInput={dragInput}
                hintFacelets={hintFacelets}
                hintFaceletsElevation={hintFaceletsElevation}
                cameraLatitude={cameraLatitude}
                cameraLongitude={cameraLongitude}
                setupAlg={cubeSetupAlg}
                setupAnchor={cubeSetupAnchor}
                alg={cubeAlg}
                className="size-full"
              />
              {cubeOverlay && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-gray-950/70 backdrop-blur-sm">
                  {cubeOverlay}
                </div>
              )}
            </div>
            {flatCubeRef && (
              <div className={`w-72 sm:w-80 xl:w-96 aspect-square ${showFlatView ? "" : "hidden"}`}>
                <CubeVisualisation
                  ref={flatCubeRef}
                  visualization="2D"
                  stickering={stickering}
                  stickeringMaskOrbits={stickeringMaskOrbits}
                  background="none"
                  controlPanel="none"
                  dragInput="none"
                  setupAlg={cubeSetupAlg}
                  setupAnchor={cubeSetupAnchor}
                  alg={cubeAlg}
                  className="size-full"
                />
              </div>
            )}
          </div>
          {cubeToolbar && <div className="flex items-center justify-center gap-2">{cubeToolbar}</div>}
        </div>
      }
      stats={
        <div className="px-4 sm:px-6 pt-6 pb-8 flex flex-col gap-6 h-full">
          {statsAside && <div className="shrink-0">{statsAside}</div>}
          <div className="flex-1 min-w-0 flex flex-col">
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-4 shrink-0">
              {statsLabel ?? t("stats.label")}
            </h3>
            <div className="flex-1 min-h-0 flex flex-col">
              {moveCountOnly ? (
                <StatsChart values={moveCounts} formatValue={formatMoveCount} height={statsHeight} showAo12={showAo12} />
              ) : (
                <StatsChart values={timesMs} height={statsHeight} showAo12={showAo12} />
              )}
            </div>
          </div>
        </div>
      }
      bottom={bottom}
    />
  );
}

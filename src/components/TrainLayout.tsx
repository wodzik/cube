/**
 * TrainLayout — unified page skeleton for all trainer modes.
 *
 * Named slot props compose the page structure:
 *   header    — sticky top bar (session panel, navigation, connection panel)
 *   leftAside — a page's own persistent sidebar, e.g. a recent-times list — runs the FULL height of everything below the header (left, fixed width, optional)
 *   sequence  — scramble/algorithm strip: a full-width row of its own above the columns, centered
 *   center    — timer row (timer + its controls), plus the just-finished-solve summary under it
 *   cube      — 3-D visualisation (with the optional flat view beside it), centered UNDER the timer
 *   stats     — statistics chart, its own persistent column mirroring leftAside (right, fixed width, optional)
 *   bottom    — solves table / algorithm list / attack queue (full width, optional)
 *
 * One flat background, no dividers: sections are separated by whitespace
 * only. The main column is a single centered stack (sequence -> center ->
 * cube -> bottom), so the eye travels top-to-bottom like a stopwatch app,
 * with the two side columns as quiet reference material.
 *
 * Desktop (lg+): leftAside and stats sit left/right of everything else via
 * `lg:order-1` / `lg:order-3` on DOM-last elements — visual position is
 * CSS-only, so `expanded` content that pops out of leftAside (see
 * CompactRecentList) can stay a `position: fixed` overlay without any
 * layout-shift math. Mobile/tablet: stacked in DOM order, which puts the
 * chart and then the times list BELOW the solving UI.
 *
 * Presentational except for SplitRow's one piece of UI state: the user-
 * dragged chart width in "side" mode (persisted per browser).
 */

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";

/**
 * "stack" (Solve): timer above the cube, chart as a full-height right column.
 * "side" (drill / skill trainers / attack): timer BESIDE the cube, then the
 * chart as a wide fixed-height block, then `bottom` (the case/algorithm
 * list) across the full width — those pages are about the list as much as
 * the timer, so nothing may hog the page height.
 */
export type TrainLayoutMode = "stack" | "side";

interface TrainLayoutProps {
  header: ReactNode;
  sequence: ReactNode;
  leftAside?: ReactNode;
  center: ReactNode;
  cube: ReactNode;
  stats?: ReactNode;
  bottom?: ReactNode;
  layout?: TrainLayoutMode;
}

const CHART_WIDTH_KEY = "nact_side_chart_width";
const CHART_MIN_PX = 240;
/** Smallest width block 1 (scramble + timer/cube) keeps — timer (20rem) + cube (20rem) — mirrored by its lg:min-w class below. */
const MAIN_MIN_PX = 640;
const CHART_DEFAULT_PX = 480;

function readStoredChartWidth(): number {
  try {
    const v = Number(localStorage.getItem(CHART_WIDTH_KEY));
    return Number.isFinite(v) && v >= CHART_MIN_PX ? v : CHART_DEFAULT_PX;
  } catch {
    return CHART_DEFAULT_PX;
  }
}

/**
 * "side" mode's top section: block 1 = scramble with the timer and cube
 * spread under it, block 2 = the chart, level with the scramble, separated
 * by a drag handle that resizes block 2 (clamped so block 1 never squeezes
 * the timer against the cube). Stacks on phones, handle hidden.
 */
function SplitRow({
  leftAside,
  sequence,
  center,
  cube,
  stats,
}: Pick<TrainLayoutProps, "leftAside" | "sequence" | "center" | "cube" | "stats">) {
  const rowRef = useRef<HTMLDivElement>(null);
  const timerCubeRowRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(readStoredChartWidth);
  // True when the row can't fit block 1 + handle + a minimum-width chart:
  // the chart then drops UNDER block 1 at full width instead of the two
  // overlapping or the row overflowing the viewport.
  const [stacked, setStacked] = useState(false);

  /** How much width the chart may take next to block 1 (and the left list) — negative when it can't fit at all. */
  const availableChartWidth = () => {
    const row = rowRef.current;
    if (!row) return Infinity;
    const rect = row.getBoundingClientRect();
    const rowStyle = getComputedStyle(row);
    const rowPadding = (parseFloat(rowStyle.paddingLeft) || 0) + (parseFloat(rowStyle.paddingRight) || 0);
    // Block 1 must stay at least as wide as timer + cube (+ flat view when
    // shown) laid side by side — measured live, since the flat view toggles.
    const inner = timerCubeRowRef.current;
    const innerMin = inner
      ? Array.from(inner.children).reduce((sum, c) => sum + c.getBoundingClientRect().width, 0) +
        (parseFloat(getComputedStyle(inner).columnGap) || 0) * Math.max(0, inner.children.length - 1)
      : 0;
    const handleWidth = 32;
    const leftAsideWidth = row.querySelector<HTMLElement>("[data-left-aside]")?.getBoundingClientRect().width ?? 0;
    return rect.width - rowPadding - handleWidth - leftAsideWidth - Math.max(MAIN_MIN_PX, innerMin);
  };

  useEffect(() => {
    const row = rowRef.current;
    const inner = timerCubeRowRef.current;
    if (!row || !inner) return;
    const check = () => {
      const lg = window.matchMedia("(min-width: 1024px)").matches;
      setStacked(lg && availableChartWidth() < CHART_MIN_PX);
    };
    const ro = new ResizeObserver(check);
    ro.observe(row);
    for (const child of Array.from(inner.children)) ro.observe(child);
    check();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDrag = (e: ReactPointerEvent) => {
    const row = rowRef.current;
    if (!row) return;
    e.preventDefault();
    const rect = row.getBoundingClientRect();
    const rowPaddingRight = parseFloat(getComputedStyle(row).paddingRight) || 0;
    const maxWidth = Math.max(CHART_MIN_PX, availableChartWidth());
    let latest = chartWidth;
    const move = (ev: PointerEvent) => {
      latest = Math.min(maxWidth, Math.max(CHART_MIN_PX, rect.right - rowPaddingRight - ev.clientX));
      setChartWidth(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      try {
        localStorage.setItem(CHART_WIDTH_KEY, String(Math.round(latest)));
      } catch {
        /* per-browser convenience only */
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={rowRef}
      className={`flex flex-col px-4 sm:px-6 py-4 gap-6 ${stacked ? "lg:gap-8" : "lg:flex-row lg:items-start lg:gap-0"}`}
    >
      {leftAside != null && (
        <div data-left-aside className="lg:flex-none lg:mr-8 flex flex-col self-start">
          {leftAside}
        </div>
      )}

      {/* Block 1 keeps a hard minimum width (timer + cube never overlap the
          chart); the chart is the one that yields — it shrinks below its
          dragged width when the window gets narrower. */}
      <div className="flex-1 min-w-0 lg:min-w-fit flex flex-col gap-6">
        {/* One size down from the Solve page: block 1 shares the row with the chart, so a 20-move scramble has to fit ~900px. */}
        <div className="w-full" style={{ "--scramble-size": "1.5rem" } as CSSProperties}>
          {sequence}
        </div>
        <div ref={timerCubeRowRef} className="flex flex-col sm:flex-row items-center justify-evenly gap-8">
          <div className="flex flex-col items-center gap-4 sm:w-80 shrink-0">{center}</div>
          {cube}
        </div>
      </div>

      {stats != null && (
        <>
          <div
            onPointerDown={startDrag}
            title="Drag to resize the chart"
            className={`${stacked ? "hidden" : "hidden lg:flex"} self-stretch items-center justify-center w-6 mx-1 shrink-0 cursor-col-resize select-none touch-none group`}
          >
            <div className="h-10 w-1 rounded-full bg-white/10 group-hover:bg-white/30 group-active:bg-white/40 transition-colors" />
          </div>
          <div
            // Remount on mode switch: recharts' ResponsiveContainer keeps the
            // width it measured in the previous mode otherwise.
            key={stacked ? "stacked" : "side"}
            className={
              stacked
                ? "w-full min-w-0"
                : "w-full lg:w-auto lg:basis-[var(--chart-w)] lg:grow-0 lg:shrink lg:min-w-[240px] min-w-0"
            }
            style={{ "--chart-w": `${chartWidth}px` } as CSSProperties}
          >
            {stats}
          </div>
        </>
      )}
    </div>
  );
}

export function TrainLayout({ header, sequence, leftAside, center, cube, stats, bottom, layout = "stack" }: TrainLayoutProps) {
  const sequenceRow = (
    // Full-width row above the columns: a 20-move scramble at the display
    // size we want (~900px) doesn't fit a main column once sidebars have
    // taken their share on a 1440px screen, and the scramble is the one
    // thing that must never wrap mid-solve.
    <div className="px-4 sm:px-6 pt-4 pb-2 flex justify-center">
      <div className="w-full max-w-6xl">{sequence}</div>
    </div>
  );

  if (layout === "side") {
    return (
      <div className="flex flex-col text-white min-h-[calc(100vh-4rem)]">
        <header className="sticky top-16 z-30 flex items-center justify-between px-4 sm:px-6 py-3 gap-4 flex-wrap bg-gray-950/85 backdrop-blur-xl">
          {header}
        </header>

        <SplitRow leftAside={leftAside} sequence={sequence} center={center} cube={cube} stats={stats} />

        {bottom != null && <div className="flex-1">{bottom}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col text-white min-h-[calc(100vh-4rem)]">
      <header className="sticky top-16 z-30 flex items-center justify-between px-4 sm:px-6 py-3 gap-4 flex-wrap bg-gray-950/85 backdrop-blur-xl">
        {header}
      </header>

      {sequenceRow}

      <div className="flex-1 flex flex-col lg:flex-row">
        <div className="flex-1 min-w-0 flex flex-col lg:order-2">
          <div className="flex flex-col items-center gap-8 px-4 sm:px-6 py-6">
            <div className="w-full max-w-3xl flex flex-col items-center gap-4">{center}</div>
            <div className="w-full flex justify-center">{cube}</div>
          </div>

          {bottom != null && <div className="flex-1 overflow-y-auto">{bottom}</div>}
        </div>

        {leftAside != null && (
          <div className="lg:flex-none lg:order-1 flex flex-col px-4 sm:px-6 py-4 lg:py-6 overflow-y-auto">
            {leftAside}
          </div>
        )}

        {stats != null && (
          <div className="lg:flex-none lg:w-96 xl:w-112 lg:order-3 flex flex-col overflow-y-auto">
            {stats}
          </div>
        )}
      </div>
    </div>
  );
}

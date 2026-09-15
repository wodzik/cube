/**
 * TrainLayout — unified page skeleton for all trainer modes.
 *
 * Named slot props compose the page structure:
 *   header    — sticky top bar (session panel, navigation, connection panel)
 *   leftAside — a page's own persistent sidebar, e.g. a recent-times list — runs the FULL height of everything below the header (left, fixed width, optional)
 *   sequence  — full-width scramble/algorithm strip
 *   center    — col 1: timer, stage progress, controls (left, fixed width)
 *   cube      — col 2: 3-D visualisation (center, flex-1)
 *   stats     — statistics chart, its own persistent column mirroring leftAside — runs the FULL height of everything below the header (right, fixed width, optional)
 *   bottom    — solves table / algorithm list / attack queue (full width, optional)
 *
 * Desktop (lg+): leftAside and stats sit left/right of everything else
 * (sequence strip included), via `lg:order-1` / `lg:order-3` on DOM-last
 * elements — visual position is CSS-only, so `expanded` content that pops
 * out of leftAside (see CompactRecentList) can stay a `position: fixed`
 * overlay without any layout-shift math. Both side columns' tops line up
 * with the sequence strip, not with center/cube (which sit one row below
 * it). Mobile/tablet: stacked in DOM order, which puts leftAside/stats
 * LAST (i.e. below the solving UI, not above it) since they come after the
 * main content in markup — matching where their content used to live (the
 * `bottom` slot / an inline column beside center+cube) before they got
 * dedicated columns.
 *
 * Pure presentational component — no state, no hooks.
 */

import type { ReactNode } from "react";

interface TrainLayoutProps {
  header: ReactNode;
  sequence: ReactNode;
  leftAside?: ReactNode;
  center: ReactNode;
  cube: ReactNode;
  stats?: ReactNode;
  bottom?: ReactNode;
}

export function TrainLayout({ header, sequence, leftAside, center, cube, stats, bottom }: TrainLayoutProps) {
  return (
    <div className="flex flex-col text-white min-h-[calc(100vh-4rem)]">
      <header className="sticky top-16 z-30 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.06] gap-4 flex-wrap bg-gray-950/80 backdrop-blur-xl">
        {header}
      </header>

      <div className="flex-1 flex flex-col lg:flex-row">
        <div className="flex-1 min-w-0 flex flex-col lg:order-2">
          <div className="px-4 sm:px-6 py-4 border-b border-white/[0.06] bg-gray-900/20">{sequence}</div>

          <div className="flex-1 flex flex-col lg:flex-row">
            <div className="lg:flex-none lg:w-90 xl:w-100 lg:min-h-120 lg:border-r border-white/[0.06] flex flex-col items-center justify-center gap-6 px-5 py-10 lg:py-0 overflow-y-auto">
              {center}
            </div>

            <div className="relative lg:flex-none lg:w-105 xl:w-120 border-b lg:border-b-0 border-white/[0.06] flex items-center justify-center p-6 sm:p-8 xl:p-10 overflow-hidden">
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: "radial-gradient(ellipse 60% 55% at 50% 50%, var(--accent-glow), transparent 70%)",
                  opacity: 0.12,
                }}
              />
              {cube}
            </div>
          </div>

          {bottom != null && <div className="border-t border-white/[0.06] flex-1 overflow-y-auto">{bottom}</div>}
        </div>

        {leftAside != null && (
          <div className="lg:flex-none lg:order-1 border-t lg:border-t-0 lg:border-r border-white/[0.06] flex flex-col px-4 sm:px-5 py-4 lg:py-6 overflow-y-auto">
            {leftAside}
          </div>
        )}

        {stats != null && (
          <div className="lg:flex-none lg:w-96 xl:w-112 lg:order-3 border-t lg:border-t-0 lg:border-l border-white/[0.06] flex flex-col overflow-y-auto">
            {stats}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * TrainLayout — unified page skeleton for all trainer modes.
 *
 * Named slot props compose the page structure:
 *   header   — sticky top bar (session panel, navigation, connection panel)
 *   sequence — full-width scramble/algorithm strip
 *   center   — col 1: timer, stage progress, controls (left, fixed width)
 *   cube     — col 2: 3-D visualisation (center, flex-1)
 *   stats    — col 3: statistics chart (right, fixed width, optional)
 *   bottom   — solves table / algorithm list / attack queue (full width, optional)
 *
 * Desktop (lg+): three-column arrangement. Mobile/tablet: stacked in DOM order.
 *
 * Pure presentational component — no state, no hooks.
 */

import type { ReactNode } from "react";

interface TrainLayoutProps {
  header: ReactNode;
  sequence: ReactNode;
  center: ReactNode;
  cube: ReactNode;
  stats?: ReactNode;
  bottom?: ReactNode;
}

export function TrainLayout({ header, sequence, center, cube, stats, bottom }: TrainLayoutProps) {
  return (
    <div className="flex flex-col text-white min-h-[calc(100vh-4rem)]">
      <header className="sticky top-16 z-30 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.06] gap-4 flex-wrap bg-gray-950/80 backdrop-blur-xl">
        {header}
      </header>

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

        {stats != null && <div className="lg:flex-1 lg:min-w-0 flex flex-col">{stats}</div>}
      </div>

      {bottom != null && <div className="border-t border-white/[0.06] flex-1 overflow-y-auto">{bottom}</div>}
    </div>
  );
}

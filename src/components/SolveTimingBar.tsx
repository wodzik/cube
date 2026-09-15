/**
 * SolveTimingBar — the just-finished solve as a single segmented progress
 * bar: one span per stage GROUP (Cross / F2L / OLL / PLL, ...), width
 * proportional to time spent, with each group's own stages (e.g. F2L's 4
 * pairs) drawn as adjacent sub-segments in alternating shades of that
 * group's color. Hovering any sub-segment pops up its recognition/
 * execution/TPS/turns/percentage breakdown — and, for multi-part groups, a
 * "totals" section below it — sourced from the exact same StageTiming[]
 * SolveSummary's table and SolveAnalysis's per-stage rows already render
 * (stageTiming.ts), just visualized instead of tabulated.
 *
 * Renders nothing for a moveCountOnly session (see StoredSession
 * .moveCountOnly) — this whole component is a time breakdown, and those
 * sessions never record stage timing worth showing (SolveSummary/
 * SolveAnalysis hide the same recog/exec/total fields for the same reason).
 * Also renders nothing if the solve produced no measurable time at all.
 */

import { useState } from "react";
import type { StageTiming } from "../logic/stageDetection/stageTiming";
import { groupStageTimings, stageGroupShades, stageSlotLabel } from "./stageGroups";
import { stageDescription } from "./stageDescriptions";

interface SolveTimingBarProps {
  timings: StageTiming[];
}

function formatSeconds(ms: number): string {
  return (ms / 1000).toFixed(2);
}

function formatPercent(ms: number, totalMs: number): string {
  return totalMs > 0 ? `${((ms / totalMs) * 100).toFixed(1)}%` : "—";
}

function tps(moveCount: number, ms: number): string {
  return ms > 0 ? (moveCount / (ms / 1000)).toFixed(2) : "—";
}

/** Fades a stage's solid color for its recognition portion (the pause before acting) so execution (the actual turning) reads as the visually "heavier" part of the same segment — same hue either way, so a slot's identity (see stageGroupShades' base/alt alternation) still reads at a glance. */
function recognitionShade(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.45)`;
}

/** The popup's header label for one stage: the group name alone for a single-stage group, or "Group (part)" for a stage inside a multi-part one. */
function stageHeading(groupLabel: string, timing: StageTiming, isMultiPart: boolean): string {
  if (!isMultiPart) return groupLabel;
  const part = stageSlotLabel(timing.stage) ?? stageDescription(timing.stage, timing.detail);
  return `${groupLabel} (${part})`;
}

function StatRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[11px] font-mono tabular-nums">
      <span className="text-gray-400 font-sans">{label}</span>
      <span className={strong ? "text-gray-100 font-semibold" : "text-gray-300"}>{value}</span>
    </div>
  );
}

export function SolveTimingBar({ timings }: SolveTimingBarProps) {
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);

  const grandTotalMs = timings.reduce((sum, t) => sum + t.totalMs, 0);
  if (grandTotalMs <= 0) return null;

  const groups = groupStageTimings(timings).filter((g) => g.timings.some((t) => t.totalMs > 0));

  let cumulativeMs = 0;
  const spans = groups.map((group) => {
    const groupTotalMs = group.timings.reduce((sum, t) => sum + t.totalMs, 0);
    const startPct = (cumulativeMs / grandTotalMs) * 100;
    cumulativeMs += groupTotalMs;
    const widthPct = (groupTotalMs / grandTotalMs) * 100;
    return { group, groupTotalMs, startPct, widthPct };
  });

  const hovered = hoveredStage
    ? timings.find((t) => t.stage === hoveredStage)
    : undefined;
  const hoveredGroup = hovered ? groups.find((g) => g.timings.includes(hovered)) : undefined;
  const hoveredSpan = hoveredGroup ? spans.find((s) => s.group === hoveredGroup) : undefined;
  const hoveredIsMultiPart = (hoveredGroup?.timings.length ?? 0) > 1;
  const hoveredCenterPct = (() => {
    if (!hoveredSpan || !hovered) return 50;
    // Center over just the hovered sub-segment, not the whole group span.
    const before = hoveredGroup!.timings.slice(0, hoveredGroup!.timings.indexOf(hovered));
    const beforeMs = before.reduce((sum, t) => sum + t.totalMs, 0);
    const localStartPct = hoveredSpan.startPct + (beforeMs / grandTotalMs) * 100;
    const localWidthPct = (hovered.totalMs / grandTotalMs) * 100;
    return localStartPct + localWidthPct / 2;
  })();

  return (
    <div className="pb-1">
      {/* Group totals, centered over each group's span. */}
      <div className="relative h-5 mb-1 text-[13px] font-mono tabular-nums font-semibold text-gray-100">
        {spans.map(({ group, groupTotalMs, startPct, widthPct }) => (
          <span
            key={group.label}
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${startPct + widthPct / 2}%` }}
          >
            {formatSeconds(groupTotalMs)}
          </span>
        ))}
      </div>

      <div className="relative">
        <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-white/[0.06]">
          {spans.map(({ group, groupTotalMs, widthPct }) => {
            const [base, alt] = stageGroupShades(group.label);
            const visible = group.timings.filter((t) => t.totalMs > 0);
            return (
              <div key={group.label} className="flex h-full" style={{ width: `${widthPct}%` }}>
                {visible.map((t, i) => {
                  const slotColor = i % 2 === 0 ? base : alt;
                  const recogWidthPct = (t.recognitionMs / t.totalMs) * 100;
                  return (
                    <div
                      key={t.stage}
                      className="h-full flex box-border transition-[filter]"
                      style={{
                        width: `${(t.totalMs / groupTotalMs) * 100}%`,
                        filter: hoveredStage === t.stage ? "brightness(1.25)" : undefined,
                        borderRight: i < visible.length - 1 ? "1px solid rgba(0,0,0,0.35)" : undefined,
                      }}
                      onMouseEnter={() => setHoveredStage(t.stage)}
                      onMouseLeave={() => setHoveredStage((s) => (s === t.stage ? null : s))}
                    >
                      <div className="h-full" style={{ width: `${recogWidthPct}%`, backgroundColor: recognitionShade(slotColor) }} />
                      <div className="h-full" style={{ width: `${100 - recogWidthPct}%`, backgroundColor: slotColor }} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {hovered && hoveredGroup && (
          <div
            className="absolute top-full mt-2 z-40 w-56 rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-xl p-3 shadow-2xl shadow-black/60 pointer-events-none"
            style={{ left: `${Math.min(85, Math.max(15, hoveredCenterPct))}%`, transform: "translateX(-50%)" }}
          >
            <p className="text-xs font-semibold mb-2" style={{ color: stageGroupShades(hoveredGroup.label)[1] }}>
              {stageHeading(hoveredGroup.label, hovered, hoveredIsMultiPart)}
            </p>
            <div className="space-y-1">
              <StatRow label="Total Time:" value={`${formatSeconds(hovered.totalMs)}s`} strong />
              <StatRow label="Recognition:" value={`${formatSeconds(hovered.recognitionMs)}s`} />
              <StatRow label="Execution:" value={`${formatSeconds(hovered.executionMs)}s`} />
              <StatRow label="TPS:" value={tps(hovered.moveCount, hovered.totalMs)} />
              <StatRow label="Turns:" value={String(hovered.moveCount)} />
              <StatRow label="Percentage:" value={formatPercent(hovered.totalMs, grandTotalMs)} />
            </div>

            {hoveredIsMultiPart && (
              <>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mt-3 mb-1.5">
                  {hoveredGroup.label} Totals
                </p>
                {(() => {
                  const groupMoves = hoveredGroup.timings.reduce((sum, t) => sum + t.moveCount, 0);
                  const groupMs = hoveredGroup.timings.reduce((sum, t) => sum + t.totalMs, 0);
                  const groupRecogMs = hoveredGroup.timings.reduce((sum, t) => sum + t.recognitionMs, 0);
                  return (
                    <div className="space-y-1">
                      <StatRow label="Total Time:" value={`${formatSeconds(groupMs)}s`} strong />
                      <StatRow label="Total Recognition:" value={`${formatSeconds(groupRecogMs)}s`} />
                      <StatRow label="Total TPS:" value={tps(groupMoves, groupMs)} />
                      <StatRow label="Total Turns:" value={String(groupMoves)} />
                      <StatRow label="Percentage:" value={formatPercent(groupMs, grandTotalMs)} />
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>

      <div className="relative h-4 mt-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
        {spans.map(({ group, startPct, widthPct }) => (
          <span key={group.label} className="absolute top-0 -translate-x-1/2 whitespace-nowrap" style={{ left: `${startPct + widthPct / 2}%` }}>
            {group.label}
          </span>
        ))}
      </div>
    </div>
  );
}

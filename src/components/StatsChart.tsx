/**
 * Series chart of solve values (times by default, or e.g. move counts via
 * `values` + `formatValue`) with moving averages.
 * Lines: single time (gray), Ao5 (indigo), Ao12 (orange), Ao100 (purple) —
 * each independently toggle-able via the chips above the chart, so e.g.
 * "just Single + Ao12" is one click each. A fullscreen button opens the
 * same chart (sharing the same visibility choices) in a bigger modal for a
 * closer look.
 */

import { useEffect, useState } from "react";
import { Maximize2 } from "lucide-react";
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ao5, ao12, ao100, best, mean, formatTimeMs } from "../logic/statistics";
import { OverlayModal } from "./OverlayModal";

interface StatsChartProps {
  /** Values in chronological order (oldest first) — solve times in ms by default; anything where lower is better works (e.g. move counts) given a matching `formatValue`. */
  values: number[];
  /** How a value is rendered on the axis, tooltip, and stat cards. Defaults to formatTimeMs. */
  formatValue?: (value: number) => string;
  showAo5?: boolean;
  showAo12?: boolean;
  showAo100?: boolean;
  /** A fixed pixel height, or "fill" to stretch to whatever height the parent gives it (needs a sized flex ancestor — see TrainerPanel's stats column, used by SolvePage's "stack" layout so the chart matches the timer+cube column's height instead of sitting at a fixed size). */
  height?: number | "fill";
}

type Metric = "single" | "ao5" | "ao12" | "ao100";

const METRIC_COLOR: Record<Metric, string> = {
  single: "var(--color-gray-400)",
  ao5: "#818cf8",
  ao12: "#fb923c",
  ao100: "#c084fc",
};
const METRIC_LABEL: Record<Metric, string> = { single: "Single", ao5: "Ao5", ao12: "Ao12", ao100: "Ao100" };

interface ChartPoint {
  index: number;
  single: number;
  ao5: number | undefined;
  ao12: number | undefined;
  ao100: number | undefined;
}

function buildChartData(values: number[]): ChartPoint[] {
  return values.map((t, i) => {
    const slice = values.slice(0, i + 1);
    return {
      index: i + 1,
      single: t,
      ao5: ao5(slice) ?? undefined,
      ao12: ao12(slice) ?? undefined,
      ao100: ao100(slice) ?? undefined,
    };
  });
}

function StatCard({ label, value, accent }: { label: string; value: string | null; accent?: string }) {
  return (
    <div className="flex flex-col border-l-2 pl-2.5" style={{ borderColor: accent ?? "var(--color-gray-800)" }}>
      <span className="text-[10px] text-gray-500 uppercase tracking-widest">{label}</span>
      <span className="font-mono text-base font-semibold text-white tabular-nums">
        {value ?? <span className="text-gray-700">—</span>}
      </span>
    </div>
  );
}

function MetricChip({ metric, active, onClick }: { metric: Metric; active: boolean; onClick: () => void }) {
  const color = METRIC_COLOR[metric];
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors border border-transparent"
      style={active ? { color, borderColor: color, background: `color-mix(in srgb, ${color} 14%, transparent)` } : { color: "var(--color-gray-600)" }}
    >
      {METRIC_LABEL[metric]}
    </button>
  );
}

function CustomTooltip({
  active,
  payload,
  formatValue = formatTimeMs,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  formatValue?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900/95 backdrop-blur border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {formatValue(p.value)}
        </div>
      ))}
    </div>
  );
}

interface ChartBodyProps {
  data: ChartPoint[];
  visible: Record<Metric, boolean>;
  height: number | "fill";
  yMin: number;
  yMax: number;
  currentAo5: number | null;
  currentAo12: number | null;
  currentAo100: number | null;
  pb: number | null;
  avg: number | null;
  formatValue: (value: number) => string;
}

function ChartBody({ data, visible, height, yMin, yMax, currentAo5, currentAo12, currentAo100, pb, avg, formatValue }: ChartBodyProps) {
  const fill = height === "fill";
  return (
    <div className={`flex flex-col gap-4 ${fill ? "h-full" : ""}`}>
      <div className={fill ? "flex-1 min-h-0" : "shrink-0"}>
        <ResponsiveContainer width="100%" height={fill ? "100%" : height}>
          <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-gray-700)" strokeDasharray="3 3" />
            <XAxis dataKey="index" tick={{ fill: "var(--color-gray-500)", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis
              domain={[yMin, yMax]}
              tickFormatter={formatValue}
              tick={{ fill: "var(--color-gray-500)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip content={<CustomTooltip formatValue={formatValue} />} />
            {visible.single && (
              <Line
                type="monotone"
                dataKey="single"
                stroke={METRIC_COLOR.single}
                strokeWidth={1}
                dot={{ r: 2, fill: METRIC_COLOR.single }}
                name="Single"
                isAnimationActive={false}
              />
            )}
            {visible.ao5 && (
              <Line
                type="monotone"
                dataKey="ao5"
                stroke={METRIC_COLOR.ao5}
                strokeWidth={2}
                dot={false}
                name="Ao5"
                connectNulls
                isAnimationActive={false}
              />
            )}
            {visible.ao12 && (
              <Line
                type="monotone"
                dataKey="ao12"
                stroke={METRIC_COLOR.ao12}
                strokeWidth={2}
                dot={false}
                name="Ao12"
                connectNulls
                isAnimationActive={false}
              />
            )}
            {visible.ao100 && (
              <Line
                type="monotone"
                dataKey="ao100"
                stroke={METRIC_COLOR.ao100}
                strokeWidth={2}
                dot={false}
                name="Ao100"
                connectNulls
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-row flex-wrap justify-center sm:justify-start gap-x-8 gap-y-3 shrink-0">
        <StatCard label="Ao5" value={currentAo5 ? formatValue(currentAo5) : null} accent={METRIC_COLOR.ao5} />
        <StatCard label="Ao12" value={currentAo12 ? formatValue(currentAo12) : null} accent={METRIC_COLOR.ao12} />
        <StatCard label="Ao100" value={currentAo100 ? formatValue(currentAo100) : null} accent={METRIC_COLOR.ao100} />
        <StatCard label="Mean" value={avg ? formatValue(avg) : null} />
        <StatCard label="PB" value={pb ? formatValue(pb) : null} accent="#34d399" />
      </div>
    </div>
  );
}

export function StatsChart({ values, formatValue = formatTimeMs, showAo5 = true, showAo12 = true, showAo100 = false, height = 200 }: StatsChartProps) {
  const [visible, setVisible] = useState<Record<Metric, boolean>>({
    single: true,
    ao5: showAo5,
    ao12: showAo12,
    ao100: showAo100,
  });
  const [fullscreen, setFullscreen] = useState(false);
  // The fullscreen chart fills nearly the whole viewport — ResponsiveContainer
  // needs a concrete pixel height (percentage heights need a height-bounded
  // flex ancestor, which fights with the modal's own padding/header math more
  // than it's worth), so track viewport height directly and recompute on resize.
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 900));

  useEffect(() => {
    if (!fullscreen) return;
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [fullscreen]);

  const toggle = (metric: Metric) => setVisible((v) => ({ ...v, [metric]: !v[metric] }));

  // With no data the chart still renders its frame (grid, axes, empty stat
  // cards) with a "No data yet" overlay — so the page shows WHERE the times
  // will land instead of a blank gap that looks like a missing feature.
  const empty = values.length === 0;
  const data = buildChartData(values);
  const currentAo5 = ao5(values);
  const currentAo12 = ao12(values);
  const currentAo100 = ao100(values);
  const pb = best(values);
  const avg = mean(values);

  const yMin = Math.max(0, (pb ?? 0) * 0.9);
  const yMax = empty ? 1 : Math.max(...values) * 1.05;

  const bodyProps = { data, visible, yMin, yMax, currentAo5, currentAo12, currentAo100, pb, avg, formatValue };
  const fill = height === "fill";

  return (
    <div className={fill ? "h-full flex flex-col" : ""}>
      <div className="flex items-center gap-1 mb-2 shrink-0">
        {(["single", "ao5", "ao12", "ao100"] as const).map((m) => (
          <MetricChip key={m} metric={m} active={visible[m]} onClick={() => toggle(m)} />
        ))}
        <button
          onClick={() => setFullscreen(true)}
          title="Open fullscreen"
          className="ml-auto p-1 rounded-md text-gray-600 hover:text-gray-200 hover:bg-white/[0.06] transition-colors"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      <div className={`relative ${fill ? "flex-1 min-h-0" : ""}`}>
        <ChartBody {...bodyProps} height={height} />
        {empty && (
          <div
            className="absolute inset-x-0 top-0 flex items-center justify-center text-gray-600 text-sm pointer-events-none"
            style={fill ? { height: "100%" } : { height }}
          >
            No data yet
          </div>
        )}
      </div>

      {fullscreen && (
        <OverlayModal
          onClose={() => setFullscreen(false)}
          className="w-[94vw] h-full"
          header={(["single", "ao5", "ao12", "ao100"] as const).map((m) => (
            <MetricChip key={m} metric={m} active={visible[m]} onClick={() => toggle(m)} />
          ))}
        >
          {/* Chart height = card height minus header (≈64px), body padding
              (40px) and the Ao5/Ao12/... stat row under the chart (≈80px
              incl. gap) — so the whole thing fits without scrolling. */}
          <ChartBody {...bodyProps} height={Math.max(240, viewportHeight * 0.9 - 64 - 40 - 80)} />
        </OverlayModal>
      )}
    </div>
  );
}

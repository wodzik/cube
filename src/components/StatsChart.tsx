/**
 * Time series chart of solve times with moving averages.
 * Lines: single time (gray), Ao5 (indigo), Ao12 (orange), Ao100 (purple) —
 * each independently toggle-able via the chips above the chart, so e.g.
 * "just Single + Ao12" is one click each. A fullscreen button opens the
 * same chart (sharing the same visibility choices) in a bigger modal for a
 * closer look.
 */

import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ao5, ao12, ao100, best, mean, formatTimeMs } from "../logic/statistics";

interface StatsChartProps {
  /** Solve times in ms, chronological order (oldest first). */
  timesMs: number[];
  showAo5?: boolean;
  showAo12?: boolean;
  showAo100?: boolean;
  height?: number;
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

function buildChartData(timesMs: number[]): ChartPoint[] {
  return timesMs.map((t, i) => {
    const slice = timesMs.slice(0, i + 1);
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
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900/95 backdrop-blur border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {formatTimeMs(p.value)}
        </div>
      ))}
    </div>
  );
}

interface ChartBodyProps {
  data: ChartPoint[];
  visible: Record<Metric, boolean>;
  height: number;
  yMin: number;
  yMax: number;
  currentAo5: number | null;
  currentAo12: number | null;
  currentAo100: number | null;
  pb: number | null;
  avg: number | null;
}

function ChartBody({ data, visible, height, yMin, yMax, currentAo5, currentAo12, currentAo100, pb, avg }: ChartBodyProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1 min-w-0">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-gray-700)" strokeDasharray="3 3" />
            <XAxis dataKey="index" tick={{ fill: "var(--color-gray-500)", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis
              domain={[yMin, yMax]}
              tickFormatter={(v: number) => formatTimeMs(v)}
              tick={{ fill: "var(--color-gray-500)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />
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

      <div className="flex flex-row sm:flex-col justify-center gap-4 sm:pr-2 sm:min-w-21 flex-wrap">
        <StatCard label="Ao5" value={currentAo5 ? formatTimeMs(currentAo5) : null} accent={METRIC_COLOR.ao5} />
        <StatCard label="Ao12" value={currentAo12 ? formatTimeMs(currentAo12) : null} accent={METRIC_COLOR.ao12} />
        <StatCard label="Ao100" value={currentAo100 ? formatTimeMs(currentAo100) : null} accent={METRIC_COLOR.ao100} />
        <StatCard label="Mean" value={avg ? formatTimeMs(avg) : null} />
        <StatCard label="PB" value={pb ? formatTimeMs(pb) : null} accent="#34d399" />
      </div>
    </div>
  );
}

export function StatsChart({ timesMs, showAo5 = true, showAo12 = true, showAo100 = false, height = 200 }: StatsChartProps) {
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    onResize();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [fullscreen]);

  const toggle = (metric: Metric) => setVisible((v) => ({ ...v, [metric]: !v[metric] }));

  if (timesMs.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-600 text-sm" style={{ height }}>
        No data yet
      </div>
    );
  }

  const data = buildChartData(timesMs);
  const currentAo5 = ao5(timesMs);
  const currentAo12 = ao12(timesMs);
  const currentAo100 = ao100(timesMs);
  const pb = best(timesMs);
  const avg = mean(timesMs);

  const yMin = Math.max(0, (pb ?? 0) * 0.9);
  const yMax = Math.max(...timesMs) * 1.05;

  const bodyProps = { data, visible, yMin, yMax, currentAo5, currentAo12, currentAo100, pb, avg };

  return (
    <div>
      <div className="flex items-center gap-1 mb-2">
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

      <ChartBody {...bodyProps} height={height} />

      {fullscreen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3"
          onClick={() => setFullscreen(false)}
        >
          <div
            className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 w-[97vw] h-[95vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-1">
                {(["single", "ao5", "ao12", "ao100"] as const).map((m) => (
                  <MetricChip key={m} metric={m} active={visible[m]} onClick={() => toggle(m)} />
                ))}
              </div>
              <button onClick={() => setFullscreen(false)} className="p-1.5 text-gray-500 hover:text-gray-200 transition-colors shrink-0">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0 p-5 overflow-y-auto">
              <ChartBody {...bodyProps} height={Math.max(280, viewportHeight * 0.95 - 64 - 40)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

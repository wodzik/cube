/**
 * Time series chart of solve times with moving averages.
 * Lines: single time (gray), Ao5 (indigo), Ao12 (orange).
 * Side panel: current Ao5, Ao12, mean, PB.
 */

import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ao5, ao12, best, mean, formatTimeMs } from "../logic/statistics";

interface StatsChartProps {
  /** Solve times in ms, chronological order (oldest first). */
  timesMs: number[];
  showAo5?: boolean;
  showAo12?: boolean;
  height?: number;
}

interface ChartPoint {
  index: number;
  single: number;
  ao5: number | undefined;
  ao12: number | undefined;
}

function buildChartData(timesMs: number[]): ChartPoint[] {
  return timesMs.map((t, i) => {
    const slice = timesMs.slice(0, i + 1);
    return {
      index: i + 1,
      single: t,
      ao5: ao5(slice) ?? undefined,
      ao12: ao12(slice) ?? undefined,
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

export function StatsChart({ timesMs, showAo5 = true, showAo12 = true, height = 200 }: StatsChartProps) {
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
  const pb = best(timesMs);
  const avg = mean(timesMs);

  const yMin = Math.max(0, (pb ?? 0) * 0.9);
  const yMax = Math.max(...timesMs) * 1.05;

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-gray-700)" strokeDasharray="3 3" />
            <XAxis
              dataKey="index"
              tick={{ fill: "var(--color-gray-500)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tickFormatter={(v: number) => formatTimeMs(v)}
              tick={{ fill: "var(--color-gray-500)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="single"
              stroke="var(--color-gray-400)"
              strokeWidth={1}
              dot={{ r: 2, fill: "var(--color-gray-400)" }}
              name="Single"
              isAnimationActive={false}
            />
            {showAo5 && (
              <Line
                type="monotone"
                dataKey="ao5"
                stroke="#818cf8"
                strokeWidth={2}
                dot={false}
                name="Ao5"
                connectNulls
                isAnimationActive={false}
              />
            )}
            {showAo12 && (
              <Line
                type="monotone"
                dataKey="ao12"
                stroke="#fb923c"
                strokeWidth={2}
                dot={false}
                name="Ao12"
                connectNulls
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col justify-center gap-4 pr-2 min-w-21">
        <StatCard label="Ao5" value={currentAo5 ? formatTimeMs(currentAo5) : null} accent="#818cf8" />
        <StatCard label="Ao12" value={currentAo12 ? formatTimeMs(currentAo12) : null} accent="#fb923c" />
        <StatCard label="Mean" value={avg ? formatTimeMs(avg) : null} />
        <StatCard label="PB" value={pb ? formatTimeMs(pb) : null} accent="#34d399" />
      </div>
    </div>
  );
}

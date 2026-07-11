/**
 * Inspection countdown display.
 *
 * Color coding per WCA rules (also reused for custom countdowns, where the
 * zones are just "running out" cues, not penalties):
 *   > 8s  → white  (normal)
 *   ≤ 8s  → yellow (warning)
 *   ≤ 3s  → orange (+2 zone under WCA)
 *   ≤ 0s  → red    (DNF zone under WCA)
 *
 * The +2/DNF hint texts are WCA-only — a custom-length inspection has no
 * official penalties, so overtime there just shows "Time's up!".
 */

interface InspectionCountdownProps {
  /** Seconds remaining. Negative values = overtime. */
  secondsLeft: number;
  mode: "wca" | "custom" | "unlimited";
}

function getColorClass(secondsLeft: number, mode: InspectionCountdownProps["mode"]): string {
  if (mode === "unlimited") return "text-amber-400";
  if (secondsLeft <= 0) return "text-red-500";
  if (secondsLeft <= 3) return "text-orange-400";
  if (secondsLeft <= 8) return "text-amber-400";
  return "text-white";
}

function getLabel(secondsLeft: number, mode: InspectionCountdownProps["mode"]): string {
  if (mode === "unlimited") return "INSPECT";
  if (secondsLeft <= 0) return mode === "wca" ? "DNF" : "0";
  return String(Math.ceil(secondsLeft));
}

export function InspectionCountdown({ secondsLeft, mode }: InspectionCountdownProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-widest">Inspection</span>
      <span className={`font-mono text-6xl tabular-nums font-bold ${getColorClass(secondsLeft, mode)}`}>
        {getLabel(secondsLeft, mode)}
      </span>
      {mode === "wca" && secondsLeft <= 3 && secondsLeft > 0 && (
        <span className="text-xs text-orange-400">+2 if you start now</span>
      )}
      {mode === "wca" && secondsLeft <= 0 && <span className="text-xs text-red-500">Stop or DNF!</span>}
      {mode === "custom" && secondsLeft <= 0 && <span className="text-xs text-red-500">Time's up!</span>}
    </div>
  );
}

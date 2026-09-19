/**
 * Live timer display. Does NOT drive its own timer — receives timeMs as a
 * prop, fed by useAnimationTimer for smooth updates.
 */

import { formatTimeMs } from "../logic/statistics";
import { useT } from "../i18n/useT";

type TimerState = "idle" | "holding" | "armed" | "inspecting" | "solving" | "solved" | "dnf";

interface TimerDisplayProps {
  timeMs: number;
  state: TimerState;
  className?: string;
  /** Show `moveCount` instead of `timeMs` — see StoredSession.moveCountOnly. */
  moveCountOnly?: boolean;
  moveCount?: number;
}

const STATE_CLASSES: Record<TimerState, string> = {
  idle: "text-gray-300",
  // Hold-to-start feedback (spacebar/BT timer) — red while held but not yet
  // past the minimum hold duration, green once armed (release now to go).
  holding: "text-red-400 timer-glow-holding",
  armed: "text-emerald-400 timer-glow-armed",
  inspecting: "text-amber-400 timer-glow-inspecting",
  solving: "text-white timer-glow-running",
  solved: "text-emerald-400 timer-glow-solved",
  dnf: "text-gray-600 line-through",
};

export function TimerDisplay({ timeMs, state, className = "", moveCountOnly = false, moveCount = 0 }: TimerDisplayProps) {
  const { tn } = useT();
  return (
    <div className={`font-mono tabular-nums select-none tracking-tight ${STATE_CLASSES[state]} ${className}`}>
      {state === "dnf" ? (
        <span className="text-gray-600">DNF</span>
      ) : moveCountOnly ? (
        <>
          {moveCount}
          <span className="text-[0.35em] font-sans font-semibold text-gray-500 ml-2 tracking-wide uppercase align-middle">{tn("unit.moves", moveCount)}</span>
        </>
      ) : (
        formatTimeMs(timeMs)
      )}
    </div>
  );
}

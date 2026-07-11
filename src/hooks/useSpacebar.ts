/**
 * Adapter hook: spacebar → session start/stop signals.
 *
 * - Toggle mode (default): press starts (on keyup, from ready/inspecting),
 *   press stops (on keydown, while active).
 * - Hold-to-start mode (cstimer/WCA-timer style): hold space while ready/
 *   inspecting — release BEFORE holdDurationMs and nothing happens (too
 *   early, matches a real StackMat's "hands off before grace delay expired"
 *   rejection); release AT OR AFTER holdDurationMs and it starts. There is
 *   deliberately no maximum hold time — real cstimer and StackMat timers
 *   don't enforce one either; the "green light" just stays on until you
 *   release, however long that takes.
 *
 * pressState exposes this for UI feedback (color the timer digits, etc.):
 *   "idle"    — not currently holding.
 *   "holding" — held, but not yet past holdDurationMs.
 *   "armed"   — held past holdDurationMs — release now to start.
 * Only meaningful when holdToStart is true; stays "idle" otherwise.
 *
 * Inactive unless spacebar is configured as the start or stop method.
 */

import { useEffect, useRef, useState } from "react";
import { useSession } from "../state/sessionContext";

export type SpacebarPressState = "idle" | "holding" | "armed";

export interface UseSpacebarOptions {
  holdToStart?: boolean;
  holdDurationMs?: number;
}

export interface UseSpacebarReturn {
  pressState: SpacebarPressState;
}

export function useSpacebar(options: UseSpacebarOptions = {}): UseSpacebarReturn {
  const { holdToStart = false, holdDurationMs = 300 } = options;
  const { state, signalStart, signalStop } = useSession();
  const [pressState, setPressState] = useState<SpacebarPressState>("idle");

  const stateRef = useRef(state);
  stateRef.current = state;

  const holdStartRef = useRef<number | null>(null);
  const armTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const spacebarActive =
      state.config.startMethod.includes("spacebar") || state.config.stopMethod.includes("spacebar");
    if (!spacebarActive) return;

    const clearArmTimer = () => {
      if (armTimeoutRef.current) {
        clearTimeout(armTimeoutRef.current);
        armTimeoutRef.current = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();

      const phase = stateRef.current.phase;

      // Stopping always happens on keydown while active, independent of the
      // start style — matches cstimer/StackMat: a press during a running
      // solve stops it immediately, there are no hold semantics on the way
      // down. (This used to live only in the non-holdToStart branch below,
      // which silently made spacebar unable to stop a solve at all in
      // hold-to-start mode.)
      if (phase === "active" && stateRef.current.config.stopMethod.includes("spacebar")) {
        signalStop("spacebar");
        return;
      }

      if (holdToStart) {
        if (
          (phase === "ready" || phase === "inspecting") &&
          stateRef.current.config.startMethod.includes("spacebar")
        ) {
          holdStartRef.current = performance.now();
          setPressState("holding");
          clearArmTimer();
          armTimeoutRef.current = setTimeout(() => setPressState("armed"), holdDurationMs);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();

      const phase = stateRef.current.phase;

      if (holdToStart) {
        clearArmTimer();
        // The timeout above is only for the visual "armed" cue — the actual
        // gate re-measures the hold duration here, so it's correct even if
        // this event loop tick was delayed past the timeout firing.
        //
        // holdStartRef is only set by a keydown that ALREADY saw ready/
        // inspecting (above) — if it's still null, the physical hold began
        // before the phase became ready (e.g. held through the tail end of
        // scrambling) and was therefore never actually timed. Without this
        // guard, `performance.now() - null` would read as a huge elapsed
        // duration and incorrectly pass the hold-time check the instant
        // ready is reached, bypassing the minimum hold entirely.
        const holdStart = holdStartRef.current;
        const holdDuration = holdStart !== null ? performance.now() - holdStart : 0;
        if (
          holdStart !== null &&
          holdDuration >= holdDurationMs &&
          (phase === "ready" || phase === "inspecting") &&
          stateRef.current.config.startMethod.includes("spacebar")
        ) {
          signalStart("spacebar");
        }
        holdStartRef.current = null;
        setPressState("idle");
      } else if (
        (phase === "ready" || phase === "inspecting") &&
        stateRef.current.config.startMethod.includes("spacebar")
      ) {
        signalStart("spacebar");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      clearArmTimer();
    };
  }, [state.config.startMethod, state.config.stopMethod, holdToStart, holdDurationMs, signalStart, signalStop]);

  // Leaving ready/inspecting (e.g. the attempt already started/stopped some
  // other way) clears any stale "armed"/"holding" indicator.
  useEffect(() => {
    if (state.phase !== "ready" && state.phase !== "inspecting") setPressState("idle");
  }, [state.phase]);

  return { pressState };
}

/**
 * Adapter hook: trainer-mode stop — ends the attempt the moment a target
 * SUB-state is reached (e.g. "cross solved"), instead of the whole cube.
 *
 * Active ONLY in solve mode's "active" phase with "stage-solved" enabled as
 * a stop method. Tracks a LiveCubeState incrementally (same walker pattern
 * as useMethodProgress: start = basePattern + scramble, then feed only the
 * moves that are new since the last render — moveLog is reset to just the
 * solve's moves when "active" begins, and only ever appends during it), and
 * checks `predicate` after each fed move. On the first hit it dispatches
 * STOP_SIGNAL with THAT move's hardware timestamp — not performance.now()
 * at effect time — so the recorded solve time isn't inflated by React's
 * render latency.
 *
 * `basePattern` is the cube state the attempt's scramble is applied FROM —
 * the solved pattern for classic from-solved flows, or the tracked physical
 * state for trainer mode's from-current-state scrambles (see
 * trainerScrambleService). null = not ready yet, detection stays off.
 *
 * Unlike useSolvedDetection (async TwistyPlayer poll + 50ms grace), this is
 * synchronous over the session's own move log: no timing race with the 3D
 * view, and a fast final move can never be missed.
 */

import { useEffect, useRef } from "react";
import { useSession } from "../state/sessionContext";
import { applyMoveToState, type LiveCubeState } from "../logic/stageDetection/liveCubeState";

export function useStageSolvedDetection(
  predicate: ((state: LiveCubeState) => boolean) | null,
  basePattern: LiveCubeState | null
): void {
  const { state, signalStop } = useSession();

  const signalStopRef = useRef(signalStop);
  signalStopRef.current = signalStop;
  const predicateRef = useRef(predicate);
  predicateRef.current = predicate;

  // Incremental tracker for the CURRENT attempt — keyed by scramble notation
  // AND base pattern identity so a new attempt (or a re-issued identical
  // scramble from a different physical state) starts a fresh walk. `fired`
  // latches after the stop signal so re-renders can't double-dispatch.
  const walkRef = useRef<{
    scramble: string;
    base: LiveCubeState;
    current: LiveCubeState;
    fedCount: number;
    fired: boolean;
  } | null>(null);

  const { phase, targetNotation, moveLog, config } = state;
  const moveCount = moveLog.length;

  useEffect(() => {
    if (phase !== "active") return;
    if (config.mode !== "solve") return;
    if (!config.stopMethod.includes("stage-solved")) return;
    if (!predicateRef.current) return;
    if (!basePattern) return;

    if (walkRef.current?.scramble !== targetNotation || walkRef.current.base !== basePattern) {
      const scrambleTokens = targetNotation.trim().split(/\s+/).filter(Boolean);
      walkRef.current = {
        scramble: targetNotation,
        base: basePattern,
        current: scrambleTokens.reduce((s, m) => applyMoveToState(s, m), basePattern),
        fedCount: 0,
        fired: false,
      };
    }
    const walk = walkRef.current;
    if (walk.fired) return;

    while (walk.fedCount < moveCount) {
      const record = moveLog[walk.fedCount];
      walk.current = applyMoveToState(walk.current, record.move);
      walk.fedCount++;
      if (predicateRef.current(walk.current)) {
        walk.fired = true;
        signalStopRef.current("stage-solved", record.timestamp);
        return;
      }
    }
  }, [phase, moveCount, targetNotation, config.mode, config.stopMethod, moveLog, basePattern]);
}

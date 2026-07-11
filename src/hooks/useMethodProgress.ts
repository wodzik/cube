/**
 * Live stage progress for the current solve, for a SPECIFIC detector chosen
 * by the caller — SolvePage picks it from the active session's
 * solveMethod (see types/solve.ts's StoredSession doc comment: method
 * selection is a session setting, not auto-detected, for now — see
 * logic/stageDetection/methodResolvers.ts for the dormant auto-detect/
 * suggestion machinery this could plug into later).
 *
 * Holds a StageWalker in a ref and feeds it only the moves that are NEW
 * since the last render (tracked via a small counter ref) — not a full
 * replay of the move log from scratch on every call. `moves` grows by
 * appending during a solve and is reset to [] only when a fresh attempt
 * starts (which also changes `scramble`, resetting this hook's own
 * `startState` and thus its StageWalker too), so "new since last render"
 * is always a suffix, never a truncation — safe to track by count.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyMoveToState,
  createSolvedState,
  type LiveCubeState,
} from "../logic/stageDetection/liveCubeState";
import { StageWalker } from "../logic/stageDetection/methodTracker";
import type { StageBoundary } from "../logic/stageDetection/methodTracker";
import type { StageDetector } from "../logic/stageDetection/types";
import type { MoveRecord } from "../types/session";

export interface UseMethodProgressReturn {
  boundaries: readonly StageBoundary[];
  /** Post-scramble state boundaries were computed from — exposed so callers can recompute a
   *  fresh, authoritative snapshot at a specific instant (e.g. right when persisting a solve
   *  record) via logic/stageDetection/methodTracker's computeStageBoundaries, independent of
   *  this hook's own live tracking. */
  startState: LiveCubeState | null;
}

export function useMethodProgress(
  scramble: string,
  moves: readonly MoveRecord[],
  detector: StageDetector
): UseMethodProgressReturn {
  const [solvedState, setSolvedState] = useState<LiveCubeState | null>(null);

  useEffect(() => {
    let cancelled = false;
    createSolvedState().then((state) => {
      if (!cancelled) setSolvedState(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startState = useMemo(() => {
    if (!solvedState) return null;
    const tokens = scramble.trim().split(/\s+/).filter(Boolean);
    return tokens.reduce((state, move) => applyMoveToState(state, move), solvedState);
  }, [solvedState, scramble]);

  const walkerRef = useRef<{ startState: LiveCubeState; method: string; walker: StageWalker; fedCount: number } | null>(null);

  const boundaries = useMemo(() => {
    if (!startState) return [];
    if (walkerRef.current?.startState !== startState || walkerRef.current.method !== detector.method) {
      walkerRef.current = { startState, method: detector.method, walker: new StageWalker(detector, startState), fedCount: 0 };
    }
    const entry = walkerRef.current;
    while (entry.fedCount < moves.length) {
      const m = moves[entry.fedCount];
      entry.walker.feedMove({ move: m.move, relativeMs: m.relativeMs }, entry.fedCount);
      entry.fedCount++;
    }
    return [...entry.walker.boundaries];
    // moves.length (not the moves array reference) is the right dependency
    // here — it's what actually changes when a new move is fed, and using
    // the array itself would defeat the incremental-feed point above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startState, moves.length, detector]);

  return { boundaries, startState };
}

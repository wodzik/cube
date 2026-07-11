/**
 * Adapter hook: cube-solved detection via TwistyPlayer → signalSolved().
 *
 * Active ONLY in solve mode's "active" phase with "cube-solved" enabled as a stop method.
 */

import { useEffect, useRef } from "react";
import { useSession } from "../state/sessionContext";
import type { CubeVisualisationRef } from "../components/CubeVisualisation";

export function useSolvedDetection(cubeRef: React.RefObject<CubeVisualisationRef | null>): void {
  const { state, signalSolved } = useSession();

  const signalSolvedRef = useRef(signalSolved);
  signalSolvedRef.current = signalSolved;

  const moveCount = state.moveLog.length;

  useEffect(() => {
    if (state.phase !== "active") return;
    if (state.config.mode !== "solve") return;
    if (!state.config.stopMethod.includes("cube-solved")) return;
    if (!cubeRef.current) return;
    if (moveCount === 0) return;

    // Give TwistyPlayer a moment to process the move before checking.
    const timeoutId = setTimeout(async () => {
      try {
        const solved = await cubeRef.current?.isSolved();
        if (solved) signalSolvedRef.current();
      } catch {
        // isSolved may fail transiently — ignore, next move will retry.
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [moveCount, state.phase, state.config.mode, state.config.stopMethod, cubeRef]);
}

/**
 * Cube-solved detection → signalSolved(), from the smart cube's tracked
 * state (cubecore SmartCubeSession) — exact and immediate, stamped with the
 * move that solved it. (Asking the 3D view instead lagged behind its own
 * animation of the last move: a quick final turn was missed and the timer
 * kept running.)
 *
 * Active ONLY in solve mode's "active" phase with "cube-solved" enabled as a stop method.
 */

import { useEffect, useRef } from "react";
import { isSolved } from "@wodzik/cubecore/core";
import { useSession } from "../state/sessionContext";
import { useSmartCubeConnection } from "./useSmartCube";

export function useSolvedDetection(): void {
  const { state, signalSolved } = useSession();
  const cube = useSmartCubeConnection();
  const signalSolvedRef = useRef(signalSolved);
  signalSolvedRef.current = signalSolved;

  const moveCount = state.moveLog.length;
  const last = state.moveLog[moveCount - 1];

  useEffect(() => {
    if (state.phase !== "active") return;
    if (state.config.mode !== "solve") return;
    if (!state.config.stopMethod.includes("cube-solved")) return;
    if (moveCount === 0 || !cube?.session) return;
    if (isSolved(cube.session.state)) signalSolvedRef.current(last?.timestamp);
  }, [moveCount, last, state.phase, state.config.mode, state.config.stopMethod, cube?.session]);
}

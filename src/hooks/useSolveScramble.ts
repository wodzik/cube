/**
 * Solve-mode scrambles on cubecore, from wherever the cube is.
 *
 * Every attempt has an OFFICIAL scramble — a random-state scramble from a
 * solved cube (what's saved, shared, analysed, reused) — and a PATH: the
 * moves that take the cube from its current state (the app-wide
 * SmartCubeSession's, so whatever happened on other pages) to that
 * scrambled state. The path is the session's target, shown and tracked in
 * the scramble bar; with the cube solved (or none connected) it simply IS
 * the official scramble.
 *
 * Scrambled by hand instead (MANUAL_SETUP_DONE, or a non-scratch starting
 * stage)? `settle()` at "ready" finds the official scramble for the state
 * the cube is actually in (inverse of its solution).
 */

import { useCallback, useRef, useState } from "react";
import { type State, applyMoves, formatAlg, invert, solvedState, statesEqual } from "@cubecore/core";
import { useSession } from "../state/sessionContext";
import { useSmartCubeConnection } from "./useSmartCube";
import { cubecoreSolver } from "../services/cubecoreSolver";

export interface UseSolveScrambleReturn {
  /** A new random scramble. */
  generate: () => Promise<void>;
  /** A given scramble (pasted, reused from a past solve). */
  use: (scramble: string) => Promise<void>;
  /** The same scramble again, from wherever the cube is now. */
  rearm: () => Promise<void>;
  /** The official scramble for the state the cube is in now — call once scrambling is done. */
  settle: (performed: string) => Promise<void>;
  /** No scramble to follow: the cube is set up by hand (a non-scratch starting stage). */
  manual: () => void;
  /** The official scramble of this attempt ("" until known). */
  official: string;
  isGenerating: boolean;
  error: string | null;
}

export function useSolveScramble(): UseSolveScrambleReturn {
  const { setTarget } = useSession();
  const cube = useSmartCubeConnection();
  const cubeRef = useRef(cube);
  cubeRef.current = cube;
  const officialRef = useRef<{ moves: string; state: State } | null>(null);
  const [official, setOfficial] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOfficialScramble = (o: { moves: string; state: State } | null) => {
    officialRef.current = o;
    setOfficial(o?.moves ?? "");
  };

  /** Arm the path from the cube's current state to the official scrambled state. */
  const arm = useCallback(
    async (o: { moves: string; state: State }) => {
      const from = cubeRef.current?.session?.state;
      let path = o.moves;
      if (from && !statesEqual(from, solvedState())) {
        const between = await cubecoreSolver().solveBetween(from, o.state);
        if (between) path = formatAlg(between);
      }
      setOfficialScramble(o);
      setTarget(path);
    },
    [setTarget]
  );

  const run = useCallback(async (job: () => Promise<void>) => {
    setIsGenerating(true);
    setError(null);
    try {
      await job();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate scramble");
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const generate = useCallback(
    () =>
      run(async () => {
        const r = await cubecoreSolver().randomScramble({ preset: "full" });
        await arm({ moves: formatAlg(r.moves), state: r.state });
      }),
    [run, arm]
  );

  const use = useCallback(
    (scramble: string) => run(() => arm({ moves: scramble, state: applyMoves(solvedState(), scramble) })),
    [run, arm]
  );

  const rearm = useCallback(async () => {
    if (officialRef.current) await run(() => arm(officialRef.current!));
    else setTarget("");
  }, [run, arm, setTarget]);

  const manual = useCallback(() => {
    setOfficialScramble(null);
    setTarget("");
  }, [setTarget]);

  const settle = useCallback(async (performed: string) => {
    const now = cubeRef.current?.session?.state;
    if (!now) {
      // No cube: nothing to check — the scramble shown (or done by hand from solved) it is.
      if (!officialRef.current && performed.trim()) setOfficialScramble({ moves: performed, state: applyMoves(solvedState(), performed) });
      return;
    }
    if (officialRef.current && statesEqual(officialRef.current.state, now)) return;
    const solution = await cubecoreSolver().solve(now);
    setOfficialScramble(solution ? { moves: formatAlg(invert(solution)), state: now } : null);
  }, []);

  return { generate, use, rearm, settle, manual, official, isGenerating, error };
}


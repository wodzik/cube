/**
 * Random-state scrambles, one ready ahead of time.
 *
 * The solver worker builds its tables on first use (a second or so on a slow
 * machine), so the very first scramble of a visit used to wait for that.
 * Instead, every time a scramble is taken the NEXT one is generated in the
 * background and kept in localStorage — the next scramble (even on the next
 * visit, before the worker has started) is there at once. A kept scramble
 * is removed when it's taken, so none is ever used twice.
 */

import { type State, applyMoves, formatAlg, solvedState } from "@wodzik/cubecore/core";
import { cubecoreSolver } from "./cubecoreSolver";

const KEY = "nact_next_scramble";

export interface ReadyScramble {
  moves: string;
  state: State;
}

let refilling: Promise<void> | null = null;

function takeStored(): ReadyScramble | null {
  try {
    const moves = localStorage.getItem(KEY);
    if (!moves) return null;
    localStorage.removeItem(KEY);
    return { moves, state: applyMoves(solvedState(), moves) };
  } catch {
    return null;
  }
}

async function generateNow(): Promise<ReadyScramble> {
  const r = await cubecoreSolver().randomScramble({ preset: "full" });
  return { moves: formatAlg(r.moves), state: r.state };
}

/** Generate the next scramble in the background (once at a time) and keep it. */
export function refillScramble(): Promise<void> {
  refilling ??= generateNow()
    .then((s) => {
      try {
        localStorage.setItem(KEY, s.moves);
      } catch {
        // not kept: the next one is generated on demand
      }
    })
    .catch(() => undefined)
    .finally(() => {
      refilling = null;
    });
  return refilling;
}

/** A random-state scramble from solved: the kept one at once if there is one, else a fresh one; the next is prepared behind it. */
export async function takeScramble(): Promise<ReadyScramble> {
  let ready = takeStored();
  if (!ready && refilling) {
    // One is being prepared right now — waiting for it is quicker than starting another.
    await refilling;
    ready = takeStored();
  }
  const s = ready ?? (await generateNow());
  void refillScramble();
  return s;
}

/** Start the solver early (its tables) and make sure a scramble is kept — call at app start. */
export function prepareScrambles(): void {
  try {
    if (localStorage.getItem(KEY)) {
      // A scramble is ready; still start the worker so solving / paths are warm.
      void cubecoreSolver().warmUp();
      return;
    }
  } catch {
    // no storage: just warm up below
  }
  void refillScramble();
}

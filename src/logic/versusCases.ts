/**
 * Versus "Cases" rounds: instead of a full scramble, one step case on the
 * screen for everyone (Steps' Recognize) — a cross of a chosen optimal
 * length, one F2L slot (the others solved), an OLL or a PLL. Each player's
 * moves are played onto the case; the first whose step is done wins.
 *
 * Built on the Steps catalog (trainerCatalog): same generation, masks and
 * "done" checks; the colour picked goes down (white by default).
 */

import { type Face, type Frame, type Mask, type State, buildMask, checks, solvedState, view } from "@wodzik/cubecore/core";
import { CFOP_TRAINERS, type F2LSlot } from "@wodzik/cubecore/cfop";
import { BOTTOM_COLOURS, SLOTS, doneLocally, f2lKeep, frameForBottom, llCase, trainerById } from "./trainerCatalog";
import { cubecoreSolver } from "../services/cubecoreSolver";

export type VersusCaseKind = "cross" | "f2l" | "oll" | "pll";

/** Which cases can come up: cross optimal lengths, F2L slots, OLL, PLL (empty / false: not in the pool) — built on the `bottom` colour. */
export interface VersusPool {
  cross: number[];
  f2l: F2LSlot[];
  oll: boolean;
  pll: boolean;
  /** The face whose colour goes down (home colour scheme: U = white). */
  bottom: Face;
}

export const CROSS_LEVELS = (() => {
  const l = trainerById("cross")!.levels!;
  return Array.from({ length: l.max - l.min + 1 }, (_, i) => i + l.min);
})();

export const DEFAULT_POOL: VersusPool = { cross: [], f2l: [], oll: false, pll: true, bottom: "U" };

/** Kinds in the pool. */
export const poolKinds = (p: VersusPool): VersusCaseKind[] =>
  [p.cross.length ? "cross" : null, p.f2l.length ? "f2l" : null, p.oll ? "oll" : null, p.pll ? "pll" : null].filter((k): k is VersusCaseKind => k !== null);

/** A pool read back from storage: only known values, never empty. */
export function sanitizePool(raw: Partial<VersusPool> | null | undefined): VersusPool {
  const p: VersusPool = {
    cross: Array.isArray(raw?.cross) ? CROSS_LEVELS.filter((n) => raw.cross!.includes(n)) : [],
    f2l: Array.isArray(raw?.f2l) ? SLOTS.filter((s) => raw.f2l!.includes(s)) : [],
    oll: raw?.oll === true,
    pll: raw?.pll === true,
    bottom: BOTTOM_COLOURS.find(([f]) => f === raw?.bottom)?.[0] ?? "U",
  };
  return poolKinds(p).length ? p : { ...DEFAULT_POOL, bottom: p.bottom };
}

export interface VersusCase {
  kind: VersusCaseKind;
  /** The case: the physical state shown (as held in `frame`). */
  state: State;
  frame: Frame;
  mask: Mask;
  /** What to do ("Solve the cross!"). */
  goal: string;
  /** Which case it was — told after the round ("Cross · optimal 5", "F2L FR", "OLL 27", "T perm"). */
  label: string;
  /** Is the step done (state: the case with the player's moves on it)? */
  done: (s: State) => boolean;
}

const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

/** A random case from the pool — one kind at random, then one case of it. */
export async function generateVersusCase(pool: VersusPool): Promise<VersusCase> {
  const frame = frameForBottom(pool.bottom);
  const kind = pick(poolKinds(pool));
  const def = trainerById(kind)!;
  if (kind === "cross") {
    const length = pick(pool.cross);
    const r = await cubecoreSolver().stageScramble({ stage: CFOP_TRAINERS.cross(), length, frame, from: solvedState() });
    if (!r) throw new Error(`No cross case at ${length} moves`);
    return {
      kind,
      state: r.state,
      frame,
      mask: buildMask(def.mask("", []), frame),
      goal: def.goal,
      label: `Cross · optimal ${length}`,
      done: (s) => checks.crossSolved(view(s, frame)),
    };
  }
  if (kind === "f2l") {
    const slot = pick(pool.f2l);
    const r = await cubecoreSolver().randomScramble({ preset: "f2l", keep: f2lKeep([slot]), frame, from: solvedState() });
    return {
      kind,
      state: r.state,
      frame,
      mask: buildMask(def.mask("solved", [slot]), frame),
      goal: def.goal.replace("{v}", `${slot} pair`),
      label: `F2L ${slot}`,
      done: (s) => doneLocally(def, s, frame, "solved", [slot]) === true,
    };
  }
  const { state, caseId } = llCase(kind, "all", frame);
  return {
    kind,
    state,
    frame,
    mask: buildMask(def.mask("", []), frame),
    goal: def.goal,
    label: kind === "pll" ? `${caseId} perm` : caseId,
    done: (s) => doneLocally(def, s, frame) === true,
  };
}

/**
 * Roux trainer generation — FB (first block) and SS (second square), built
 * on the vendored onionhoney/roux-trainers pure-TS solver library
 * (src/vendor/roux — GPL-3.0; ALL access to it goes through this module).
 *
 * Unlike the CFOP-family engines there are no depth-indexed tables here:
 * exact-level cases come from REJECTION SAMPLING, the same production
 * scheme roux-trainers itself uses — draw a uniformly random state (full
 * random for FB; FB-solved-rest-random for SS via their masks), reject
 * cheaply on the pruning-table lower bound, then confirm the exact optimal
 * with a full solve. Measured: every practical level lands in ≲100 ms
 * (FB 3–8, SS 3–10 — deeper levels simply don't exist / are astronomically
 * rare, so the UI doesn't offer them).
 *
 * FB's optimum is the MINIMUM over x/x'/x2 premoves (orientation-neutral
 * about the L-R axis), matching roux-trainers' metric AND our detection:
 * rouxTargets' predicates accept the block under any x^k offset — the same
 * freedom, so verdicts are consistent with what detection stops on.
 *
 * The sampled state is turned into a generator SEQUENCE with the vendored
 * min2phase (state → clean ~20-move alg, round-trip verified by unit
 * tests), and from there the standard pipeline applies: c = invert(gen),
 * composeScramble from the cube's current transformation, piece-exact
 * verification. Everything crosses the vendor boundary as move sequences —
 * no CubieCube↔KPattern state conversion anywhere.
 */

import { cube3x3x3 } from "cubing/puzzles";
import type { KPuzzle, KTransformation } from "cubing/kpuzzle";
import { CubieCube, CubeUtil, Mask } from "../vendor/roux/CubeLib";
import { FbSolver, SsSolver, FsSolver, FbdrSolver, EOLRSolver, Min2PhaseSolver } from "../vendor/roux/Solver";
import type { SolverT } from "../vendor/roux/Solver";
import { CMLL_ALGS } from "../vendor/roux/cmllAlgs";
import { invertSequence } from "../logic/moveParser";
import { collapseToStm } from "../logic/moveReduction";
import { ROUX_SS_SIDES, type RouxSsSide } from "../logic/trainer/rouxTargets";
import { tokenize, composeScramble } from "./trainerCompose";
import type { TrainerScramble } from "./trainerScrambleService";

export const FB_LEVEL_RANGE = { min: 3, max: 8 } as const;
export const SS_LEVEL_RANGE = { min: 3, max: 10 } as const;
export const FS_LEVEL_RANGE = { min: 2, max: 6 } as const;
export const FBDR_LEVEL_RANGE = { min: 2, max: 7 } as const;
export const EOLR_LEVEL_RANGE = { min: 3, max: 10 } as const;

export type RouxTrainerType = "fb" | "fs" | "fbdr" | "ss" | "eolr" | "cmll";
/** The level-based subset — cmll is CASE-based (book-optimal per case, no level dial). */
type RouxLevelType = Exclude<RouxTrainerType, "cmll">;

const FB_PREMOVES = ["", "x", "x'", "x2"] as const;
/** FB and FS optima are x-orientation-neutral (min over premoves); the rest have frames fixed by their pre-solved pieces. */
const PREMOVE_NEUTRAL: Record<RouxLevelType, boolean> = { fb: true, fs: true, fbdr: false, ss: false, eolr: false };
/** Search depth caps, per the upstream trainers' solverR settings. */
const SOLVE_CAPS: Record<RouxLevelType, number> = { fb: 11, fs: 10, fbdr: 11, ss: 14, eolr: 14 };
const SAMPLE_MAX_ATTEMPTS = 3000;
const MAX_GENERATION_RETRIES = 3;
const EXAMPLE_SOLUTIONS_SHOWN = 5;

// ─── Lazy engine (solvers + min2phase) ───

interface RouxEngine {
  fb: SolverT;
  ss: Record<RouxSsSide, SolverT>;
  fs: Record<RouxSsSide, SolverT>;
  fbdr: SolverT;
  /** 0x11 = both aligned- and misaligned-center goal variants. */
  eolr: SolverT;
  stateToGenerator: (cube: InstanceType<typeof CubieCube>) => string[];
}

let engine: RouxEngine | null = null;

export function isRouxEngineReady(): boolean {
  return engine !== null;
}

/** Builds pruning tables + min2phase tables on first call (~1 s total). */
export function getRouxEngine(): RouxEngine {
  if (!engine) {
    const m2p = Min2PhaseSolver();
    engine = {
      fb: FbSolver(),
      ss: { front: SsSolver(true), back: SsSolver(false) },
      fs: { front: FsSolver(true), back: FsSolver(false) },
      fbdr: FbdrSolver(),
      eolr: EOLRSolver(0x11),
      stateToGenerator: (cube) => tokenize(m2p.solve(cube, 0, 0, 0)[0].inv().toString()),
    };
  }
  return engine;
}

function solverFor(e: RouxEngine, type: RouxLevelType, side: RouxSsSide): SolverT {
  switch (type) {
    case "fb":
      return e.fb;
    case "fbdr":
      return e.fbdr;
    case "eolr":
      return e.eolr;
    case "fs":
      return e.fs[side];
    case "ss":
      return e.ss[side];
  }
}

/**
 * The random-state pool a type samples from: FB/FS draw fully random
 * states; SS keeps the whole FB solved; FBDR keeps ONE first square solved
 * (`side` = which one, matching the upstream trainer's "FS at front/back");
 * EOLR keeps both blocks + corners solved (LSE-only randomness — with
 * aligned centers: an M2-offset target would put the composed pattern's
 * centers off-home, which our piece-exact scramble verification forbids).
 */
function sampleMask(type: RouxLevelType, side: RouxSsSide) {
  switch (type) {
    case "ss":
      return Mask.fb_mask;
    case "fbdr":
      return side === "front" ? Mask.fs_front_mask : Mask.fs_back_mask;
    case "eolr":
      return Mask.lse_mask;
    default:
      return Mask.empty_mask;
  }
}

// ─── Sampling (rejection, exact level) ───

interface RouxSample {
  /** Face-turn generator of the sampled state (from solved). */
  gen: string[];
  /** Optimal solutions at exactly the requested level, display-formatted (premove-neutral types: "(x2) …" prefixes). */
  solutions: string[];
}

/** The type's premove set — [""] for fixed-frame types. */
function premovesFor(type: RouxLevelType): readonly string[] {
  return PREMOVE_NEUTRAL[type] ? FB_PREMOVES : [""];
}

function optimalLevelOk(
  solver: SolverT,
  premoves: readonly string[],
  cube: InstanceType<typeof CubieCube>,
  level: number
): boolean {
  const pruner = solver.getPruners()[0];
  const bound = Math.min(...premoves.map((pm) => pruner.query(cube.apply(pm))));
  if (bound > level) return false;
  // Exact optimum = min over premoves: nothing shorter may exist anywhere,
  // and at least one premove must hit the level exactly.
  let shorter = false;
  let atLevel = false;
  for (const pm of premoves) {
    const best = solver.solve(cube.apply(pm), 0, level, 1)[0];
    if (!best) continue;
    if (best.moves.length < level) {
      shorter = true;
      break;
    }
    if (best.moves.length === level) atLevel = true;
  }
  return !shorter && atLevel;
}

function solutionsAtLevel(
  solver: SolverT,
  premoves: readonly string[],
  cube: InstanceType<typeof CubieCube>,
  level: number
): string[] {
  return premoves
    .flatMap((pm) =>
      solver.solve(cube.apply(pm), level, level, 3).map((s) => `${pm ? `(${pm}) ` : ""}${s.toString().trim()}`)
    )
    .slice(0, EXAMPLE_SOLUTIONS_SHOWN);
}

function sampleCase(type: RouxLevelType, level: number, side: RouxSsSide): RouxSample {
  const e = getRouxEngine();
  const solver = solverFor(e, type, side);
  const premoves = premovesFor(type);
  const mask = sampleMask(type, side);
  for (let i = 0; i < SAMPLE_MAX_ATTEMPTS; i++) {
    const cube = CubeUtil.get_random_with_mask(mask);
    if (!optimalLevelOk(solver, premoves, cube, level)) continue;
    return { gen: e.stateToGenerator(cube), solutions: solutionsAtLevel(solver, premoves, cube, level) };
  }
  throw new Error(`No ${type} case found at level ${level} after ${SAMPLE_MAX_ATTEMPTS} samples`);
}

// ─── Generation (standard pipeline over the sampled generator) ───

async function generateFromSample(
  kpuzzle: KPuzzle,
  type: RouxTrainerType,
  side: RouxSsSide | undefined,
  level: number,
  sample: () => RouxSample,
  from?: KTransformation
): Promise<TrainerScramble> {
  const fromTransformation = from ?? kpuzzle.identityTransformation();
  for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt++) {
    const { gen, solutions } = sample();
    const composed = await composeScramble(kpuzzle, invertSequence(gen), fromTransformation);
    if (!composed) continue;
    return {
      type,
      face: "L",
      slot: side,
      optimalLength: level,
      exampleSolution: solutions[0],
      exampleSolutions: solutions,
      targetGenerator: gen.join(" "),
      ...composed,
    };
  }
  throw new Error(`Roux ${type} scramble generation failed after ${MAX_GENERATION_RETRIES} attempts`);
}

const CMLL_AUFS = ["", "U", "U2", "U'"] as const;

/**
 * A CMLL case, upstream-style: pick a case from the vendored alg list, wrap
 * it in random pre/post AUFs, and hide it inside a random LSE state — the
 * "book optimal" is that exact sequence's token count (executing it,
 * inverted-setup-first, is the reference solution).
 */
function sampleCmll(): RouxSample & { optimal: number } {
  const e = getRouxEngine();
  const [, alg] = CMLL_ALGS[Math.floor(Math.random() * CMLL_ALGS.length)];
  const pre = CMLL_AUFS[Math.floor(Math.random() * CMLL_AUFS.length)];
  const post = CMLL_AUFS[Math.floor(Math.random() * CMLL_AUFS.length)];
  const solution = tokenize(`${pre} ${alg} ${post}`);
  const base = CubeUtil.get_random_with_mask(Mask.lse_mask);
  const gen = [...e.stateToGenerator(base), ...invertSequence(solution)];
  return { gen, solutions: [solution.join(" ")], optimal: solution.length };
}

export async function generateRouxScramble(
  type: RouxTrainerType,
  level: number,
  side: RouxSsSide,
  from?: KTransformation
): Promise<TrainerScramble> {
  const kpuzzle = await cube3x3x3.kpuzzle();
  if (type === "cmll") {
    const sample = sampleCmll();
    const scramble = await generateFromSample(kpuzzle, "cmll", undefined, sample.optimal, () => sample, from);
    // Retry needs the case's reference solution (there is no CMLL solver to
    // recompute one) — stash it in the generic native-solution slot.
    return { ...scramble, nativeTargetSolution: sample.solutions[0] };
  }
  // fb/eolr have no side dimension — don't record one on the attempt.
  const recordedSide = type === "fb" || type === "eolr" ? undefined : side;
  return generateFromSample(kpuzzle, type, recordedSide, level, () => sampleCase(type, level, side), from);
}

export async function generateFbScramble(level: number, from?: KTransformation): Promise<TrainerScramble> {
  return generateRouxScramble("fb", level, "front", from);
}

export async function generateSsScramble(level: number, side: RouxSsSide, from?: KTransformation): Promise<TrainerScramble> {
  return generateRouxScramble("ss", level, side, from);
}

/** Re-drill the exact same Roux case: the stored generator pins the whole target state. */
export async function regenerateRouxForTarget(
  target: { type: string; slot?: string; optimalLength: number; targetGenerator?: string; nativeTargetSolution?: string },
  from?: KTransformation
): Promise<TrainerScramble> {
  if (!target.targetGenerator) throw new Error("retry: attempt has no stored target generator");
  const kpuzzle = await cube3x3x3.kpuzzle();
  const type = target.type as RouxTrainerType;
  const gen = tokenize(target.targetGenerator);
  if (type === "cmll") {
    // No CMLL solver — the case's reference solution was stored on the attempt.
    const solutions = target.nativeTargetSolution ? [target.nativeTargetSolution] : [];
    const scramble = await generateFromSample(kpuzzle, "cmll", undefined, target.optimalLength, () => ({ gen, solutions }), from);
    return { ...scramble, nativeTargetSolution: target.nativeTargetSolution };
  }
  const e = getRouxEngine();
  const cube = new CubieCube().apply(target.targetGenerator);
  const side = (target.slot as RouxSsSide | undefined) ?? "front";
  const solutions = solutionsAtLevel(solverFor(e, type, side), premovesFor(type), cube, target.optimalLength);
  const recordedSide = type === "fb" || type === "eolr" ? undefined : side;
  return generateFromSample(kpuzzle, type, recordedSide, target.optimalLength, () => ({ gen, solutions }), from);
}

// ─── Live hint ───

/**
 * Physically-executable token for a premove-frame solution move:
 * pm · f · pm⁻¹, matched against a wide+slice alphabet via kpuzzle
 * transformation equality (never hand-mapped). Full map built once per
 * premove and cached.
 */
const conjCache = new Map<string, Record<string, string>>();
const HINT_ALPHABET = ["U", "D", "L", "R", "F", "B", "M", "E", "S", "r", "l", "u", "d", "f", "b"].flatMap((b) => [
  b,
  `${b}2`,
  `${b}'`,
]);

function physicalToken(kpuzzle: KPuzzle, token: string, premove: string): string {
  if (!premove) return token;
  let map = conjCache.get(premove);
  if (!map) {
    map = {};
    const inv = premove.endsWith("'") ? premove.slice(0, -1) : premove.endsWith("2") ? premove : `${premove}'`;
    for (const t of HINT_ALPHABET) {
      const conjugated = kpuzzle.algToTransformation(`${premove} ${t} ${inv}`);
      const match = HINT_ALPHABET.find((cand) => kpuzzle.algToTransformation(cand).isIdentical(conjugated));
      if (match) map[t] = match;
    }
    conjCache.set(premove, map);
  }
  const physical = map[token];
  if (!physical) throw new Error(`hint: cannot express ${premove}-frame move "${token}" physically`);
  return physical;
}

/**
 * First move of an optimal continuation from the CURRENT mid-attempt state.
 * FB answers over all x-premoves (the returned move is conjugated back into
 * the physical frame); SS solutions are already physical. Returns null when
 * the target is reached.
 */
interface RouxCurrent {
  type: string;
  slot?: string;
  viewSetupAlg: string;
  scramble: string;
  exampleSolutions?: string[];
}

/**
 * CMLL has no solver — hints/reveal come from the case's reference
 * solution: if the user's (STM-collapsed) moves so far are a prefix of it,
 * the next reference move; otherwise nothing.
 */
function cmllReferenceContinuation(current: RouxCurrent, movesSoFar: readonly string[]): string | null {
  const solution = current.exampleSolutions?.[0];
  if (!solution) return null;
  const tokens = tokenize(solution);
  const done = collapseToStm([...movesSoFar]);
  if (done.length > tokens.length || done.some((m, i) => m !== tokens[i])) return null;
  return tokens[done.length] ?? null;
}

export async function rouxOptimalNextMove(current: RouxCurrent, movesSoFar: readonly string[]): Promise<string | null> {
  if (current.type === "cmll") return cmllReferenceContinuation(current, movesSoFar);
  const kpuzzle = await cube3x3x3.kpuzzle();
  const e = getRouxEngine();
  const type = current.type as RouxLevelType;
  const side = (current.slot as RouxSsSide | undefined) ?? "front";
  const solver = solverFor(e, type, side);
  const stateAlg = [...tokenize(current.viewSetupAlg), ...tokenize(current.scramble), ...movesSoFar].join(" ");
  const cube = new CubieCube().apply(stateAlg);

  let best: { premove: string; moves: string[] } | null = null;
  for (const pm of premovesFor(type)) {
    const sol = solver.solve(cube.apply(pm), 0, SOLVE_CAPS[type], 1)[0];
    if (sol && (!best || sol.moves.length < best.moves.length)) {
      best = { premove: pm, moves: tokenize(sol.toString()) };
    }
  }
  if (!best || best.moves.length === 0) return null;
  return physicalToken(kpuzzle, best.moves[0], best.premove);
}

/**
 * Full optimal solutions from the CURRENT mid-attempt state — the "reveal
 * solution" feature. Premove-neutral types (FB/FS) carry their "(x)"
 * prefixes, the standard human notation for orientation-neutral blocks.
 */
export async function rouxOptimalSolutions(
  current: RouxCurrent,
  movesSoFar: readonly string[],
  limit = EXAMPLE_SOLUTIONS_SHOWN
): Promise<string[]> {
  if (current.type === "cmll") return current.exampleSolutions ?? [];
  const e = getRouxEngine();
  const type = current.type as RouxLevelType;
  const side = (current.slot as RouxSsSide | undefined) ?? "front";
  const solver = solverFor(e, type, side);
  const stateAlg = [...tokenize(current.viewSetupAlg), ...tokenize(current.scramble), ...movesSoFar].join(" ");
  const cube = new CubieCube().apply(stateAlg);

  const perPremove = premovesFor(type).flatMap((pm) =>
    solver.solve(cube.apply(pm), 0, SOLVE_CAPS[type], 3).map((s) => ({ pm, tokens: tokenize(s.toString()) }))
  );
  const nonEmpty = perPremove.filter((s) => s.tokens.length > 0);
  const shortest = Math.min(...nonEmpty.map((s) => s.tokens.length), Infinity);
  return nonEmpty
    .filter((s) => s.tokens.length === shortest)
    .slice(0, limit)
    .map((s) => `${s.pm ? `(${s.pm}) ` : ""}${s.tokens.join(" ")}`);
}

export { ROUX_SS_SIDES, type RouxSsSide };

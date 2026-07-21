/**
 * Trainer scramble generation — full random-looking scrambles whose optimal
 * solution for the trained target is EXACTLY the requested length, generated
 * FROM WHATEVER STATE THE PHYSICAL CUBE IS CURRENTLY IN.
 *
 * Why from-current-state: a cross attempt deliberately ends with the cube
 * NOT solved (cross done, rest scrambled). Requiring a full re-solve between
 * attempts would kill the drill loop, so instead each new scramble is a path
 * from the cube's current state to the next target state — the caller
 * tracks the physical state as a KTransformation (every hardware move ever,
 * from the solved state the session started at) and passes it in.
 *
 * Composition (plan-trainer.md §3, same algebra as or18's trainers but with
 * cubing.js replacing min2phase and the WASM generators):
 *
 *   R = random-state scramble            (randomScrambleForEvent)
 *   A = optimal cross solution of R      (cross engine — so R·A has a solved cross)
 *   X = random cross state at depth N    (cross engine — optimal-by-construction)
 *   B = an optimal solution of X         (cross engine — so B⁻¹ takes a solved cross to X)
 *
 * The TARGET state is S = R·A·B⁻¹ applied to solved: cross exactly at X
 * (distance N), everything else random — independent of the current state.
 * The scramble to hand the user is the path T with cur·T = target. A solver
 * returns SOLUTIONS (T_Q⁻¹ for a pattern Q), so hand it
 *
 *   Q = solved.applyAlg(C).applyTransformation(T_cur),  C = B·A⁻¹·R⁻¹
 *
 * whose solution is T = (T_C·T_cur)⁻¹ = T_cur⁻¹·S. All parts are legal
 * states/move sequences, so no parity bookkeeping is ever needed.
 *
 * The result is verified before being returned: the engine re-checks that
 * cur·T's cross distance is exactly N (defence against the solver ever
 * returning a rotation-bearing alg, or a stale T_cur — the caller must
 * retry with a fresh snapshot if the cube moved mid-generation), retrying
 * internally with a fresh R if not.
 */

import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import { randomScrambleForEvent } from "cubing/scramble";
import { experimentalSolve3x3x3IgnoringCenters } from "cubing/search";
import type { KTransformation } from "cubing/kpuzzle";
import { getCrossEngine } from "../logic/trainer/crossEngine";
import {
  XCROSS_SLOT_FRAMES,
  XXCROSS_PAIR_FRAMES,
  EOCROSS_ROTATION,
  conjugateFaceTurns,
  invertRotation,
  XCROSS_CROSS_FACE,
  type XCrossSlot,
  type XXCrossPair,
} from "../logic/trainer/xcrossFrames";
import { xcrossFunc, trainerFunc, pairingFunc } from "./or18TrainerWorkers";
import { f2lCasePattern, sampleF2LPlacements } from "../logic/trainer/f2lCase";
import { tokenize, composeScramble } from "./trainerCompose";
import { invertSequence } from "../logic/moveParser";
import type { Face } from "../logic/stageDetection/lastLayerShared";
import type { RouxSsSide } from "../logic/trainer/rouxTargets";
import type { TrainerType } from "../types/trainer";

export {
  initXCrossEngine,
  isXCrossEngineReady,
  XCROSS_MAX_DEPTH,
  initEngine,
  isEngineReady,
  TRAINER_MAX_DEPTHS,
  type EngineKey,
} from "./or18TrainerWorkers";

export interface TrainerScramble {
  type: TrainerType;
  face: Face;
  /** Which F2L slot (xcross/pair), slot pair (xxcross), or SS side (roux ss) the target covers. */
  slot?: XCrossSlot | XXCrossPair | RouxSsSide;
  /** Move sequence to apply FROM the cube state generation was asked for. */
  scramble: string;
  /** Exact optimal solution length for the trained target — known by construction. */
  optimalLength: number;
  /**
   * Setup alg whose transformation equals the cube state the scramble
   * starts from — puts a TwistyPlayer at that state without replaying the
   * whole session's move history. (= invert(scramble · C), see module doc.)
   */
  viewSetupAlg: string;
  /** Engine-encoded cross state right after the scramble — cross only, for wasted-move analysis + retry pinning. */
  startCrossState?: number;
  /** One optimal solution (app frame) — WASM types; the TS cross engine enumerates its own. */
  exampleSolution?: string;
  /**
   * NATIVE-frame optimal solution of the target state — WASM types only.
   * Retrying the same case later re-pins C₀'s B to this (see
   * regenerateForTarget), reproducing the exact same target sub-state from
   * whatever the cube's state is then.
   */
  nativeTargetSolution?: string;
  /** Pairing only: the goal's insert generator that pairs with nativeTargetSolution (applB). */
  nativeTargetAppl?: string;
  /** Multiple example optimal solutions (app frame) — Roux types; single-example types use exampleSolution. */
  exampleSolutions?: string[];
  /** Face-turn generator of the whole target state — Roux types' retry pin (see rouxTrainerService). */
  targetGenerator?: string;
  /** F2L multi-pair drills: ALL trained slots (detection + mask). `slot` holds the first for display compat. */
  slots?: XCrossSlot[];
}

const MAX_GENERATION_RETRIES = 3;

export async function generateCrossScramble(
  length: number,
  face: Face = "U",
  /** Current physical cube state; omitted = solved. */
  from?: KTransformation
): Promise<TrainerScramble> {
  const engine = await getCrossEngine(face);
  const kpuzzle = await cube3x3x3.kpuzzle();
  const fromTransformation = from ?? kpuzzle.identityTransformation();
  const basePattern = kpuzzle.defaultPattern().applyTransformation(fromTransformation);
  const baseCrossState = engine.stateFromEdgesOrbit(basePattern.patternData.EDGES);

  for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt++) {
    const r = tokenize((await randomScrambleForEvent("333")).toString());
    const a = tokenize(engine.firstOptimalSolution(engine.stateAfter(r)));
    const x = engine.sampleStateAtDepth(length);
    const b = tokenize(engine.firstOptimalSolution(x));

    // C = B · A⁻¹ · R⁻¹ — see module doc comment.
    const c = [...b, ...invertSequence(a), ...invertSequence(r)];
    const pattern = kpuzzle.defaultPattern().applyAlg(new Alg(c.join(" "))).applyTransformation(fromTransformation);
    const scramble = (await experimentalSolve3x3x3IgnoringCenters(pattern)).toString().trim();
    const scrambleTokens = tokenize(scramble);

    try {
      const startCrossState = engine.stateAfter(scrambleTokens, baseCrossState);
      if (engine.distance(startCrossState) === length) {
        return {
          type: "cross",
          face,
          scramble,
          optimalLength: length,
          viewSetupAlg: invertSequence([...scrambleTokens, ...c]).join(" "),
          startCrossState,
        };
      }
    } catch {
      // Non-face-turn token in the solver output — fall through to retry.
    }
  }
  throw new Error(`Trainer scramble generation failed after ${MAX_GENERATION_RETRIES} attempts`);
}

/**
 * Cross case-drill variant ("cross-case"): NO scramble at all — the case is
 * VIRTUAL, same idea as F2L's "Case" mode (generateF2LCaseView). Samples a
 * cross state at EXACTLY the requested optimal depth and builds the setup
 * alg straight from solved. Unlike generateCrossScramble there's no R/A
 * composition step to make the REST of the cube look like a plausible
 * scramble — nothing outside the cross is ever shown (stickeringMask
 * blacks it out), so whatever the setup alg's face turns happen to leave
 * behind there is invisible and doesn't need to be random-looking.
 */
export async function generateCrossCaseView(face: Face, length: number): Promise<TrainerScramble> {
  const engine = await getCrossEngine(face);
  const x = engine.sampleStateAtDepth(length);
  const solution = tokenize(engine.firstOptimalSolution(x));
  const generator = invertSequence(solution).join(" ");
  return {
    type: "cross-case",
    face,
    scramble: "",
    optimalLength: length,
    viewSetupAlg: generator,
    targetGenerator: generator,
    startCrossState: x,
  };
}

/**
 * WASM-engine composition step (see the xcross doc comment below for the
 * algebra): given the NATIVE-frame target generator inverse C₀ and the
 * calibrated conjugating rotation, produce the app-frame scramble from the
 * current cube state via the shared composeScramble. Conjugating TOKENS
 * (instead of appending the rotation to the composed pattern) keeps the
 * pattern handed to the solver free of center displacement, so the solver
 * has no rotational freedom to land the target on a different slot/face
 * than intended. Returns null when verification fails — caller retries.
 */
async function composeAndVerify(
  kpuzzle: Awaited<ReturnType<typeof cube3x3x3.kpuzzle>>,
  c0: string[],
  rotation: string,
  from: KTransformation
): Promise<{ scramble: string; viewSetupAlg: string } | null> {
  const c = conjugateFaceTurns(kpuzzle, c0, rotation);
  return composeScramble(kpuzzle, c, from);
}

/**
 * XCross variant — same composition algebra as the cross generator, with
 * two twists (see xcrossFrames.ts / or18TrainerWorkers.ts):
 *
 *  - A and B come from the vendored WASM engine instead of the TS cross
 *    engine, and are expressed in ITS native frame (D cross + BL slot).
 *  - The target is retargeted onto our face/slot by CONJUGATING C₀'s tokens
 *    into the app frame (token-wise face relabeling under the slot's
 *    calibrated rotation): the end state becomes rot⁻¹·(native target)·rot —
 *    the same xcross under a whole-cube relabeling, optimal length preserved
 *    by symmetry.
 *
 * Verification is strict: the composed scramble applied to the from-state
 * must reproduce the intended end state exactly (piece-level identity, see
 * composeAndVerify), and the WASM re-solves the native target to confirm
 * its optimal length is exactly N — that re-solve is also returned as the
 * verdict's example solution (conjugated into the app frame).
 *
 * The eocross / xxcross / pair generators below follow the identical
 * pattern; they differ only in which engine supplies A and B, the
 * calibrated rotation, and (for pair) the goal-relative C₀ composition.
 */
export async function generateXCrossScramble(
  length: number,
  slot: XCrossSlot,
  from?: KTransformation
): Promise<TrainerScramble> {
  const kpuzzle = await cube3x3x3.kpuzzle();
  const rot = XCROSS_SLOT_FRAMES[slot].rotation;
  const fromTransformation = from ?? kpuzzle.identityTransformation();

  for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt++) {
    const r = tokenize((await randomScrambleForEvent("333")).toString());
    const { solutionOfScramble: a, solutionOfSampledState: b } = await xcrossFunc(r, length);

    // C₀ = B · A⁻¹ · R⁻¹ — native-frame target generator (its inverse).
    const c0 = [...b, ...invertSequence(a), ...invertSequence(r)];

    // Independent optimal-length check on the native target state (reached
    // from solved by invert(C₀)) — also yields the example solution.
    const check = await xcrossFunc(invertSequence(c0), 1);
    if (check.solutionOfScramble.length !== length) continue;

    const composed = await composeAndVerify(kpuzzle, c0, rot, fromTransformation);
    if (!composed) continue;

    return {
      type: "xcross",
      face: XCROSS_CROSS_FACE,
      slot,
      optimalLength: length,
      exampleSolution: conjugateFaceTurns(kpuzzle, check.solutionOfScramble, rot).join(" "),
      nativeTargetSolution: check.solutionOfScramble.join(" "),
      ...composed,
    };
  }
  throw new Error(`XCross scramble generation failed after ${MAX_GENERATION_RETRIES} attempts`);
}

/** EOCross: cross + every edge oriented. Native frame = D cross + EO; "z2" maps it onto the U (white) cross, preserving the F/B EO axis. */
export async function generateEOCrossScramble(length: number, from?: KTransformation): Promise<TrainerScramble> {
  const kpuzzle = await cube3x3x3.kpuzzle();
  const fromTransformation = from ?? kpuzzle.identityTransformation();

  for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt++) {
    const r = tokenize((await randomScrambleForEvent("333")).toString());
    const { solutionOfScramble: a, solutionOfSampledState: b } = await trainerFunc("eocross", r, length);
    const c0 = [...b, ...invertSequence(a), ...invertSequence(r)];

    const check = await trainerFunc("eocross", invertSequence(c0), 1);
    if (check.solutionOfScramble.length !== length) continue;

    const composed = await composeAndVerify(kpuzzle, c0, EOCROSS_ROTATION, fromTransformation);
    if (!composed) continue;

    return {
      type: "eocross",
      face: XCROSS_CROSS_FACE,
      optimalLength: length,
      exampleSolution: conjugateFaceTurns(kpuzzle, check.solutionOfScramble, EOCROSS_ROTATION).join(" "),
      nativeTargetSolution: check.solutionOfScramble.join(" "),
      ...composed,
    };
  }
  throw new Error(`EOCross scramble generation failed after ${MAX_GENERATION_RETRIES} attempts`);
}

/** XXCross: cross + two slots. Two engine instances (adjacent/opposite pair), retargeted per XXCROSS_PAIR_FRAMES. */
export async function generateXXCrossScramble(
  length: number,
  pair: XXCrossPair,
  from?: KTransformation
): Promise<TrainerScramble> {
  const kpuzzle = await cube3x3x3.kpuzzle();
  const frame = XXCROSS_PAIR_FRAMES[pair];
  const engine = `xxcross-${frame.pairType}` as const;
  const fromTransformation = from ?? kpuzzle.identityTransformation();

  for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt++) {
    const r = tokenize((await randomScrambleForEvent("333")).toString());
    const { solutionOfScramble: a, solutionOfSampledState: b } = await trainerFunc(engine, r, length);
    const c0 = [...b, ...invertSequence(a), ...invertSequence(r)];

    const check = await trainerFunc(engine, invertSequence(c0), 1);
    if (check.solutionOfScramble.length !== length) continue;

    const composed = await composeAndVerify(kpuzzle, c0, frame.rotation, fromTransformation);
    if (!composed) continue;

    return {
      type: "xxcross",
      face: XCROSS_CROSS_FACE,
      slot: pair,
      optimalLength: length,
      exampleSolution: conjugateFaceTurns(kpuzzle, check.solutionOfScramble, frame.rotation).join(" "),
      nativeTargetSolution: check.solutionOfScramble.join(" "),
      ...composed,
    };
  }
  throw new Error(`XXCross scramble generation failed after ${MAX_GENERATION_RETRIES} attempts`);
}

/**
 * Free pair: the goal is "pair FORMED, one insert away" (or already
 * inserted) — a 17-state goal set, see pairingGoals.ts. The engine returns
 * goal-relative solutions plus the goal's insert generator (appl), so C₀
 * routes through the inserted frame:
 *
 *   scr·A = G_A = inserted·applA   and   X·B = G_B = inserted·applB
 *   ⇒ C₀ = B · applB⁻¹ · applA · A⁻¹ · R⁻¹   (target C₀⁻¹ = state X, rest random)
 *
 * — the same composition or18's pairing_trainer page performs.
 */
export async function generatePairScramble(
  length: number,
  slot: XCrossSlot,
  from?: KTransformation
): Promise<TrainerScramble> {
  const kpuzzle = await cube3x3x3.kpuzzle();
  const rot = XCROSS_SLOT_FRAMES[slot].rotation;
  const fromTransformation = from ?? kpuzzle.identityTransformation();

  for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt++) {
    const r = tokenize((await randomScrambleForEvent("333")).toString());
    const res = await pairingFunc(r, length);
    const c0 = [
      ...res.solutionOfSampledState,
      ...invertSequence(res.applOfSampledState),
      ...res.applOfScramble,
      ...invertSequence(res.solutionOfScramble),
      ...invertSequence(r),
    ];

    const check = await pairingFunc(invertSequence(c0), 1);
    if (check.solutionOfScramble.length !== length) continue;

    const composed = await composeAndVerify(kpuzzle, c0, rot, fromTransformation);
    if (!composed) continue;

    return {
      type: "pair",
      face: XCROSS_CROSS_FACE,
      slot,
      optimalLength: length,
      exampleSolution: conjugateFaceTurns(kpuzzle, check.solutionOfScramble, rot).join(" "),
      nativeTargetSolution: check.solutionOfScramble.join(" "),
      nativeTargetAppl: check.applOfScramble.join(" "),
      ...composed,
    };
  }
  throw new Error(`Pair scramble generation failed after ${MAX_GENERATION_RETRIES} attempts`);
}

/**
 * F2L pair-insert trainer — unlike every other generator, the target state
 * is constructed DIRECTLY (f2lCase.ts samples where each trained slot's
 * corner and edge go; the rest of the cube stays near-solved) instead of
 * sampled at an exact solver depth, and no optimal length is computed
 * (optimalLength 0 — the trainer records only move count and time). The
 * composition step is shared: c = the case pattern's solution, so
 * invert(c) generates the case. 1–4 pairs (slots) per case.
 */
export async function generateF2LScramble(slots: readonly XCrossSlot[], from?: KTransformation): Promise<TrainerScramble> {
  const kpuzzle = await cube3x3x3.kpuzzle();
  const fromTransformation = from ?? kpuzzle.identityTransformation();

  for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt++) {
    const pattern = f2lCasePattern(kpuzzle, sampleF2LPlacements(slots));
    let c: string[];
    try {
      c = tokenize((await experimentalSolve3x3x3IgnoringCenters(pattern)).toString());
    } catch {
      continue;
    }
    const composed = await composeScramble(kpuzzle, c, fromTransformation);
    if (!composed) continue;

    return {
      type: "f2l",
      face: XCROSS_CROSS_FACE,
      slot: slots[0],
      slots: [...slots],
      optimalLength: 0,
      targetGenerator: invertSequence(c).join(" "),
      ...composed,
    };
  }
  throw new Error(`F2L scramble generation failed after ${MAX_GENERATION_RETRIES} attempts`);
}

/**
 * F2L case-drill variant ("f2l-case"): NO scramble at all — the case is
 * VIRTUAL. The view shows the constructed case directly (viewSetupAlg =
 * its generator) regardless of the physical cube's state, and the page
 * replays the user's moves onto it for detection. scramble stays "".
 */
export async function generateF2LCaseView(slots: readonly XCrossSlot[]): Promise<TrainerScramble> {
  const kpuzzle = await cube3x3x3.kpuzzle();

  for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt++) {
    const pattern = f2lCasePattern(kpuzzle, sampleF2LPlacements(slots));
    let solution: string[];
    try {
      solution = tokenize((await experimentalSolve3x3x3IgnoringCenters(pattern)).toString());
    } catch {
      continue;
    }
    const generator = invertSequence(solution).join(" ");
    return {
      type: "f2l-case",
      face: XCROSS_CROSS_FACE,
      slot: slots[0],
      slots: [...slots],
      scramble: "",
      optimalLength: 0,
      viewSetupAlg: generator,
      targetGenerator: generator,
    };
  }
  throw new Error(`F2L case generation failed after ${MAX_GENERATION_RETRIES} attempts`);
}

// ─── Retry (pinned target) + live hint ───

function rotationFor(type: TrainerType, slot?: XCrossSlot | XXCrossPair | RouxSsSide): string {
  switch (type) {
    case "cross":
    case "fb":
    case "fs":
    case "fbdr":
    case "ss":
      return "";
    case "eocross":
      return EOCROSS_ROTATION;
    case "xxcross":
      return XXCROSS_PAIR_FRAMES[slot as XXCrossPair].rotation;
    default:
      return XCROSS_SLOT_FRAMES[slot as XCrossSlot].rotation;
  }
}

/** The 2-part engine key for a WASM-backed type (pairing has its own 4-part path; roux slots can't reach here — guarded upstream). */
function twoPartEngineFor(type: "xcross" | "eocross" | "xxcross", slot?: XCrossSlot | XXCrossPair | RouxSsSide) {
  if (type === "eocross") return "eocross" as const;
  if (type === "xcross") return "xcross" as const;
  return XXCROSS_PAIR_FRAMES[slot as XXCrossPair].pairType === "adj" ? ("xxcross-adj" as const) : ("xxcross-opp" as const);
}

/** Everything needed to re-drill the exact same case later — TrainerAttempt satisfies this structurally. */
export interface TrainerRetryTarget {
  type: TrainerType;
  slot?: XCrossSlot | XXCrossPair | RouxSsSide;
  optimalLength: number;
  startCrossState?: number;
  nativeTargetSolution?: string;
  nativeTargetAppl?: string;
  /** Roux types' pin (handled by rouxTrainerService.regenerateRouxForTarget). */
  targetGenerator?: string;
  /** F2L multi-pair drills: all trained slots. */
  slots?: XCrossSlot[];
}

/**
 * Generate a fresh scramble whose target SUB-STATE is exactly a past
 * attempt's — the rest of the cube is newly random, and the path starts
 * from wherever the cube is NOW. Pinning works by fixing C₀'s B (the
 * target-state solution): cross pins the engine state directly; WASM types
 * pin the stored native solution (pairing also its appl companion).
 */
function isRouxFamily(type: TrainerType): type is "fb" | "fs" | "fbdr" | "ss" | "cmll" | "eolr" {
  return type === "fb" || type === "fs" || type === "fbdr" || type === "ss" || type === "cmll" || type === "eolr";
}

export async function regenerateForTarget(target: TrainerRetryTarget, from?: KTransformation): Promise<TrainerScramble> {
  if (isRouxFamily(target.type)) {
    throw new Error("Roux retries are handled by rouxTrainerService.regenerateRouxForTarget");
  }
  const kpuzzle = await cube3x3x3.kpuzzle();
  const fromTransformation = from ?? kpuzzle.identityTransformation();

  if (target.type === "f2l-case") {
    // Virtual case — the stored generator IS the whole thing.
    if (!target.targetGenerator) throw new Error("retry: f2l-case attempt has no stored target generator");
    return {
      type: "f2l-case",
      face: XCROSS_CROSS_FACE,
      slot: target.slot,
      scramble: "",
      optimalLength: 0,
      viewSetupAlg: target.targetGenerator,
      targetGenerator: target.targetGenerator,
    };
  }

  if (target.type === "f2l") {
    // The whole target state is pinned by its generator — recompose the
    // path from wherever the cube is now.
    if (!target.targetGenerator) throw new Error("retry: f2l attempt has no stored target generator");
    const c = invertSequence(tokenize(target.targetGenerator));
    const composed = await composeScramble(kpuzzle, c, fromTransformation);
    if (!composed) throw new Error("Retry scramble generation failed (f2l composition)");
    return {
      type: "f2l",
      face: XCROSS_CROSS_FACE,
      slot: target.slot,
      slots: target.slots,
      optimalLength: 0,
      targetGenerator: target.targetGenerator,
      ...composed,
    };
  }

  if (target.type === "cross-case") {
    // Virtual case, same as f2l-case above — reproduce the exact same
    // cross state, no composition with the physical cube needed.
    if (target.startCrossState === undefined) throw new Error("retry: cross-case attempt has no stored state");
    const engine = await getCrossEngine(XCROSS_CROSS_FACE);
    const x = target.startCrossState;
    const solution = tokenize(engine.firstOptimalSolution(x));
    const generator = invertSequence(solution).join(" ");
    return {
      type: "cross-case",
      face: XCROSS_CROSS_FACE,
      scramble: "",
      optimalLength: engine.distance(x),
      viewSetupAlg: generator,
      targetGenerator: generator,
      startCrossState: x,
    };
  }

  const rot = rotationFor(target.type, target.slot);

  if (target.type === "cross") {
    if (target.startCrossState === undefined) throw new Error("retry: cross attempt has no stored state");
    const engine = await getCrossEngine(XCROSS_CROSS_FACE);
    const x = target.startCrossState;
    const b = tokenize(engine.firstOptimalSolution(x));
    const baseCrossState = engine.stateFromEdgesOrbit(
      kpuzzle.defaultPattern().applyTransformation(fromTransformation).patternData.EDGES
    );
    for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt++) {
      const r = tokenize((await randomScrambleForEvent("333")).toString());
      const a = tokenize(engine.firstOptimalSolution(engine.stateAfter(r)));
      const c = [...b, ...invertSequence(a), ...invertSequence(r)];
      const pattern = kpuzzle.defaultPattern().applyAlg(new Alg(c.join(" "))).applyTransformation(fromTransformation);
      const scramble = (await experimentalSolve3x3x3IgnoringCenters(pattern)).toString().trim();
      const scrambleTokens = tokenize(scramble);
      try {
        // The pinned case must be reproduced EXACTLY, not just at equal depth.
        if (engine.stateAfter(scrambleTokens, baseCrossState) !== x) continue;
      } catch {
        continue;
      }
      return {
        type: "cross",
        face: XCROSS_CROSS_FACE,
        scramble,
        optimalLength: engine.distance(x),
        viewSetupAlg: invertSequence([...scrambleTokens, ...c]).join(" "),
        startCrossState: x,
      };
    }
    throw new Error(`Retry scramble generation failed after ${MAX_GENERATION_RETRIES} attempts`);
  }

  if (!target.nativeTargetSolution) throw new Error("retry: attempt has no stored target solution");
  const pinnedB = tokenize(target.nativeTargetSolution);

  for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt++) {
    const r = tokenize((await randomScrambleForEvent("333")).toString());
    let c0: string[];
    if (target.type === "pair") {
      const res = await pairingFunc(r, 1);
      c0 = [
        ...pinnedB,
        ...invertSequence(tokenize(target.nativeTargetAppl ?? "")),
        ...res.applOfScramble,
        ...invertSequence(res.solutionOfScramble),
        ...invertSequence(r),
      ];
    } else {
      const engine = twoPartEngineFor(target.type, target.slot);
      const { solutionOfScramble: a } = await trainerFunc(engine, r, 1);
      c0 = [...pinnedB, ...invertSequence(a), ...invertSequence(r)];
    }

    // Confirm the pinned target survived the composition at its exact depth.
    const checkLen =
      target.type === "pair"
        ? (await pairingFunc(invertSequence(c0), 1)).solutionOfScramble.length
        : (await trainerFunc(twoPartEngineFor(target.type, target.slot), invertSequence(c0), 1)).solutionOfScramble.length;
    if (checkLen !== target.optimalLength) continue;

    const composed = await composeAndVerify(kpuzzle, c0, rot, fromTransformation);
    if (!composed) continue;

    return {
      type: target.type,
      face: XCROSS_CROSS_FACE,
      slot: target.slot,
      optimalLength: target.optimalLength,
      exampleSolution: conjugateFaceTurns(kpuzzle, pinnedB, rot).join(" "),
      nativeTargetSolution: target.nativeTargetSolution,
      nativeTargetAppl: target.nativeTargetAppl,
      ...composed,
    };
  }
  throw new Error(`Retry scramble generation failed after ${MAX_GENERATION_RETRIES} attempts`);
}

/**
 * First move of AN optimal solution from the cube's CURRENT mid-attempt
 * state — the on-demand hint. Cross answers from the TS engine's exact
 * tables; WASM types re-solve the live state (conjugated into the native
 * frame) with their engine. Returns null when the target is already
 * reached.
 */
export async function optimalNextMove(current: TrainerScramble, movesSoFar: readonly string[]): Promise<string | null> {
  const solutions = await optimalSolutionsFromCurrent(current, movesSoFar, 1);
  return tokenize(solutions[0] ?? "")[0] ?? null;
}

/**
 * Full optimal solution(s) from the cube's CURRENT mid-attempt state — the
 * "reveal solution" feature. Before the first solve move this is the whole
 * attempt's solution. Cross enumerates several from its exact tables; the
 * WASM engines return their single first-found optimal.
 */
export async function optimalSolutionsFromCurrent(
  current: TrainerScramble,
  movesSoFar: readonly string[],
  limit = 5
): Promise<string[]> {
  if (isRouxFamily(current.type)) {
    throw new Error("Roux solutions are handled by rouxTrainerService.rouxOptimalSolutions");
  }
  if (current.type === "f2l" || current.type === "f2l-case") return []; // no solver for these cases — hints are hidden in the UI
  if (current.type === "cross" || current.type === "cross-case") {
    if (current.startCrossState === undefined) return [];
    const engine = await getCrossEngine(current.face);
    const idx = engine.stateAfter(movesSoFar, current.startCrossState);
    if (engine.isSolved(idx)) return [];
    return engine.optimalSolutions(idx, limit);
  }

  const kpuzzle = await cube3x3x3.kpuzzle();
  const rot = rotationFor(current.type, current.slot);
  const stateTokens = [...tokenize(current.viewSetupAlg), ...tokenize(current.scramble), ...movesSoFar];
  const native = conjugateFaceTurns(kpuzzle, stateTokens, invertRotation(rot));
  const solution =
    current.type === "pair"
      ? (await pairingFunc(native, 1)).solutionOfScramble
      : (await trainerFunc(twoPartEngineFor(current.type, current.slot), native, 1)).solutionOfScramble;
  if (solution.length === 0) return [];
  return [conjugateFaceTurns(kpuzzle, solution, rot).join(" ")];
}

import { describe, it, expect } from "bun:test";
import { randomScrambleForEvent } from "cubing/scramble";
import { createSolvedState, applyMoveToState } from "./liveCubeState";
import { lblStageDetector } from "./lblStages";
import { cfopStageDetector } from "./cfopStages";
import { computeStageBoundaries } from "./methodTracker";
import { invertSequence } from "../moveParser";

describe("lblStageDetector — verified against known single-move effects", () => {
  it("all stages solved on the solved state", async () => {
    const solved = await createSolvedState();
    for (const stage of lblStageDetector.stages) {
      expect(lblStageDetector.isStageSolved(stage, solved)).toBe(true);
    }
  });

  it("a single R leaves only the L-face cross intact — cross is still reported solved (face-agnostic, same as CFOP)", async () => {
    const solved = await createSolvedState();
    const state = applyMoveToState(solved, "R");
    expect(lblStageDetector.isStageSolved("cross", state)).toBe(true);
  });

  it("second-layer done is the exact same cube state CFOP calls f2l-4 — both detectors agree", async () => {
    const solved = await createSolvedState();
    // D turn: leaves U's cross/first-layer/second-layer (and therefore CFOP's f2l-4) fully intact.
    const state = applyMoveToState(solved, "D");
    expect(lblStageDetector.isStageSolved("first-layer-4", state)).toBe(true);
    expect(lblStageDetector.isStageSolved("second-layer-4", state)).toBe(true);
    expect(cfopStageDetector.isStageSolved("f2l-4", state)).toBe(true);
  });

  it("a single U: cross/first-layer/second-layer solved relative to D, PLL AUF-tolerant, AUF itself not yet", async () => {
    const solved = await createSolvedState();
    const state = applyMoveToState(solved, "U");
    expect(lblStageDetector.isStageSolved("cross", state)).toBe(true);
    expect(lblStageDetector.isStageSolved("first-layer-4", state)).toBe(true);
    expect(lblStageDetector.isStageSolved("second-layer-4", state)).toBe(true);
    expect(lblStageDetector.isStageSolved("oll", state)).toBe(true); // U/D turns preserve orientation
    expect(lblStageDetector.isStageSolved("pll", state)).toBe(true); // AUF-tolerant
    expect(lblStageDetector.isStageSolved("auf", state)).toBe(false); // not literally solved yet
  });

  it("first-layer corners are tracked by COUNT, order-flexible — with cross locked on U, a single L leaves exactly 2 of U's 4 corners still solved", async () => {
    const solved = await createSolvedState();
    const context = lblStageDetector.createContext!();
    const crossOnU = applyMoveToState(solved, "D");
    expect(lblStageDetector.isStageSolved("cross", crossOnU, context)).toBe(true);

    const state = applyMoveToState(crossOnU, "L");
    expect(lblStageDetector.isStageSolved("first-layer-1", state, context)).toBe(true);
    expect(lblStageDetector.isStageSolved("first-layer-2", state, context)).toBe(true);
    expect(lblStageDetector.isStageSolved("first-layer-3", state, context)).toBe(false);
    expect(lblStageDetector.isStageSolved("first-layer-4", state, context)).toBe(false);
  });

  it("oll-partial is order-flexible: corners-oriented-first (M leaves D's edges flipped, corners untouched, cross locked on U) reports oll-partial without full oll", async () => {
    const solved = await createSolvedState();
    const context = lblStageDetector.createContext!();
    const crossOnU = applyMoveToState(solved, "D");
    expect(lblStageDetector.isStageSolved("cross", crossOnU, context)).toBe(true);

    const state = applyMoveToState(crossOnU, "M");
    expect(lblStageDetector.isStageSolved("oll-partial", state, context)).toBe(true);
    expect(lblStageDetector.isStageSolved("oll", state, context)).toBe(false);
  });

  it("oll-partial is order-flexible: edges-oriented-first (Sune leaves U's corners twisted, edges untouched, cross locked on D) reports oll-partial without full oll", async () => {
    const solved = await createSolvedState();
    const context = lblStageDetector.createContext!();
    const crossOnD = applyMoveToState(solved, "U");
    expect(lblStageDetector.isStageSolved("cross", crossOnD, context)).toBe(true);

    const state = "R U R' U R U2 R'".split(" ").reduce((s, m) => applyMoveToState(s, m), crossOnD);
    expect(lblStageDetector.isStageSolved("oll-partial", state, context)).toBe(true);
    expect(lblStageDetector.isStageSolved("oll", state, context)).toBe(false);
  });

  it("pll-corners fires once corners are permuted (up to AUF) even with edges still scrambled — a pure-edge algorithm (Ua-perm) leaves corners untouched", async () => {
    const solved = await createSolvedState();
    const context = lblStageDetector.createContext!();
    const crossOnD = applyMoveToState(solved, "U");
    expect(lblStageDetector.isStageSolved("cross", crossOnD, context)).toBe(true);

    const state = "R U' R U R U R U' R' U' R2".split(" ").reduce((s, m) => applyMoveToState(s, m), crossOnD);
    expect(lblStageDetector.isStageSolved("pll-corners", state, context)).toBe(true);
    expect(lblStageDetector.isStageSolved("pll", state, context)).toBe(false);
  });
});

describe("computeStageBoundaries — LBL", () => {
  it("walks a full scramble->solve sequence and records all LBL stages in order, ending at the last move", async () => {
    const scramble = (await randomScrambleForEvent("333")).toString().trim().split(/\s+/);
    const solution = invertSequence(scramble);
    const scrambled = scramble.reduce((state, move) => applyMoveToState(state, move), await createSolvedState());

    const moves = solution.map((move, i) => ({ move, relativeMs: i * 100 }));
    const boundaries = computeStageBoundaries(lblStageDetector, moves, scrambled);

    expect(boundaries.map((b) => b.stage)).toEqual([...lblStageDetector.stages]);
    expect(boundaries[boundaries.length - 1].moveIndex).toBeLessThanOrEqual(solution.length - 1);
    for (let i = 1; i < boundaries.length; i++) {
      expect(boundaries[i].moveIndex).toBeGreaterThanOrEqual(boundaries[i - 1].moveIndex);
    }
  });

  it("locks its cross face once, same drift protection as CFOP (see methodTracker.test.ts's equivalent CFOP case)", async () => {
    const solved = await createSolvedState();
    const context = lblStageDetector.createContext!();

    const crossOnU = applyMoveToState(solved, "D");
    expect(lblStageDetector.isStageSolved("cross", crossOnU, context)).toBe(true);

    // A state where the first layer is complete on R (via a single L turn)
    // but NOT on U — fed through the same, already-locked context, this
    // must still evaluate against the locked "U", reading false.
    const firstLayerOnR = applyMoveToState(solved, "L");
    expect(lblStageDetector.isStageSolved("first-layer-4", firstLayerOnR, context)).toBe(false);
  });
});

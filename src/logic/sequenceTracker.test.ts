import { describe, it, expect } from "bun:test";
import { buildSequenceTarget, computeSequenceProgress } from "./sequenceTracker";

describe("computeSequenceProgress — basic matching", () => {
  it("tracks a clean, exact match through to completion", () => {
    const target = buildSequenceTarget("R U R' U'");
    const progress = computeSequenceProgress(target, ["R", "U", "R'", "U'"]);
    expect(progress).toEqual({
      completedIndices: [0, 1, 2, 3],
      completedCount: 4,
      nextIndex: null,
      startedIndices: [],
      isCompleted: true,
      hadErrors: false,
      correctionSequence: [],
      startedCorrectionSequence: [],
    });
  });

  it("this same function is used for scrambles too — no special-casing needed", () => {
    // A "scramble" is just another target sequence.
    const target = buildSequenceTarget("R U2 F' L D2");
    const progress = computeSequenceProgress(target, ["R", "U", "U", "F'", "L", "D", "D"]);
    expect(progress.isCompleted).toBe(true);
    expect(progress.hadErrors).toBe(false);
  });

  it("reports partial progress mid-sequence without flagging an error", () => {
    const target = buildSequenceTarget("R U R' U'");
    const progress = computeSequenceProgress(target, ["R", "U"]);
    expect(progress.completedIndices).toEqual([0, 1]);
    expect(progress.isCompleted).toBe(false);
    expect(progress.hadErrors).toBe(false);
    expect(progress.nextIndex).toBe(2);
  });
});

describe("computeSequenceProgress — R2 as two physical quarter turns", () => {
  it("two consecutive R quarter-turns satisfy a target R2", () => {
    const target = buildSequenceTarget("R2");
    const progress = computeSequenceProgress(target, ["R", "R"]);
    expect(progress.isCompleted).toBe(true);
    expect(progress.hadErrors).toBe(false);
  });

  it("a single R is only a partial match for R2, not an error", () => {
    const target = buildSequenceTarget("R2");
    const progress = computeSequenceProgress(target, ["R"]);
    expect(progress.isCompleted).toBe(false);
    expect(progress.hadErrors).toBe(false);
    expect(progress.startedIndices).toEqual([0]);
  });
});

describe("computeSequenceProgress — wrong move + repair", () => {
  it("flags an uncorrected wrong move and gives the correction sequence", () => {
    const target = buildSequenceTarget("R");
    const progress = computeSequenceProgress(target, ["F"]);
    expect(progress.isCompleted).toBe(false);
    expect(progress.hadErrors).toBe(true);
    expect(progress.correctionSequence).toEqual(["F'"]);
    expect(progress.nextIndex).toBeNull();
  });

  it("clears the correction sequence once the wrong move is undone, but the sequence still reaches completion", () => {
    const target = buildSequenceTarget("R U");
    const progress = computeSequenceProgress(target, ["F", "F'", "R", "U"]);
    expect(progress.isCompleted).toBe(true);
    expect(progress.correctionSequence).toEqual([]);
  });

  it("records that an error occurred at some point, even though it was fully corrected — key requirement", () => {
    const target = buildSequenceTarget("R U");
    const progress = computeSequenceProgress(target, ["F", "F'", "R", "U"]);
    expect(progress.hadErrors).toBe(true);
  });

  it("collapses wrong moves across a commuting opposite face: L R L reads as L2 R, correction is 2 moves", () => {
    const target = buildSequenceTarget("U");
    const progress = computeSequenceProgress(target, ["L", "R", "L"]);
    // L and R commute, so L R L ≡ L2 R — the repair must not ask for L' R' L'.
    expect(progress.correctionSequence).toEqual(["R'", "L2"]);
  });

  it("accepts opposite-face corrections in ANY order: R' first…", () => {
    const target = buildSequenceTarget("U");
    const wrong = ["L", "R", "L"];
    const afterR = computeSequenceProgress(target, [...wrong, "R'"]);
    expect(afterR.correctionSequence).toEqual(["L2"]);
    const done = computeSequenceProgress(target, [...wrong, "R'", "L2", "U"]);
    expect(done.isCompleted).toBe(true);
    expect(done.correctionSequence).toEqual([]);
  });

  it("…or L2 first…", () => {
    const target = buildSequenceTarget("U");
    const afterL2 = computeSequenceProgress(target, ["L", "R", "L", "L2"]);
    expect(afterL2.correctionSequence).toEqual(["R'"]);
    const done = computeSequenceProgress(target, ["L", "R", "L", "L2", "R'", "U"]);
    expect(done.isCompleted).toBe(true);
  });

  it("…or interleaved L' R' L' quarter turns", () => {
    const target = buildSequenceTarget("U");
    const done = computeSequenceProgress(target, ["L", "R", "L", "L'", "R'", "L'", "U"]);
    expect(done.isCompleted).toBe(true);
    expect(done.correctionSequence).toEqual([]);
  });

  it("a clean solve without any wrong move never sets hadErrors", () => {
    const target = buildSequenceTarget("R U");
    const progress = computeSequenceProgress(target, ["R", "U"]);
    expect(progress.hadErrors).toBe(false);
  });
});

describe("computeSequenceProgress — adjacent opposite-face reordering", () => {
  it("accepts L then R for a target of R then L (opposite faces commute when adjacent)", () => {
    const target = buildSequenceTarget("R L");
    const progress = computeSequenceProgress(target, ["L", "R"]);
    expect(progress.isCompleted).toBe(true);
    expect(progress.hadErrors).toBe(false);
    expect(progress.completedIndices).toEqual([0, 1]);
  });

  it("does NOT tolerate reordering across an unrelated move in between", () => {
    // Target "R U L": R and L are not adjacent (U sits between them), so they
    // form separate blocks — doing L before R here is a real wrong move.
    const target = buildSequenceTarget("R U L");
    const progress = computeSequenceProgress(target, ["L"]);
    expect(progress.hadErrors).toBe(true);
    expect(progress.completedIndices).toEqual([]);
  });
});

describe("computeSequenceProgress — rotations and slice/wide moves", () => {
  it("auto-completes a pure rotation token once its following physical move is done", () => {
    const target = buildSequenceTarget("x R");
    const progress = computeSequenceProgress(target, ["R"]);
    expect(progress.isCompleted).toBe(true);
    expect(progress.completedIndices).toEqual([0, 1]); // token 0 = "x" (auto), token 1 = "R"
  });

  it("a slice move (M) is satisfied by its two physical parts and counts as ONE completed token", () => {
    const target = buildSequenceTarget("M");
    const progress = computeSequenceProgress(target, ["R", "L'"]);
    expect(progress.isCompleted).toBe(true);
    expect(progress.completedCount).toBe(1); // not 2, even though M decomposes into 2 physical moves
    expect(progress.completedIndices).toEqual([0]);
  });

  it("a wide move (r) is satisfied by its single physical part (opposite face) + implicit rotation", () => {
    const target = buildSequenceTarget("r");
    const progress = computeSequenceProgress(target, ["L"]);
    expect(progress.isCompleted).toBe(true);
    expect(progress.completedCount).toBe(1);
  });
});

describe("computeSequenceProgress — edge cases", () => {
  it("an empty target is immediately complete", () => {
    const target = buildSequenceTarget("");
    const progress = computeSequenceProgress(target, []);
    expect(progress.isCompleted).toBe(true);
    expect(progress.hadErrors).toBe(false);
  });

  it("no moves yet against a non-empty target is not complete and not an error", () => {
    const target = buildSequenceTarget("R U");
    const progress = computeSequenceProgress(target, []);
    expect(progress.isCompleted).toBe(false);
    expect(progress.hadErrors).toBe(false);
    expect(progress.completedIndices).toEqual([]);
  });
});

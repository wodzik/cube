import { describe, it, expect } from "bun:test";
import { collapseIdenticalMoves, collapseToStm, areOppositeFaces } from "./moveReduction";

describe("areOppositeFaces", () => {
  it("identifies opposite face pairs", () => {
    expect(areOppositeFaces("R", "L")).toBe(true);
    expect(areOppositeFaces("U", "D")).toBe(true);
    expect(areOppositeFaces("F", "B")).toBe(true);
    expect(areOppositeFaces("R", "U")).toBe(false);
  });
});

describe("collapseIdenticalMoves", () => {
  it("merges an identical repeated move into a double", () => {
    expect(collapseIdenticalMoves(["R", "R"])).toEqual(["R2"]);
    expect(collapseIdenticalMoves(["U", "U"])).toEqual(["U2"]);
  });

  it("does NOT merge or cancel a move followed by its inverse — the key requirement", () => {
    // R then R' are two distinct physical turns in a real solve, not a mistake.
    expect(collapseIdenticalMoves(["R", "R'"])).toEqual(["R", "R'"]);
    expect(collapseIdenticalMoves(["U'", "U"])).toEqual(["U'", "U"]);
  });

  it("merges a run of 3 identical moves into the single-quarter equivalent", () => {
    expect(collapseIdenticalMoves(["R", "R", "R"])).toEqual(["R'"]);
  });

  it("merges a run of 4 identical moves into nothing (full turn, net zero)", () => {
    expect(collapseIdenticalMoves(["R", "R", "R", "R"])).toEqual([]);
  });

  it("does not merge non-adjacent identical moves", () => {
    expect(collapseIdenticalMoves(["R", "U", "R"])).toEqual(["R", "U", "R"]);
  });

  it("does not merge same-face-different-direction runs beyond a broken chain", () => {
    // R,R,R' : run of "R" (len 2) -> R2, then separate "R'" run (len 1) -> R'
    expect(collapseIdenticalMoves(["R", "R", "R'"])).toEqual(["R2", "R'"]);
  });

  it("handles a realistic mixed solve fragment", () => {
    expect(collapseIdenticalMoves(["R", "U", "R", "R", "U'", "R'"]))
      .toEqual(["R", "U", "R2", "U'", "R'"]);
  });

  it("handles rotations like any other token", () => {
    expect(collapseIdenticalMoves(["x", "x"])).toEqual(["x2"]);
    expect(collapseIdenticalMoves(["x", "x'"])).toEqual(["x", "x'"]);
  });

  it("handles empty and single move", () => {
    expect(collapseIdenticalMoves([])).toEqual([]);
    expect(collapseIdenticalMoves(["R"])).toEqual(["R"]);
  });
});

describe("collapseToStm", () => {
  it("merges opposite-face complementary pairs into slices (both orders)", () => {
    expect(collapseToStm(["R", "L'"])).toEqual(["M"]);
    expect(collapseToStm(["L'", "R"])).toEqual(["M"]);
    expect(collapseToStm(["R'", "L"])).toEqual(["M'"]);
    expect(collapseToStm(["R2", "L2"])).toEqual(["M2"]);
    expect(collapseToStm(["U", "D'"])).toEqual(["E"]);
    expect(collapseToStm(["B", "F'"])).toEqual(["S"]);
  });

  it("leaves non-complementary and non-opposite pairs alone", () => {
    expect(collapseToStm(["R", "L"])).toEqual(["R", "L"]);
    expect(collapseToStm(["R", "U'"])).toEqual(["R", "U'"]);
    expect(collapseToStm(["R", "R'"])).toEqual(["R", "R'"]);
  });

  it("collapses identical runs first, then slices, then adjacent identical slices", () => {
    expect(collapseToStm(["R", "R", "L2"])).toEqual(["M2"]);
    expect(collapseToStm(["R", "L'", "R", "L'"])).toEqual(["M2"]);
  });

  it("counts a realistic Roux LSE fragment fairly", () => {
    // physical M' U M (M' reported as R'+L, M as R+L')
    expect(collapseToStm(["R'", "L", "U", "R", "L'"])).toEqual(["M'", "U", "M"]);
  });
});

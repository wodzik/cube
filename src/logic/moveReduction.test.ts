import { describe, it, expect } from "bun:test";
import { reduceMoves, simplifyMoveStack, collapseIdenticalMoves, areOppositeFaces } from "./moveReduction";

describe("areOppositeFaces", () => {
  it("identifies opposite face pairs", () => {
    expect(areOppositeFaces("R", "L")).toBe(true);
    expect(areOppositeFaces("U", "D")).toBe(true);
    expect(areOppositeFaces("F", "B")).toBe(true);
    expect(areOppositeFaces("R", "U")).toBe(false);
  });
});

describe("reduceMoves", () => {
  it("combines same face consecutive moves", () => {
    expect(reduceMoves(["R", "R"])).toEqual(["R2"]);
    expect(reduceMoves(["R", "R'"])).toEqual([]);
    expect(reduceMoves(["R", "R", "R"])).toEqual(["R'"]);
    expect(reduceMoves(["R", "R", "R", "R"])).toEqual([]);
  });

  it("combines moves on opposite faces (swap allowed)", () => {
    // R L R: R and L commute, so R L R = R R L = R2 L = L R2
    expect(reduceMoves(["R", "L", "R"])).toEqual(["L", "R2"]);
    expect(reduceMoves(["R", "L", "R'"])).toEqual(["L"]);
    expect(reduceMoves(["R", "L", "L", "R"])).toEqual(["L2", "R2"]);
  });

  it("does not combine moves on non-opposite faces", () => {
    expect(reduceMoves(["R", "U", "R"])).toEqual(["R", "U", "R"]);
    expect(reduceMoves(["R", "F", "R"])).toEqual(["R", "F", "R"]);
  });

  it("handles multiple reductions", () => {
    expect(reduceMoves(["R", "R", "L", "R"])).toEqual(["L", "R'"]);
    expect(reduceMoves(["R", "L", "R", "L"])).toEqual(["R2", "L2"]);
  });

  it("handles complex sequences", () => {
    expect(reduceMoves(["R", "U", "R'", "U'"])).toEqual(["R", "U", "R'", "U'"]);
    expect(reduceMoves(["R", "L", "R", "L", "R", "L"])).toEqual(["R'", "L'"]);
  });

  it("removes invalid moves", () => {
    expect(reduceMoves(["R", "Q", "R"])).toEqual(["R2"]);
  });

  it("handles rotations", () => {
    expect(reduceMoves(["R", "X", "R"])).toEqual(["R", "x", "R"]);
    expect(reduceMoves(["x", "x"])).toEqual(["x2"]);
    expect(reduceMoves(["x", "x'"])).toEqual([]);
  });

  it("handles empty and single move", () => {
    expect(reduceMoves([])).toEqual([]);
    expect(reduceMoves(["R"])).toEqual(["R"]);
  });
});

describe("simplifyMoveStack", () => {
  it("combines consecutive same-face moves", () => {
    expect(simplifyMoveStack(["R", "R"])).toEqual(["R2"]);
    expect(simplifyMoveStack(["R", "R'"])).toEqual([]);
    expect(simplifyMoveStack(["R", "R", "R"])).toEqual(["R'"]);
    expect(simplifyMoveStack(["R", "R", "R", "R"])).toEqual([]);
  });

  it("does NOT reorder opposite faces (unlike reduceMoves)", () => {
    expect(simplifyMoveStack(["R", "L", "R"])).toEqual(["R", "L", "R"]);
    expect(simplifyMoveStack(["R", "L", "R'"])).toEqual(["R", "L", "R'"]);
  });

  it("cancels moves separated by other faces", () => {
    expect(simplifyMoveStack(["R", "U", "U'"])).toEqual(["R"]);
    expect(simplifyMoveStack(["R", "F", "F'"])).toEqual(["R"]);
  });

  it("preserves order for error stacks", () => {
    expect(simplifyMoveStack(["R", "F", "R"])).toEqual(["R", "F", "R"]);
    expect(simplifyMoveStack(["R", "U", "R'", "U'"])).toEqual(["R", "U", "R'", "U'"]);
  });

  it("handles empty and single move", () => {
    expect(simplifyMoveStack([])).toEqual([]);
    expect(simplifyMoveStack(["R"])).toEqual(["R"]);
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

  it("this is the behavior difference vs simplifyMoveStack/reduceMoves", () => {
    expect(simplifyMoveStack(["R", "R'"])).toEqual([]);
    expect(reduceMoves(["R", "R'"])).toEqual([]);
    expect(collapseIdenticalMoves(["R", "R'"])).toEqual(["R", "R'"]);
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

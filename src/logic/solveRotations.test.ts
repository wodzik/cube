import { describe, expect, it } from "bun:test";
import { IDENTITY_GRIP, gripOf, heldMove, rotateGrip } from "@wodzik/cubecore/bluetooth";
import { heldDisplay, heldTokens, rotationCount } from "./solveRotations";

const moves = (s: string) => s.split(" ").map((move, i) => ({ move, timestamp: 1000 + i * 100, relativeMs: i * 100, phase: "active" as const }));

describe("solve rotations", () => {
  it("re-letters moves for the grip", () => {
    const orangeFront = gripOf("U", "L");
    expect(heldMove("L", orangeFront)).toBe("F");
    expect(heldMove("F'", orangeFront)).toBe("R'");
    expect(heldMove("U2", orangeFront)).toBe("U2");
  });

  it("shows the solve as seen, rotations combined", () => {
    // Orange in front: L L, then y y (red in front): R is its F.
    const record = { moves: moves("L L R U"), startRotation: "y'", rotations: [{ after: 2, t: 150, move: "y" }, { after: 2, t: 160, move: "y" }] };
    const tokens = heldTokens(record)!;
    expect(tokens.map((t) => t.move)).toEqual(["F", "F", "y2", "F", "U"]);
    expect(heldDisplay(tokens, 0, 3)).toEqual(["F2", "y2", "F", "U"]);
    expect(heldDisplay(tokens, 2, 3)).toEqual(["y2", "F", "U"]);
    expect(rotationCount(tokens)).toBe(1);
    expect(rotateGrip(IDENTITY_GRIP, "y' y2").face.F).toBe("R");
  });

  it("drops rotations that cancel and leaves old solves alone", () => {
    const tokens = heldTokens({ moves: moves("R U"), startRotation: "", rotations: [{ after: 1, t: 50, move: "y" }, { after: 1, t: 60, move: "y'" }] })!;
    expect(tokens.map((t) => t.move)).toEqual(["R", "U"]);
    expect(heldTokens({ moves: moves("R") })).toBeNull();
  });

  it("a slice or wide move (face moves + the core turning) is one move", () => {
    const at = (list: [string, number][]) => list.map(([move, t]) => ({ move, timestamp: 1000 + t, relativeMs: t, phase: "active" as const }));
    const s = heldTokens({ moves: at([["R", 0], ["F'", 500], ["B", 520], ["U", 900]]), startRotation: "", rotations: [{ after: 2, t: 530, move: "z" }] })!;
    // After S the centres moved: the white face (physical U) is on the right now.
    expect(s.map((t) => t.move)).toEqual(["R", "S", "R"]);
    expect(rotationCount(s)).toBe(0);
    const r = heldTokens({ moves: at([["L", 0], ["U", 400]]), startRotation: "", rotations: [{ after: 0, t: 20, move: "x" }] })!;
    expect(r.map((t) => t.move)).toEqual(["r", "B"]); // the white face went to the back
    // A rotation well apart from the moves stays one.
    const y = heldTokens({ moves: at([["D", 0], ["R", 1500]]), startRotation: "", rotations: [{ after: 1, t: 800, move: "y" }] })!;
    expect(y.map((t) => t.move)).toEqual(["D", "y", "F"]);
  });

  it("a slice's rotation reported a couple of moves late still makes the slice", () => {
    const at = (list: [string, number][]) => list.map(([move, t]) => ({ move, timestamp: 1000 + t, relativeMs: t, phase: "active" as const }));
    // F' B (the S), then U and L — the z came in after them.
    const s = heldTokens({ moves: at([["F'", 0], ["B", 20], ["U", 150], ["L", 300]]), startRotation: "", rotations: [{ after: 4, t: 350, move: "z" }] })!;
    // After the S the white face (physical U) is on the right, orange (L) on top.
    expect(s.map((t) => t.move)).toEqual(["S", "R", "U"]);
  });

  it("counts only y rotations (regrips) — x and z are part of algorithms", () => {
    const at = (list: [string, number][]) => list.map(([move, t]) => ({ move, timestamp: 1000 + t, relativeMs: t, phase: "active" as const }));
    const tokens = heldTokens({
      moves: at([["R", 0], ["U", 2000], ["F", 4000], ["D", 6000]]),
      startRotation: "",
      rotations: [
        { after: 1, t: 1000, move: "x" },
        { after: 2, t: 3000, move: "y" },
        { after: 3, t: 5000, move: "z'" },
      ],
    })!;
    expect(tokens.filter((t) => t.kind === "rotation").map((t) => t.move)).toEqual(["x", "y", "z'"]);
    expect(rotationCount(tokens)).toBe(1);
  });

  it("M2 done as two quarters (R' L R' L and the core's x2) is one M2 — also when the x2 comes in late", () => {
    const at = (list: [string, number][]) => list.map(([move, t]) => ({ move, timestamp: 1000 + t, relativeMs: t, phase: "active" as const }));
    const quarters: [string, number][] = [["R'", 0], ["L", 40], ["R'", 110], ["L", 150]];
    const on = heldTokens({ moves: at([...quarters, ["U", 800]]), startRotation: "", rotations: [{ after: 4, t: 200, move: "x2" }] })!;
    expect(on.map((t) => t.move)).toEqual(["M2", "D"]);
    expect(rotationCount(on)).toBe(0);
    const late = heldTokens({ moves: at([...quarters, ["U", 230], ["F", 300]]), startRotation: "", rotations: [{ after: 6, t: 320, move: "x2" }] })!;
    expect(late.map((t) => t.move)).toEqual(["M2", "D", "B"]);
  });

  it("a slice's rotation that came in a second late, after the next move (L R' … pause … F' x), is still the M'", () => {
    const at = (list: [string, number][]) => list.map(([move, t]) => ({ move, timestamp: 1000 + t, relativeMs: t, phase: "active" as const }));
    const s = heldTokens({ moves: at([["U'", 0], ["L", 300], ["R'", 340], ["F'", 1600], ["R'", 1800]]), startRotation: "", rotations: [{ after: 4, t: 1700, move: "x" }] })!;
    // M' happened with L R' (the centres turned like x): the F' after it was on what's now the top.
    expect(s.map((t) => t.move)).toEqual(["U'", "M'", "U'", "R'"]);
    expect(rotationCount(s)).toBe(0);
  });

  it("one face and a rotation far apart stay a face turn and a rotation (a real regrip)", () => {
    const at = (list: [string, number][]) => list.map(([move, t]) => ({ move, timestamp: 1000 + t, relativeMs: t, phase: "active" as const }));
    const s = heldTokens({ moves: at([["R'", 0], ["U", 1500]]), startRotation: "", rotations: [{ after: 1, t: 1200, move: "x" }] })!;
    expect(s.map((t) => t.move)).toEqual(["R'", "x", "B"]);
  });
});

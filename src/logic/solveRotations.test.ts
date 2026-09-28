import { describe, expect, it } from "bun:test";
import { IDENTITY_GRIP, gripOf, rotateGrip } from "./grip";
import { heldDisplay, heldMove, heldTokens, recordRotations, rotationCount } from "./solveRotations";

const moves = (s: string) => s.split(" ").map((move, i) => ({ move, timestamp: 1000 + i * 100, relativeMs: i * 100, phase: "active" as const }));

describe("solve rotations", () => {
  it("re-letters moves for the grip", () => {
    const orangeFront = gripOf("U", "L");
    expect(heldMove("L", orangeFront)).toBe("F");
    expect(heldMove("F'", orangeFront)).toBe("R'");
    expect(heldMove("U2", orangeFront)).toBe("U2");
  });

  it("records the start grip and when each rotation came", () => {
    const r = recordRotations(gripOf("U", "L"), [{ at: 1150, rotation: "y" }], [1000, 1100, 1200], 1000);
    expect(r.startRotation).toBe("y'");
    expect(r.rotations).toEqual([{ after: 2, t: 150, move: "y" }]);
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
});

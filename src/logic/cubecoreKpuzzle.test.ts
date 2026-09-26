import { describe, expect, it } from "bun:test";
import { cube3x3x3 } from "cubing/puzzles";
import { applyMoves, solvedState } from "@cubecore/core";
import { stateToKTransformation } from "./cubecoreKpuzzle";

describe("stateToKTransformation", () => {
  it("matches cubing.js for the same moves (edges and corners)", async () => {
    const kp = await cube3x3x3.kpuzzle();
    for (const alg of ["R", "U", "F", "D", "L", "B", "R U R' U'", "F2 D' L B2 R' U2 F L' D B'", "B L2 D' R F' U2 L B D2 R'"]) {
      const want = kp.identityTransformation().applyAlg(alg).transformationData;
      const got = stateToKTransformation(kp, applyMoves(solvedState(), alg)).transformationData;
      expect({ alg, e: got.EDGES, c: got.CORNERS }).toEqual({ alg, e: want.EDGES, c: want.CORNERS });
    }
  });
});

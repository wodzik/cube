/**
 * Stage detection must not care which face the solve was on: the same solve
 * turned as a whole (any of the 24 orientations — a cross on red, on
 * orange, on yellow…) must find every stage at the same move.
 */
import { describe, expect, it } from "bun:test";
import { FRAMES, formatAlg, invert, parseAlg, transformMoves } from "@wodzik/cubecore/core";
import { applyMoveToState, createSolvedState } from "./liveCubeState";
import { computeStageBoundaries } from "./methodTracker";
import { cfopStageDetector } from "./cfopStages";
import { lblStageDetector } from "./lblStages";
import { rouxStageDetector } from "./rouxStages";
import { isOllSolvedOnFace } from "./lastLayerShared";

// A white-cross (D) CFOP solve, stage by stage (face turns only — as a smart cube reports them).
const SEGMENTS = [
  "D R' F R D2", // cross (whatever it takes from this scramble)
  "U R U' R'",
  "U' L' U L",
  "U2 F' U F",
  "U B U' B'",
  "R U2 R2 F R F' U2 R' F R F'", // OLL
  "R U R' U' R' F R2 U' R' U' R U R' F'", // PLL (T)
  "U2",
];

async function boundaries(detector: typeof cfopStageDetector, frameId: number) {
  const frame = FRAMES[frameId];
  const solution = transformMoves(parseAlg(SEGMENTS.join(" ")), frame);
  const scramble = invert(solution);
  let start = await createSolvedState();
  for (const m of formatAlg(scramble).split(" ")) start = applyMoveToState(start, m);
  const moves = formatAlg(solution)
    .split(" ")
    .map((move, i) => ({ move, relativeMs: i * 100 }));
  return computeStageBoundaries(detector, moves, start).map((b) => `${b.stage}@${b.moveIndex}`);
}

describe("stages are found the same whatever face the solve is on", () => {
  for (const detector of [cfopStageDetector, lblStageDetector, rouxStageDetector]) {
    it(`${detector.method}: all 24 orientations`, async () => {
      const reference = await boundaries(detector, 0);
      if (detector !== rouxStageDetector) expect(reference.some((s) => s.startsWith("oll"))).toBe(true);
      for (let f = 1; f < FRAMES.length; f++) {
        expect(`frame ${f}: ${(await boundaries(detector, f)).join(" ")}`).toBe(`frame ${f}: ${reference.join(" ")}`);
      }
    });
  }
});

describe("OLL by stickers", () => {
  it("an oriented last layer on each face (and not yet oriented) — for every face as the cross", async () => {
    const OLL = parseAlg("R U2 R2 F R F' U2 R' F R F'");
    for (const frame of FRAMES) {
      const cross = frame.face.D;
      // Solved, then the OLL undone (last layer not oriented), then done again.
      let s = await createSolvedState();
      for (const m of formatAlg(invert(transformMoves(OLL, frame))).split(" ")) s = applyMoveToState(s, m);
      expect(`${frame.id} ${isOllSolvedOnFace(s, cross as "U")}`).toBe(`${frame.id} false`);
      for (const m of formatAlg(transformMoves(OLL, frame)).split(" ")) s = applyMoveToState(s, m);
      expect(`${frame.id} ${isOllSolvedOnFace(s, cross as "U")}`).toBe(`${frame.id} true`);
      // A last-layer turn keeps it oriented.
      expect(isOllSolvedOnFace(applyMoveToState(s, frame.face.U), cross as "U")).toBe(true);
    }
  });
});

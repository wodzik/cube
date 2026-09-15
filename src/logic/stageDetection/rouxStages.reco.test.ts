/**
 * Replays real Roux reconstructions from reco.nz through rouxStageDetector
 * exactly the way a smart cube would report them: rotations are NOT logged
 * (they only shift the hardware frame), and slice/wide moves arrive as
 * outer-layer face events (M -> R L' etc.) — see algToPhysicalMoves. The
 * detected stage boundary must land inside the reconstruction's own
 * annotated stage line.
 */

import { describe, it, expect } from "bun:test";
import { algToPhysicalMoves, createMoveStr } from "../moveParser";
import { applyMoveToState, createSolvedState } from "./liveCubeState";
import { computeStageBoundaries } from "./methodTracker";
import { rouxStageDetector } from "./rouxStages";

interface RecoSolve {
  id: number;
  scramble: string;
  /** Annotated lines in order. Roux detector stages map: FB -> fb, last SB line -> sb, CMLL -> cmll, last line -> lse. */
  lines: { alg: string; stage: "inspection" | "fb" | "sb" | "cmll" | "lse" }[];
}

const SOLVES: RecoSolve[] = [
  {
    id: 12811,
    scramble: "F D L' D2 F2 R' F' R2 U' L2 F2 B2 D2 F2 L2 F' L' B2",
    lines: [
      { alg: "y x'", stage: "inspection" },
      { alg: "U2' B2 U' B M2' U' F", stage: "fb" },
      { alg: "R' M' U' R' U R U2 R U'", stage: "sb" },
      { alg: "R' R' U R U R' U R U' R' U R", stage: "sb" },
      { alg: "U U' R' U2 R' D' R U2 R' D R2", stage: "cmll" },
      { alg: "U M' U M' U2 M U2 M'", stage: "lse" },
      { alg: "U' M' U2 M2' U2 M", stage: "lse" },
    ],
  },
  {
    id: 12896,
    scramble: "L2 R2 D2 L2 D R2 B2 U F2 D L B F U' R2 B L2 U2 B2 L' U",
    lines: [
      { alg: "z x", stage: "inspection" },
      { alg: "D x' R U F' u U2' r F'", stage: "fb" },
      { alg: "U' M' U R U' R2 U' R' U' M' R' U R2", stage: "sb" },
      { alg: "U2' R' U R U' R'", stage: "sb" },
      { alg: "R U R' U R U' R' U R U' R' U R U2' R'", stage: "cmll" },
      { alg: "U M' U2 M", stage: "lse" },
      { alg: "U' M' U2 M2' U2 M' U", stage: "lse" },
    ],
  },
  {
    id: 12842,
    scramble: "D2 B2 D' L2 U B R' B2 R2 D2 B' U2 L2 D2 B' D L2 U2 L'",
    lines: [
      { alg: "x' z'", stage: "inspection" },
      { alg: "R' F R F2 U' D' U' R U' B", stage: "fb" },
      { alg: "R U' R' U R U' R' U r", stage: "sb" },
      { alg: "M' U' R U R' U R U' r'", stage: "sb" },
      { alg: "U r' D' r U r' D r U' r U r'", stage: "cmll" },
      { alg: "M U U' M' M' U M U M' U M U' M U2 M' U M' M'", stage: "lse" },
      { alg: "U' R r' U2 M U2 M2'", stage: "lse" },
    ],
  },
  {
    id: 12839,
    scramble: "L2 R2 D L2 F2 D2 B2 D2 R2 B2 R B2 D F R2 D' R2 B2 F'",
    lines: [
      { alg: "M' r D U F U' F2", stage: "fb" },
      { alg: "U' R' U2' R U' R' U' R", stage: "sb" },
      { alg: "U' M2' U' r U' r'", stage: "sb" },
      { alg: "U' r U' r2' D' r U2 r' D r2 U r'", stage: "cmll" },
      { alg: "U2 M' U' M' U' M U M' U2 M2'", stage: "lse" },
      { alg: "U' M U2 M2' U2 M' U2", stage: "lse" },
    ],
  },
];

async function replay(solve: RecoSolve) {
  let state = await createSolvedState();
  for (const m of solve.scramble.split(/\s+/)) state = applyMoveToState(state, m);

  // Token index range (in the joined solution alg) covered by each stage.
  const ranges: Partial<Record<string, { first: number; last: number }>> = {};
  const tokens: string[] = [];
  for (const line of solve.lines) {
    const lineTokens = line.alg.split(/\s+/).filter(Boolean);
    const first = tokens.length;
    tokens.push(...lineTokens);
    const last = tokens.length - 1;
    const r = ranges[line.stage];
    ranges[line.stage] = r ? { first: r.first, last } : { first, last };
  }

  const physical = algToPhysicalMoves(tokens.join(" "));
  const moves = physical.map((pm, i) => ({ move: createMoveStr(pm.face, pm.power)!, relativeMs: i }));
  const boundaries = computeStageBoundaries(rouxStageDetector, moves, state);

  // Last physical move must fully solve the cube — sanity check of the replay itself.
  let end = state;
  for (const m of moves) end = applyMoveToState(end, m.move);

  return { boundaries, physical, ranges, solvedAtEnd: end.experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true }) };
}

describe("rouxStageDetector against reco.nz reconstructions (smart-cube style replay)", () => {
  for (const solve of SOLVES) {
    it(`reco.nz/solve/${solve.id}: every stage boundary lands inside its annotated line`, async () => {
      const { boundaries, physical, ranges, solvedAtEnd } = await replay(solve);
      expect(solvedAtEnd).toBe(true);

      const detected = Object.fromEntries(boundaries.map((b) => [b.stage, b.moveIndex]));
      const algIndexOf = (moveIndex: number) => (moveIndex < 0 ? -1 : physical[moveIndex].algIndex);
      const report = rouxStageDetector.stages
        .map((s) => `${s}: ${detected[s] === undefined ? "NOT DETECTED" : `alg token ${algIndexOf(detected[s])} (expected ${ranges[s]!.first}-${ranges[s]!.last})`}`)
        .join("\n");

      for (const stage of rouxStageDetector.stages) {
        expect(detected[stage], `${stage} never detected\n${report}`).toBeDefined();
        const at = algIndexOf(detected[stage]);
        const r = ranges[stage]!;
        expect(at >= r.first && at <= r.last, `${stage} detected at token ${at}, expected within ${r.first}-${r.last}\n${report}`).toBe(true);
      }
    });
  }
});

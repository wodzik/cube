import { describe, it, expect } from "bun:test";
import { getCrossEngine, MAX_CROSS_DEPTH, MOVE_NAMES } from "./crossEngine";
import { invertSequence } from "../moveParser";
import { isCrossSolvedOnFace, type Face } from "../stageDetection/lastLayerShared";
import { createSolvedState, applyMoveToState } from "../stageDetection/liveCubeState";

const tokenize = (s: string) => s.trim().split(/\s+/).filter(Boolean);

describe("CrossEngine — state space", () => {
  it("covers exactly the 190,080 legal cross states, max depth 8", async () => {
    const engine = await getCrossEngine("U");
    let total = 1; // solved
    for (let d = 1; d <= MAX_CROSS_DEPTH; d++) total += engine.stateCountAtDepth(d);
    expect(total).toBe(12 * 11 * 10 * 9 * 2 ** 4);
    expect(engine.stateCountAtDepth(MAX_CROSS_DEPTH)).toBeGreaterThan(0);
    expect(engine.stateCountAtDepth(MAX_CROSS_DEPTH + 1)).toBe(0);
  });

  it("solved state has distance 0; a single move has distance 1", async () => {
    const engine = await getCrossEngine("U");
    expect(engine.distance(engine.stateAfter([]))).toBe(0);
    expect(engine.isSolved(engine.stateAfter([]))).toBe(true);
    // Every single move that touches a U-cross edge leaves distance exactly 1.
    for (const m of ["U", "U'", "U2", "F", "R2", "B'"]) {
      expect(engine.distance(engine.stateAfter([m]))).toBe(1);
    }
    // D moves don't touch the U cross at all.
    expect(engine.distance(engine.stateAfter(["D"]))).toBe(0);
  });

  it("a sequence and its inverse round-trip to solved", async () => {
    const engine = await getCrossEngine("U");
    const seq = tokenize("R U2 F' L D B2 R' F U");
    const idx = engine.stateAfter([...seq, ...invertSequence(seq)]);
    expect(engine.isSolved(idx)).toBe(true);
  });
});

describe("CrossEngine — agreement with LiveCubeState", () => {
  it("stateFromEdgesOrbit matches stateAfter for the same move sequence", async () => {
    const engine = await getCrossEngine("U");
    const solved = await createSolvedState();
    const sequences = ["", "U", "R U R' U' F2 D'", "F B' L R' U2 D2 F' B L' R U' D"];
    for (const seq of sequences) {
      const tokens = tokenize(seq);
      const pattern = tokens.reduce((s, m) => applyMoveToState(s, m), solved);
      expect(engine.stateFromEdgesOrbit(pattern.patternData.EDGES)).toBe(engine.stateAfter(tokens));
    }
  });

  it("stateAfter composes: from-state + suffix equals full sequence", async () => {
    const engine = await getCrossEngine("U");
    const prefix = tokenize("R U2 F'");
    const suffix = tokenize("L D B2");
    expect(engine.stateAfter(suffix, engine.stateAfter(prefix))).toBe(engine.stateAfter([...prefix, ...suffix]));
  });

  it("distance 0 ⇔ isCrossSolvedOnFace, on scrambled positions", async () => {
    const engine = await getCrossEngine("U");
    const solved = await createSolvedState();
    const sequences = [
      "", "U", "D L2 B", "R U R' U' F2 D'", "F B' L R' U2 D2 F' B L' R U' D",
    ];
    for (const seq of sequences) {
      const tokens = tokenize(seq);
      const pattern = tokens.reduce((s, m) => applyMoveToState(s, m), solved);
      const engineSolved = engine.distance(engine.stateAfter(tokens)) === 0;
      expect(engineSolved).toBe(isCrossSolvedOnFace(pattern, "U"));
    }
  });
});

describe("CrossEngine — sampling and solutions", () => {
  it("sampleStateAtDepth returns states with EXACTLY that optimal distance", async () => {
    const engine = await getCrossEngine("U");
    for (let n = 1; n <= MAX_CROSS_DEPTH; n++) {
      for (let i = 0; i < 5; i++) {
        expect(engine.distance(engine.sampleStateAtDepth(n))).toBe(n);
      }
    }
  });

  it("optimalSolutions are all exactly optimal length and actually solve the state", async () => {
    const engine = await getCrossEngine("U");
    for (let n = 1; n <= 6; n++) {
      const idx = engine.sampleStateAtDepth(n);
      const solutions = engine.optimalSolutions(idx, 10);
      expect(solutions.length).toBeGreaterThan(0);
      for (const sol of solutions) {
        const moves = tokenize(sol);
        expect(moves.length).toBe(n);
        // Verify by replay: scramble-to-state + solution = solved. We don't
        // have a moves-from-idx, so verify via a known generator instead:
        // solve the state, invert that solution to reach idx from solved,
        // then apply this solution.
        const gen = invertSequence(tokenize(engine.firstOptimalSolution(idx)));
        expect(engine.isSolved(engine.stateAfter([...gen, ...moves]))).toBe(true);
      }
      // No duplicates.
      expect(new Set(solutions).size).toBe(solutions.length);
    }
  });

  it("solutions never repeat a face and canonicalize same-axis pairs", async () => {
    const engine = await getCrossEngine("U");
    const faceOf = (m: string) => "UDLRFB".indexOf(m[0]);
    for (let i = 0; i < 10; i++) {
      const idx = engine.sampleStateAtDepth(6);
      for (const sol of engine.optimalSolutions(idx, 20)) {
        const faces = tokenize(sol).map(faceOf);
        for (let j = 1; j < faces.length; j++) {
          expect(faces[j]).not.toBe(faces[j - 1]);
          if ((faces[j] >> 1) === (faces[j - 1] >> 1)) {
            expect(faces[j - 1]).toBeLessThan(faces[j]);
          }
        }
      }
    }
  });

  it("works for a non-U face too (D cross)", async () => {
    const engine = await getCrossEngine("D" as Face);
    expect(engine.distance(engine.stateAfter(["D"]))).toBe(1);
    expect(engine.distance(engine.stateAfter(["U"]))).toBe(0);
    expect(engine.distance(engine.sampleStateAtDepth(5))).toBe(5);
  });
});

describe("CrossEngine — solve analysis", () => {
  it("flags moves that did not reduce the exact distance", async () => {
    const engine = await getCrossEngine("U");
    // Scramble = F (distance 1, optimal solution F'). User plays R — wasted
    // (1→2). The undoing R' DECREASES distance (2→1) so it is not flagged:
    // the flag marks where the deviation happened, not the repair of it.
    const analysis = engine.analyzeSolve(engine.stateAfter(["F"]), ["R", "R'", "F'"]);
    expect(analysis.map((a) => a.wasted)).toEqual([true, false, false]);
    expect(analysis[2].distAfter).toBe(0);
  });

  it("stops at the move that solves the cross", async () => {
    const engine = await getCrossEngine("U");
    const analysis = engine.analyzeSolve(engine.stateAfter(["F"]), ["F'", "R", "U"]);
    expect(analysis.length).toBe(1);
    expect(analysis[0]).toMatchObject({ move: "F'", distBefore: 1, distAfter: 0, wasted: false });
  });

  it("every optimal solution's moves are all non-wasted", async () => {
    const engine = await getCrossEngine("U");
    const scramble = tokenize("R U2 F' L D B2 R' F U");
    const idx = engine.stateAfter(scramble);
    for (const sol of engine.optimalSolutions(idx, 5)) {
      const analysis = engine.analyzeSolve(idx, tokenize(sol));
      expect(analysis.every((a) => !a.wasted)).toBe(true);
      expect(analysis.length).toBe(engine.distance(idx));
    }
  });
});

describe("MOVE_NAMES", () => {
  it("covers all 18 face turns", () => {
    expect(MOVE_NAMES.length).toBe(18);
    expect(new Set(MOVE_NAMES).size).toBe(18);
  });
});

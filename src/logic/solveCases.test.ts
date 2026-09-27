import { describe, expect, it } from "bun:test";
import { formatAlg, frameFor, invert, parseAlg, transformMoves } from "@wodzik/cubecore/core";
import { F2L_CASES } from "@wodzik/cubecore/cfop";
import { applyMoveToState, createSolvedState } from "./stageDetection/liveCubeState";
import { cfopStageDetector, computeStageBoundaries, rouxStageDetector } from "./stageDetection/methodTracker";
import { solveCases } from "./solveCases";
import type { SolveRecord } from "../types/solve";

/** A solve of `segments` from the scramble that undoes them (moves one per written move, 100 ms apart). */
async function solveOf(segments: string[], method: "CFOP" | "Roux") {
  const all = segments.flatMap((s) => parseAlg(s));
  const scramble = formatAlg(invert(all));
  const moves = all.map((m, i) => ({ move: formatAlg([m]), relativeMs: i * 100 }));
  const start = scramble.split(" ").reduce((s, m) => applyMoveToState(s, m), await createSolvedState());
  const record = { id: `t-${Math.random()}`, scramble, moves, method } as unknown as SolveRecord;
  record.cfop = computeStageBoundaries(cfopStageDetector, moves, start);
  record.roux = computeStageBoundaries(rouxStageDetector, moves, start);
  return record;
}

describe("solveCases", () => {
  it("CFOP: the last pair's F2L case, then OLL and PLL", async () => {
    const pair = F2L_CASES[0];
    const sune = "R U R' U R U2 R'";
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const record = await solveOf([pair.algs.FR, sune, tPerm], "CFOP");
    const cases = solveCases(record, "CFOP");
    expect(cases["f2l-4"]).toMatchObject({ kind: "f2l", name: pair.id, slot: "FR" });
    expect(cases.oll).toMatchObject({ kind: "oll", name: "OLL 27" });
    expect(cases.pll).toMatchObject({ kind: "pll", name: "T" });
  });

  it("CFOP: colour neutral — the same cases with the cross on U", async () => {
    const pair = F2L_CASES[4];
    const onU = (alg: string) => formatAlg(transformMoves(parseAlg(alg), frameFor("U")));
    const record = await solveOf([onU(pair.algs.FL), onU("R U R' U R U2 R'"), onU("R U R' U' R' F R2 U' R' U' R U R' F'")], "CFOP");
    const cases = solveCases(record, "CFOP");
    expect(cases["f2l-4"]?.name).toBe(pair.id);
    expect(cases.oll?.name).toBe("OLL 27");
    expect(cases.pll?.name).toBe("T");
  });

  it("CFOP: a skipped PLL", async () => {
    const record = await solveOf(["R U R' U R U2 R'"], "CFOP");
    const cases = solveCases(record, "CFOP");
    expect(cases.oll?.name).toBe("OLL 27");
    expect(cases.pll?.name).toBe("skip");
  });

  it("Roux: the CMLL case", async () => {
    const record = await solveOf(["R U R' U R U2 R'"], "Roux");
    const cases = solveCases(record, "Roux");
    expect(cases.cmll?.kind).toBe("cmll");
    expect(cases.cmll?.name).toMatch(/Sune/);
  });

  it("other methods have no cases", async () => {
    const record = await solveOf(["R U R' U R U2 R'"], "CFOP");
    expect(solveCases(record, "LBL")).toEqual({});
  });
});

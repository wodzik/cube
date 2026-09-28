/**
 * The app's stages on cubecore's MethodTracker: ids, boundaries (index of
 * the completing move, −1 = before the first), live = batch, details.
 * Colour neutrality (all 24 orientations) is colourNeutral.test.ts; Roux on
 * real reconstructions rouxStages.reco.test.ts.
 */
import { describe, expect, it } from "bun:test";
import { formatAlg, invert, parseAlg } from "@wodzik/cubecore/core";
import { StageWalker, computeStageBoundaries, startStateOf } from "./methodTracker";
import { cfopStageDetector } from "./cfopStages";
import { lblStageDetector } from "./lblStages";
import { rouxStageDetector } from "./rouxStages";

/** A deterministic random face-turn scramble. */
function scramble(seed: number, length = 25): string {
  let x = seed * 2654435761 + 1;
  const rnd = () => ((x = (x * 1103515245 + 12345) & 0x7fffffff), x / 0x7fffffff);
  const faces = "URFDLB";
  const out: string[] = [];
  let last = -1;
  while (out.length < length) {
    const f = Math.floor(rnd() * 6);
    if (f === last) continue;
    last = f;
    out.push(faces[f] + ["", "'", "2"][Math.floor(rnd() * 3)]);
  }
  return out.join(" ");
}

const timed = (alg: string) => alg.split(" ").filter(Boolean).map((move, i) => ({ move, relativeMs: i * 100 }));
const solutionOf = (s: string) => formatAlg(invert(parseAlg(s)));

describe("stages on cubecore's MethodTracker", () => {
  it("a solved cube: every stage before the first move", () => {
    for (const d of [cfopStageDetector, lblStageDetector, rouxStageDetector]) {
      const b = computeStageBoundaries(d, [], startStateOf(""));
      expect(b.map((x) => x.stage)).toEqual([...d.stages]);
      expect(b.every((x) => x.moveIndex === -1 && x.timestampMs === 0)).toBe(true);
    }
  });

  it("a whole solve (scramble undone): every stage found in order, the last one on the last move", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const s = scramble(seed);
      const moves = timed(solutionOf(s));
      for (const d of [cfopStageDetector, lblStageDetector, rouxStageDetector]) {
        const b = computeStageBoundaries(d, moves, startStateOf(s));
        expect(b.map((x) => x.stage)).toEqual([...d.stages]);
        for (let i = 1; i < b.length; i++) expect(b[i].moveIndex).toBeGreaterThanOrEqual(b[i - 1].moveIndex);
        expect(b.at(-1)!.moveIndex).toBe(moves.length - 1);
        expect(b.at(-1)!.timestampMs).toBe(moves.at(-1)!.relativeMs);
      }
    }
  });

  it("fed move by move (live) = the whole solve at once", () => {
    const s = scramble(42);
    const moves = timed(solutionOf(s));
    for (const d of [cfopStageDetector, lblStageDetector, rouxStageDetector]) {
      const walker = new StageWalker(d, startStateOf(s));
      moves.forEach((m, i) => walker.feedMove(m, i));
      expect([...walker.boundaries]).toEqual(computeStageBoundaries(d, moves, startStateOf(s)));
    }
  });

  it("AUF turns only the last layer: every move after PLL turns the face opposite the cross", () => {
    let checked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = scramble(seed);
      const moves = timed(solutionOf(s));
      const b = computeStageBoundaries(cfopStageDetector, moves, startStateOf(s));
      const cross = b.find((x) => x.stage === "cross")?.detail;
      const pll = b.find((x) => x.stage === "pll")!.moveIndex;
      const auf = b.find((x) => x.stage === "auf")!.moveIndex;
      if (auf <= pll || !cross) continue;
      checked++;
      const last = ({ U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" } as Record<string, string>)[cross];
      for (let i = pll + 1; i <= auf; i++) expect(moves[i].move[0]).toBe(last);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("LBL: the two halves of OLL either way round, the second named as the other", () => {
    const sune = "R U R' U R U2 R'";
    // Corners twisted, edges oriented: the edges half is done first (already), then the corners.
    const edgesFirst = computeStageBoundaries(lblStageDetector, timed(sune), startStateOf(solutionOf(sune)));
    const byStage = Object.fromEntries(edgesFirst.map((x) => [x.stage, x]));
    expect(byStage["oll-first"].detail).toBe("edges");
    expect(byStage["oll-first"].moveIndex).toBe(-1);
    expect(byStage["oll-second"].detail).toBe("corners");
    expect(byStage["oll-second"].moveIndex).toBeGreaterThan(-1);
  });
});

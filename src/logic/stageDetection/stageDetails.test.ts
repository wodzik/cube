import { describe, it, expect } from "bun:test";
import { computeStageBoundaries, startStateOf } from "./methodTracker";
import { cfopStageDetector } from "./cfopStages";
import { lblStageDetector } from "./lblStages";
import { rouxStageDetector } from "./rouxStages";
import { stageCubeColors, FACE_COLORS } from "../../components/cubeColors";
import { computeStageTimings } from "./stageTiming";

/** Mirrors cubeColors.ts's private darken() so tests can assert the exact darkened hex without exporting an internal. */
function darken(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 0xff) * factor);
  return `#${[ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

describe("stage details name the cross face and each slot's side faces", () => {
  it("CFOP on a solved cube: the cross on D (the orientation as held), then the four D-layer slots, each once", () => {
    const boundaries = computeStageBoundaries(cfopStageDetector, [], startStateOf(""));
    const detail = Object.fromEntries(boundaries.map((b) => [b.stage, b.detail]));
    expect(detail.cross).toBe("D");
    expect(new Set([detail["f2l-1"], detail["f2l-2"], detail["f2l-3"], detail["f2l-4"]])).toEqual(new Set(["FR", "FL", "BR", "BL"]));
    expect(detail.oll).toBeUndefined();
  });

  it("CFOP: an inserted pair records the slot it went into", () => {
    // The FR pair pulled out (R U R'), then put back (R U' R').
    const moves = ["R", "U'", "R'"].map((move, i) => ({ move, relativeMs: i * 100 }));
    const boundaries = computeStageBoundaries(cfopStageDetector, moves, startStateOf("R U R'"));
    const detail = Object.fromEntries(boundaries.map((b) => [b.stage, b.detail]));
    expect(detail.cross).toBe("D");
    expect(detail["f2l-4"]).toBe("FR");
    expect(boundaries.find((b) => b.stage === "f2l-4")!.moveIndex).toBe(2);
  });

  it("LBL records the same kind of details for corners and edges", () => {
    const boundaries = computeStageBoundaries(lblStageDetector, [], startStateOf(""));
    const detail = Object.fromEntries(boundaries.map((b) => [b.stage, b.detail]));
    expect(detail.cross).toBe("D");
    expect(detail["first-layer-1"]).toBe("FR");
    expect(new Set([1, 2, 3, 4].map((n) => detail[`second-layer-${n}`]))).toEqual(new Set(["FR", "FL", "BR", "BL"]));
  });

  it("stageCubeColors: cross face color, two colors per slot, last layer in the opposite face's color, PLL its own accent (not a shade of OLL's color)", () => {
    const boundaries = computeStageBoundaries(cfopStageDetector, [], startStateOf(""));
    const timings = computeStageTimings(cfopStageDetector.stages, boundaries, []);
    const byStage = Object.fromEntries(timings.map((t) => [t.stage, t]));
    expect(stageCubeColors(byStage.cross, timings)).toEqual([FACE_COLORS.D]);
    expect(stageCubeColors(byStage["f2l-1"], timings)).toEqual([FACE_COLORS.F, FACE_COLORS.R]);
    expect(stageCubeColors(byStage.oll, timings)).toEqual([FACE_COLORS.U]);
    // PLL must NOT be a shade of OLL's (last-layer) color — that's the "2x
    // yellow" bug this fixed. It's a fixed accent, independent of the cross.
    const pllColor = stageCubeColors(byStage.pll, timings)!;
    expect(pllColor).not.toEqual([FACE_COLORS.U]);
    // No details (e.g. a record from before they existed) -> no cube colors.
    expect(stageCubeColors({ ...byStage["f2l-1"], detail: undefined }, timings)).toBeNull();
    expect(stageCubeColors(byStage.cross, timings.map((t) => ({ ...t, detail: undefined })))).toBeNull();
  });

  it("Roux: fb/sb floor+wall, cmll the OTHER wall pair, lse the floor's opposite (identity grip: floor D, fb's wall L, sb's own NEW wall R, leaving cmll the F/B pair fb/sb never touched)", () => {
    const boundaries = computeStageBoundaries(rouxStageDetector, [], startStateOf(""));
    const detail = Object.fromEntries(boundaries.map((b) => [b.stage, b.detail]));
    expect(detail.fb).toBe("DL");
    expect(detail.sb).toBe("DR");
    expect(detail.cmll).toBe("FB");
    expect(detail.lse).toBe("D");

    const timings = computeStageTimings(rouxStageDetector.stages, boundaries, []);
    const byStage = Object.fromEntries(timings.map((t) => [t.stage, t]));
    expect(stageCubeColors(byStage.fb, timings)).toEqual([FACE_COLORS.D, FACE_COLORS.L]);
    expect(stageCubeColors(byStage.sb, timings)).toEqual([FACE_COLORS.D, FACE_COLORS.R]);
    expect(stageCubeColors(byStage.cmll, timings)).toEqual([FACE_COLORS.F, FACE_COLORS.B]);
    expect(stageCubeColors(byStage.lse, timings)).toEqual([darken(FACE_COLORS.U, 0.58)]);
  });

  it("Roux: fb reports the block that actually completed — left block solved, right scrambled by R/U turns that never touch left's pieces", () => {
    const boundaries = computeStageBoundaries(rouxStageDetector, [], startStateOf("R U R' U' R U R' U'"));
    expect(boundaries.map((b) => [b.stage, b.detail])).toEqual([["fb", "DL"]]);
  });
});

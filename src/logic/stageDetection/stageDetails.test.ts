import { describe, it, expect } from "bun:test";
import { applyMoveToState, createSolvedState } from "./liveCubeState";
import { computeStageBoundaries } from "./methodTracker";
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
  it("CFOP on a solved cube: cross on U, then the four U-layer slots, each reported once", async () => {
    const solved = await createSolvedState();
    const boundaries = computeStageBoundaries(cfopStageDetector, [], solved);
    const detail = Object.fromEntries(boundaries.map((b) => [b.stage, b.detail]));
    expect(detail.cross).toBe("U");
    // Corner slots 0-3 (URF, UBR, ULB, UFL) with U stripped, in FACE_SLOTS order.
    expect([detail["f2l-1"], detail["f2l-2"], detail["f2l-3"], detail["f2l-4"]]).toEqual(["RF", "BR", "LB", "FL"]);
    expect(detail.oll).toBeUndefined();
  });

  it("CFOP: solving a D cross records D, and an inserted pair records the slot it went into", async () => {
    const solved = await createSolvedState();
    // Pull the DFR/FR pair out (R U R'), then the solve is U R U' R' — but
    // the walk starts from the pulled-out state, where the D cross is intact
    // and 3 pairs are solved; the last f2l boundary must name the FR slot.
    const start = ["R", "U", "R'"].reduce((s, m) => applyMoveToState(s, m), solved);
    const moves = ["R", "U'", "R'"].map((move, i) => ({ move, relativeMs: i * 100 }));
    const boundaries = computeStageBoundaries(cfopStageDetector, moves, start);
    const detail = Object.fromEntries(boundaries.map((b) => [b.stage, b.detail]));
    // Detection picks the first cross-solved face in FACES order; from this
    // state only D (pair pulled from the D layer breaks nothing on D's cross)
    // — and U's cross is broken by the R U R' setup.
    expect(detail.cross).toBe("D");
    expect(detail["f2l-4"]).toBe("FR");
    expect(boundaries.find((b) => b.stage === "f2l-4")!.moveIndex).toBe(2);
  });

  it("LBL records the same kind of details for corners and edges", async () => {
    const solved = await createSolvedState();
    const boundaries = computeStageBoundaries(lblStageDetector, [], solved);
    const detail = Object.fromEntries(boundaries.map((b) => [b.stage, b.detail]));
    expect(detail.cross).toBe("U");
    expect(detail["first-layer-1"]).toBe("RF");
    expect(detail["second-layer-1"]).toBe("FR"); // MIDDLE_LAYER_EDGE_SLOTS.U[0] = FR
  });

  it("stageCubeColors: cross face color, two colors per slot, last layer in the opposite face's color, PLL its own accent (not a shade of OLL's color)", async () => {
    const solved = await createSolvedState();
    const boundaries = computeStageBoundaries(cfopStageDetector, [], solved);
    const timings = computeStageTimings(cfopStageDetector.stages, boundaries, []);
    const byStage = Object.fromEntries(timings.map((t) => [t.stage, t]));
    expect(stageCubeColors(byStage.cross, timings)).toEqual([FACE_COLORS.U]);
    expect(stageCubeColors(byStage["f2l-1"], timings)).toEqual([FACE_COLORS.R, FACE_COLORS.F]);
    expect(stageCubeColors(byStage.oll, timings)).toEqual([FACE_COLORS.D]);
    // PLL must NOT be a shade of OLL's (last-layer) color — that's the "2x
    // yellow" bug this fixed. It's a fixed accent, independent of the cross.
    const pllColor = stageCubeColors(byStage.pll, timings)!;
    expect(pllColor).not.toEqual([FACE_COLORS.D]);
    expect(pllColor[0].toLowerCase()).not.toContain("ffd5"); // not a shade of D's yellow hex
    // No details (e.g. a record from before they existed) -> no cube colors.
    expect(stageCubeColors({ ...byStage["f2l-1"], detail: undefined }, timings)).toBeNull();
    expect(stageCubeColors(byStage.cross, timings.map((t) => ({ ...t, detail: undefined })))).toBeNull();
  });

  it("Roux: fb/sb floor+wall, cmll the OTHER wall pair, lse the floor's opposite (identity grip: floor D, fb's wall L, sb's own NEW wall R, leaving cmll the F/B pair fb/sb never touched)", async () => {
    const solved = await createSolvedState();
    const boundaries = computeStageBoundaries(rouxStageDetector, [], solved);
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

  it("Roux: fb reports the block that actually completed — left block solved, right scrambled by R/U turns that never touch left's pieces", async () => {
    const solved = await createSolvedState();
    const scrambled = "R U R' U' R U R' U'".split(" ").reduce((s, m) => applyMoveToState(s, m), solved);
    const context = rouxStageDetector.createContext!();
    expect(rouxStageDetector.isStageSolved("fb", scrambled, context)).toBe(true);
    expect(rouxStageDetector.isStageSolved("sb", scrambled, context)).toBe(false);
    expect(rouxStageDetector.stageDetail!("fb", scrambled, context)).toBe("DL");
  });
});

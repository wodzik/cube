import { describe, it, expect } from "bun:test";
import { applyMoveToState, createSolvedState } from "./liveCubeState";
import { computeStageBoundaries } from "./methodTracker";
import { cfopStageDetector } from "./cfopStages";
import { lblStageDetector } from "./lblStages";
import { stageCubeColors, FACE_COLORS } from "../../components/cubeColors";
import { computeStageTimings } from "./stageTiming";

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

  it("stageCubeColors: cross face color, two colors per slot, last layer in the opposite face's color", async () => {
    const solved = await createSolvedState();
    const boundaries = computeStageBoundaries(cfopStageDetector, [], solved);
    const timings = computeStageTimings(cfopStageDetector.stages, boundaries, []);
    const byStage = Object.fromEntries(timings.map((t) => [t.stage, t]));
    expect(stageCubeColors(byStage.cross, timings)).toEqual([FACE_COLORS.U]);
    expect(stageCubeColors(byStage["f2l-1"], timings)).toEqual([FACE_COLORS.R, FACE_COLORS.F]);
    expect(stageCubeColors(byStage.oll, timings)).toEqual([FACE_COLORS.D]);
    // No details (e.g. a record from before they existed) -> no cube colors.
    expect(stageCubeColors({ ...byStage["f2l-1"], detail: undefined }, timings)).toBeNull();
    expect(stageCubeColors(byStage.cross, timings.map((t) => ({ ...t, detail: undefined })))).toBeNull();
  });
});

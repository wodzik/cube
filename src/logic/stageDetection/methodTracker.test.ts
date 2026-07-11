import { describe, it, expect } from "bun:test";
import { randomScrambleForEvent } from "cubing/scramble";
import { createSolvedState, applyMoveToState, isFullySolved } from "./liveCubeState";
import { cfopStageDetector } from "./cfopStages";
import { rouxStageDetector } from "./rouxStages";
import { computeStageBoundaries, StageWalker } from "./methodTracker";
import { invertSequence } from "../moveParser";

describe("liveCubeState", () => {
  it("the solved state is fully solved", async () => {
    const solved = await createSolvedState();
    expect(isFullySolved(solved)).toBe(true);
  });

  it("a single move breaks the solved state", async () => {
    const solved = await createSolvedState();
    expect(isFullySolved(applyMoveToState(solved, "R"))).toBe(false);
  });

  it("R U R' U' repeated 6 times returns to solved (well-known order-6 property)", async () => {
    let state = await createSolvedState();
    for (let rep = 0; rep < 6; rep++) {
      for (const move of ["R", "U", "R'", "U'"]) {
        state = applyMoveToState(state, move);
      }
    }
    expect(isFullySolved(state)).toBe(true);
  });

  it("a scramble followed by its exact inverse returns to solved (round-trip property)", async () => {
    const scramble = (await randomScrambleForEvent("333")).toString().trim().split(/\s+/);
    const solution = invertSequence(scramble);
    let state = await createSolvedState();
    for (const move of [...scramble, ...solution]) {
      state = applyMoveToState(state, move);
    }
    expect(isFullySolved(state)).toBe(true);
  });
});

describe("cfopStageDetector — verified against known single-move effects", () => {
  it("cross and F2L are solved on the solved state", async () => {
    const solved = await createSolvedState();
    for (const stage of cfopStageDetector.stages) {
      expect(cfopStageDetector.isStageSolved(stage, solved)).toBe(true);
    }
  });

  it("a single R leaves only the L-face cross intact — cross is still reported solved (face-agnostic)", async () => {
    const solved = await createSolvedState();
    const state = applyMoveToState(solved, "R");
    // R disturbs one edge each of R/U/D/F/B (UR, DR, FR, BR all belong to
    // the R slice) — only L's 4 cross edges (UL, DL, FL, BL) are untouched.
    // A detector that only ever checked the D face (the old, pre-fix
    // behavior) would wrongly report "no cross" here.
    expect(cfopStageDetector.isStageSolved("cross", state)).toBe(true);
  });

  it("a single R twists URF/UBR — OLL relative to the still-intact L cross is broken", async () => {
    const solved = await createSolvedState();
    const state = applyMoveToState(solved, "R");
    expect(cfopStageDetector.isStageSolved("oll", state)).toBe(false);
  });

  it("cross/F2L/OLL/PLL are all still correctly detected when the cross ends up on U instead of D", async () => {
    const solved = await createSolvedState();
    // A single D turn only permutes the D layer's own corners/edges among
    // themselves — it never touches U's corners, U's edges, or any of the
    // middle-band edges (FR/FL/BR/BL) that U's F2L pairs depend on, and a
    // pure permutation never changes orientation, so OLL (relative to U)
    // stays satisfied too. From a U-cross solver's point of view, a D turn
    // is just an AUF adjustment — harmless. This is exactly the scenario
    // the old D-face-only detector could never recognize.
    const state = applyMoveToState(solved, "D");
    expect(cfopStageDetector.isStageSolved("cross", state)).toBe(true);
    expect(cfopStageDetector.isStageSolved("f2l-4", state)).toBe(true);
    expect(cfopStageDetector.isStageSolved("oll", state)).toBe(true);
    // PLL is AUF-tolerant: D, D2, or D' brings it back to fully solved.
    expect(cfopStageDetector.isStageSolved("pll", state)).toBe(true);
  });

  it("a real scramble breaks cross on every face at once", async () => {
    const scramble = (await randomScrambleForEvent("333")).toString().trim().split(/\s+/);
    const state = scramble.reduce((s, move) => applyMoveToState(s, move), await createSolvedState());
    expect(cfopStageDetector.isStageSolved("cross", state)).toBe(false);
  });

  it("a single U leaves cross/F2L intact but PLL is only solved up to the AUF it happens to be one turn from", async () => {
    const solved = await createSolvedState();
    const state = applyMoveToState(solved, "U");
    expect(cfopStageDetector.isStageSolved("cross", state)).toBe(true);
    expect(cfopStageDetector.isStageSolved("f2l-4", state)).toBe(true);
    // U alone is a pure AUF offset of an otherwise-solved cube, so PLL
    // (permutation correct up to AUF) reads as already satisfied...
    expect(cfopStageDetector.isStageSolved("pll", state)).toBe(true);
    // ...but AUF itself is a separate, stricter stage: the cube is not
    // LITERALLY solved yet (a U turn is not a whole-cube reorientation).
    expect(cfopStageDetector.isStageSolved("auf", state)).toBe(false);
  });

  it("AUF only completes once the trailing adjustment turn actually lands", async () => {
    const solved = await createSolvedState();
    const midAuf = applyMoveToState(solved, "U");
    expect(cfopStageDetector.isStageSolved("auf", midAuf)).toBe(false);
    const doneAuf = applyMoveToState(midAuf, "U'"); // undo it -> back to fully solved
    expect(cfopStageDetector.isStageSolved("auf", doneAuf)).toBe(true);
  });
});

describe("cfopStageDetector — cross face is locked once, not re-detected per stage", () => {
  it("f2l/oll/pll keep checking the face cross first locked onto, even if a later state would independently suggest a different face", async () => {
    const solved = await createSolvedState();
    const context = cfopStageDetector.createContext!();

    // Cross intact on U (D was turned) — this call locks context.lockedFace = "U".
    const crossOnU = applyMoveToState(solved, "D");
    expect(cfopStageDetector.isStageSolved("cross", crossOnU, context)).toBe(true);

    // A wholly different state where F2L is complete on R (via a single L
    // turn — L leaves R's cross+F2L untouched, same pattern as the D/U case
    // above, just on a different axis) but NOT on U. Fed through the SAME
    // (already-locked) context: if locking works, f2l-4 must be evaluated
    // against the locked "U", so it reads false here — U's F2L is not
    // actually complete in this state. Without locking (old
    // detectActiveFace-every-call behavior) this would instead silently
    // pick up R and return true, which is exactly the drift bug this
    // context exists to prevent.
    const f2lOnR = applyMoveToState(solved, "L");
    expect(cfopStageDetector.isStageSolved("f2l-4", f2lOnR, context)).toBe(false);
  });

  it("without a context (standalone call, e.g. a test checking one state in isolation), falls back to best-effort fresh detection", async () => {
    const solved = await createSolvedState();
    const f2lOnR = applyMoveToState(solved, "L");
    // No context passed — must still find R via the fallback, matching the
    // pre-locking behavior single-state callers (like the tests above) rely on.
    expect(cfopStageDetector.isStageSolved("f2l-4", f2lOnR)).toBe(true);
  });
});

describe("rouxStageDetector — verified against known single-move effects", () => {
  it("all stages solved on the solved state", async () => {
    const solved = await createSolvedState();
    for (const stage of rouxStageDetector.stages) {
      expect(rouxStageDetector.isStageSolved(stage, solved)).toBe(true);
    }
  });

  it("a single R keeps fb (each block is intact on its own side) but breaks sb — no SHARED offset aligns both blocks at once", async () => {
    const solved = await createSolvedState();
    const state = applyMoveToState(solved, "R");
    // Left block untouched (home at offset 0); right block intact but
    // rotated (home at offset 3) — fb accepts either. sb requires one k
    // that fits BOTH, and 0 ≠ 3: physically this is a right layer twisted
    // relative to the left block's plane, which is NOT two aligned blocks.
    expect(rouxStageDetector.isStageSolved("fb", state)).toBe(true);
    expect(rouxStageDetector.isStageSolved("sb", state)).toBe(false);
  });

  it("a physical M-slice turn (logged as L + R', see rouxStages doc) keeps fb/sb/cmll satisfied — only lse remains", async () => {
    const solved = await createSolvedState();
    // Simulate the state right after CMLL when the solver does one M move:
    // both outer layers spin together in the fixed frame while centers and
    // the middle slice stay put. Blocks and corners are all rigid in the
    // grip — a shared offset k=1 brings every one of them home at once.
    const state = applyMoveToState(applyMoveToState(solved, "L"), "R'");
    expect(rouxStageDetector.isStageSolved("fb", state)).toBe(true);
    expect(rouxStageDetector.isStageSolved("sb", state)).toBe(true);
    expect(rouxStageDetector.isStageSolved("cmll", state)).toBe(true);
    // ...but the cube is genuinely not solved (middle slice + centers are
    // offset) — exactly the "LSE still in progress" situation.
    expect(rouxStageDetector.isStageSolved("lse", state)).toBe(false);
  });

  it("two M-worth of slice turns (L R' L R') — same story, offset just accumulates", async () => {
    const solved = await createSolvedState();
    const state = ["L", "R'", "L", "R'"].reduce((s, m) => applyMoveToState(s, m), solved);
    expect(rouxStageDetector.isStageSolved("sb", state)).toBe(true);
    expect(rouxStageDetector.isStageSolved("cmll", state)).toBe(true);
    expect(rouxStageDetector.isStageSolved("lse", state)).toBe(false);
  });

  it("blocks are required on the L/R faces — a block pair living on U/D is out of scope by design (see rouxStages doc comment)", async () => {
    const solved = await createSolvedState();
    // U + D' leaves intact rotated block pairs on the U and D faces — but
    // those are made of different physical pieces than the L/R blocks, and
    // this detector deliberately only tracks the display-matching grip.
    // Meanwhile the L/R blocks themselves are genuinely broken here (their
    // D-layer corners moved), so everything past fb reads false.
    const state = applyMoveToState(applyMoveToState(solved, "U"), "D'");
    expect(rouxStageDetector.isStageSolved("sb", state)).toBe(false);
  });

  it("CFOP and Roux track the SAME move stream independently and can disagree — the core requirement", async () => {
    const solved = await createSolvedState();
    // R then U: the left block is untouched, so Roux's fb holds. CFOP's
    // cross, being face-agnostic, survives a lone R (via the L face) but
    // R+U together reach into all 6 faces' cross edges (U's own turn
    // disturbs the one face — L — that R alone left alone), breaking it
    // everywhere.
    const state = applyMoveToState(applyMoveToState(solved, "R"), "U");
    expect(rouxStageDetector.isStageSolved("fb", state)).toBe(true);
    expect(cfopStageDetector.isStageSolved("cross", state)).toBe(false);
  });
});

describe("computeStageBoundaries", () => {
  it("records every stage as already complete (moveIndex -1) when starting from a solved state", async () => {
    const solved = await createSolvedState();
    const boundaries = computeStageBoundaries(cfopStageDetector, [{ move: "U", relativeMs: 100 }], solved);
    expect(boundaries).toHaveLength(cfopStageDetector.stages.length);
    expect(boundaries.every((b) => b.moveIndex === -1)).toBe(true);
  });

  it("walks a full scramble->solve sequence and records all CFOP stages in order, ending at the last move", async () => {
    const scramble = (await randomScrambleForEvent("333")).toString().trim().split(/\s+/);
    const solution = invertSequence(scramble);

    const scrambled = scramble.reduce(
      (state, move) => applyMoveToState(state, move),
      await createSolvedState()
    );

    const moves = solution.map((move, i) => ({ move, relativeMs: i * 100 }));
    const boundaries = computeStageBoundaries(cfopStageDetector, moves, scrambled);

    expect(boundaries.map((b) => b.stage)).toEqual([...cfopStageDetector.stages]);
    // PLL is AUF-tolerant, so it can (and often does) complete a move or two
    // before the literal final move of an inverted-scramble "solution" —
    // it's satisfied as soon as the permutation is right, not only once the
    // exact final quarter-turn lands. Must still finish by the last move.
    expect(boundaries[boundaries.length - 1].moveIndex).toBeLessThanOrEqual(solution.length - 1);
    // Boundaries must be non-decreasing in move index (stages complete in order).
    for (let i = 1; i < boundaries.length; i++) {
      expect(boundaries[i].moveIndex).toBeGreaterThanOrEqual(boundaries[i - 1].moveIndex);
    }
  });

  it("walks the same scramble->solve sequence for Roux, independently, ending at the last move", async () => {
    const scramble = (await randomScrambleForEvent("333")).toString().trim().split(/\s+/);
    const solution = invertSequence(scramble);

    const scrambled = scramble.reduce(
      (state, move) => applyMoveToState(state, move),
      await createSolvedState()
    );

    const moves = solution.map((move, i) => ({ move, relativeMs: i * 100 }));
    const boundaries = computeStageBoundaries(rouxStageDetector, moves, scrambled);

    expect(boundaries.map((b) => b.stage)).toEqual([...rouxStageDetector.stages]);
    expect(boundaries[boundaries.length - 1].moveIndex).toBe(solution.length - 1);
  });
});

describe("StageWalker — incremental feed matches batch computeStageBoundaries", () => {
  it("feeding moves one at a time (as a live solve would) produces identical boundaries to feeding the whole array at once", async () => {
    for (let trial = 0; trial < 15; trial++) {
      const scramble = (await randomScrambleForEvent("333")).toString().trim().split(/\s+/);
      const solution = invertSequence(scramble);
      const scrambled = scramble.reduce((s, m) => applyMoveToState(s, m), await createSolvedState());
      const moves = solution.map((m, i) => ({ move: m, relativeMs: i * 100 }));

      const batch = computeStageBoundaries(cfopStageDetector, moves, scrambled);

      const walker = new StageWalker(cfopStageDetector, scrambled);
      for (let i = 0; i < moves.length && !walker.isComplete; i++) {
        walker.feedMove(moves[i], i);
      }

      expect([...walker.boundaries]).toEqual(batch);
    }
  });

  it("isComplete flips true exactly once every stage has a boundary, and feedMove after that is a no-op", async () => {
    const solved = await createSolvedState();
    const walker = new StageWalker(cfopStageDetector, solved);
    // Solved start -> every stage already satisfied at construction (moveIndex -1 each).
    expect(walker.isComplete).toBe(true);
    expect(walker.boundaries).toHaveLength(cfopStageDetector.stages.length);

    walker.feedMove({ move: "R", relativeMs: 50 }, 0);
    // Still "complete" (all 8 stages were already recorded) — feeding more
    // moves past completion must not mutate boundaries or throw.
    expect(walker.boundaries).toHaveLength(cfopStageDetector.stages.length);
  });
});

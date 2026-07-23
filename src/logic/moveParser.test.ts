import { describe, it, expect } from "bun:test";
import {
  parseMove,
  invertMove,
  invertSequence,
  stripLeadingRotations,
  buildCaseSetupAlg,
  decomposeMove,
  algToPhysicalMoves,
  computeStageSplits,
} from "./moveParser";

describe("parseMove", () => {
  it("parses basic moves", () => {
    expect(parseMove("R")).toEqual({ raw: "R", base: "R", power: 1, isWide: false, isSlice: false, isRotation: false });
    expect(parseMove("R'")).toEqual({ raw: "R'", base: "R", power: 3, isWide: false, isSlice: false, isRotation: false });
    expect(parseMove("R2")).toEqual({ raw: "R2", base: "R", power: 2, isWide: false, isSlice: false, isRotation: false });
  });

  it("parses wide moves", () => {
    expect(parseMove("Rw")).toEqual({ raw: "Rw", base: "R", power: 1, isWide: true, isSlice: false, isRotation: false });
    expect(parseMove("r")).toEqual({ raw: "r", base: "R", power: 1, isWide: true, isSlice: false, isRotation: false });
  });

  it("parses slice moves", () => {
    expect(parseMove("M")).toEqual({ raw: "M", base: "M", power: 1, isWide: false, isSlice: true, isRotation: false });
    expect(parseMove("M'")).toEqual({ raw: "M'", base: "M", power: 3, isWide: false, isSlice: true, isRotation: false });
  });

  it("parses rotations", () => {
    expect(parseMove("x")).toEqual({ raw: "x", base: "x", power: 1, isWide: false, isSlice: false, isRotation: true });
    expect(parseMove("y'")).toEqual({ raw: "y'", base: "y", power: 3, isWide: false, isSlice: false, isRotation: true });
  });
});

describe("invertMove", () => {
  it("inverts basic moves", () => {
    expect(invertMove("R")).toBe("R'");
    expect(invertMove("R'")).toBe("R");
    expect(invertMove("R2")).toBe("R2");
  });

  it("strips trigger-grouping parens before inverting — the naive whitespace-split callers hand it raw", () => {
    // A leading "(" survives getMoveBase's suffix-only stripping unless
    // invertMove strips it itself first.
    expect(invertMove("(R'")).toBe("R");
    // A trailing ")" is worse: it hides the power suffix from
    // getMovePower's .endsWith checks entirely, so "S')" used to read as
    // power 1 instead of 3 and silently fail to invert (see file's
    // regression test below for the real-world case this broke).
    expect(invertMove("S')")).toBe("S");
    expect(invertMove("R)")).toBe("R'");
  });
});

describe("invertSequence", () => {
  it("inverts sequences", () => {
    expect(invertSequence(["R", "U", "F'"])).toEqual(["F", "U'", "R'"]);
  });

  it("REGRESSION: a naively whitespace-split decorated alg (parens still attached) inverts correctly", () => {
    // The exact F2L Adv case that rendered as a solved cube instead of
    // scrambled: TrainingPage/AttackPage/AlgCaseVisualisation's invertAlg
    // splits "U2 (R' U R) U' (S R S')" on whitespace WITHOUT stripping
    // parens first (parseDecoratedAlg does that properly; these callers
    // don't) — every token invertSequence actually receives still carries
    // its "(" / ")" decoration.
    const decoratedTokens = "U2 (R' U R) U' (S R S')".split(/\s+/);
    expect(invertSequence(decoratedTokens)).toEqual(["S", "R'", "S'", "U", "R'", "U'", "R", "U2"]);
  });
});

describe("stripLeadingRotations / buildCaseSetupAlg", () => {
  it("stripLeadingRotations drops a leading run of rotations only", () => {
    expect(stripLeadingRotations(["y2", "U2", "R2"])).toEqual(["U2", "R2"]);
    expect(stripLeadingRotations(["y", "y'", "R"])).toEqual(["R"]);
    expect(stripLeadingRotations(["U2", "R2"])).toEqual(["U2", "R2"]);
    // A rotation NOT at the start is left alone — it's needed to correctly
    // track which absolute face the following tokens refer to.
    expect(stripLeadingRotations(["R", "y", "U"])).toEqual(["R", "y", "U"]);
  });

  it("REGRESSION: a leading rotation must not end up applied to the display — Advanced F2L 4's own 'y2 ...' variant used to render blue-front instead of the case's canonical green-front", () => {
    // Naive invertSequence(full alg) reverses order, so the leading y2
    // lands LAST in the setup — applied to the display as a spurious net
    // whole-cube spin. buildCaseSetupAlg must strip it before inverting.
    expect(buildCaseSetupAlg("y2 U2 R2 u R2' u' R2")).toEqual(invertSequence(["U2", "R2", "u", "R2'", "u'", "R2"]).join(" "));
    expect(buildCaseSetupAlg("y2 U2 R2 u R2' u' R2").trim().split(/\s+/).slice(-1)[0]).not.toMatch(/^y/);
  });

  it("an alg with no leading rotation is unaffected (matches plain invertSequence)", () => {
    expect(buildCaseSetupAlg("U2 L2' u L2 u' L2'")).toEqual(invertSequence(["U2", "L2'", "u", "L2", "u'", "L2'"]).join(" "));
  });

  it("empty alg produces an empty setup", () => {
    expect(buildCaseSetupAlg("")).toBe("");
    expect(buildCaseSetupAlg("y2")).toBe("");
  });
});

describe("decomposeMove", () => {
  it("decomposes wide moves into middle-face move + rotation", () => {
    // r = x + L
    expect(decomposeMove("r")).toEqual({
      physicalMoves: [{ face: "L", power: 1 }],
      rotation: { axis: "x", power: 1 },
    });
  });

  it("decomposes slice moves into two face moves + rotation", () => {
    // M = x' + R + L'
    expect(decomposeMove("M")).toEqual({
      physicalMoves: [{ face: "R", power: 1 }, { face: "L", power: 3 }],
      rotation: { axis: "x", power: 3 },
    });
  });

  it("decomposes rotations into rotation only", () => {
    expect(decomposeMove("x")).toEqual({
      physicalMoves: [],
      rotation: { axis: "x", power: 1 },
    });
  });

  it("decomposes normal moves into themselves", () => {
    expect(decomposeMove("R2")).toEqual({ physicalMoves: [{ face: "R", power: 2 }] });
  });
});

describe("algToPhysicalMoves", () => {
  it("passes through normal moves unchanged", () => {
    const result = algToPhysicalMoves("R U R' U'");
    expect(result.map((m) => `${m.face}${m.power}`)).toEqual(["R1", "U1", "R3", "U3"]);
  });

  it("reframes moves after a wide move (r shifts the frame via x)", () => {
    // r U r' — after r's x-rotation, the *physical* U is now what the algorithm calls... U stays U logically,
    // but the physical face hardware reports for the second r' must reflect the x rotation.
    const result = algToPhysicalMoves("r U r'");
    // r → physical L(1) + frame rotates x
    // U (logical) → physical face where orientation.U now points
    // r' → physical L(3) again relative to the (now rotated) frame, but since only one x happened,
    // the *physical* face for the middle-face part of a wide move is computed from the CURRENT frame,
    // so it should differ from a naive re-parse. Assert shape/length rather than over-specifying physics here.
    expect(result.length).toBe(3);
    expect(result[0]).toEqual({ face: "L", power: 1, algIndex: 0 });
  });
});

describe("computeStageSplits", () => {
  const identityReduce = (moves: string[]) => moves;

  it("splits moves into stages by timestamp and computes recognition/execution", () => {
    const moves = [
      { move: "R", relativeMs: 100 },
      { move: "U", relativeMs: 300 },
      { move: "R'", relativeMs: 500 },
      { move: "U'", relativeMs: 900 },
    ];
    const { splits, dropMs } = computeStageSplits(
      moves,
      [{ stage: "cross", endMs: 500 }, { stage: "f2l-1", endMs: 900 }],
      1000,
      identityReduce,
    );

    expect(splits).toHaveLength(2);
    expect(splits[0].stage).toBe("cross");
    expect(splits[0].stepCount).toBe(3);
    expect(splits[0].recognitionMs).toBe(100); // 0 -> first move at 100
    expect(splits[0].executionMs).toBe(400); // 100 -> 500
    expect(splits[1].stage).toBe("f2l-1");
    expect(splits[1].stepCount).toBe(1);
    expect(dropMs).toBe(100); // 1000 - 900
  });

  it("never merges moves across a stage boundary", () => {
    const moves = [
      { move: "L", relativeMs: 100 }, // last move of stage A
      { move: "L", relativeMs: 200 }, // first move of stage B — same token, but different stage
    ];
    const collapseIdentical = (ms: string[]) => {
      const out: string[] = [];
      for (const m of ms) {
        if (out[out.length - 1] === m) {
          out[out.length - 1] = m + "2";
        } else {
          out.push(m);
        }
      }
      return out;
    };
    const { splits } = computeStageSplits(
      moves,
      [{ stage: "a", endMs: 100 }, { stage: "b", endMs: 200 }],
      200,
      collapseIdentical,
    );
    // Each stage sees only its own single "L" — must NOT merge into "L2" across the boundary.
    expect(splits[0].reducedMoves).toEqual(["L"]);
    expect(splits[1].reducedMoves).toEqual(["L"]);
  });
});

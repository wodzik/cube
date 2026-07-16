import { describe, it, expect } from "bun:test";
import { cube3x3x3 } from "cubing/puzzles";
import { ACADEMY_LESSONS, FOUR_LOOK_LL_CORNERS_FIRST, parseDecoratedAlg } from "./academy";
import { academyStepMask } from "../logic/trainer/trainerMasks";

describe("parseDecoratedAlg", () => {
  it("strips trigger parentheses into per-token decorations", () => {
    const { tokens, decorations } = parseDecoratedAlg("F (R U R' U') F'");
    expect(tokens).toEqual(["F", "R", "U", "R'", "U'", "F'"]);
    expect(decorations[1]).toEqual({ prefix: "(" });
    expect(decorations[4]).toEqual({ suffix: ")" });
    expect(decorations[0]).toBeUndefined();
  });

  it("handles back-to-back groups", () => {
    const { tokens, decorations } = parseDecoratedAlg("F (R U R' U') (R U R' U') F'");
    expect(tokens.length).toBe(10);
    expect(decorations[1]).toEqual({ prefix: "(" });
    expect(decorations[4]).toEqual({ suffix: ")" });
    expect(decorations[5]).toEqual({ prefix: "(" });
    expect(decorations[8]).toEqual({ suffix: ")" });
  });
});

describe("4LLL corners-first lesson data", () => {
  it("every algorithm is a last-layer algorithm (first two layers untouched, centers home)", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    for (const step of FOUR_LOOK_LL_CORNERS_FIRST.steps) {
      for (const a of step.algs) {
        const { tokens } = parseDecoratedAlg(a.alg);
        const p = kpuzzle.defaultPattern().applyAlg(tokens.join(" "));
        // D + E layer pieces: edges 4..11, corners 4..7 must be solved.
        for (let e = 4; e < 12; e++) {
          expect(`${a.id} edge ${e}: ${p.patternData.EDGES.pieces[e]}/${p.patternData.EDGES.orientation[e]}`).toBe(
            `${a.id} edge ${e}: ${e}/0`
          );
        }
        for (let c = 4; c < 8; c++) {
          expect(`${a.id} corner ${c}: ${p.patternData.CORNERS.pieces[c]}/${p.patternData.CORNERS.orientation[c]}`).toBe(
            `${a.id} corner ${c}: ${c}/0`
          );
        }
        expect(p.patternData.CENTERS.pieces.join()).toBe("0,1,2,3,4,5");
      }
    }
  });

  const stepById = (id: string) => FOUR_LOOK_LL_CORNERS_FIRST.steps.find((s) => s.id === id)!;

  it("A + B equals the literal composition of blocks A and B", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const co = stepById("co");
    const a = parseDecoratedAlg(co.algs.find((x) => x.id === "block-a")!.alg).tokens.join(" ");
    const b = parseDecoratedAlg(co.algs.find((x) => x.id === "block-b")!.alg).tokens.join(" ");
    const literal = kpuzzle.defaultPattern().applyAlg(`${a} ${b}`);
    const cp = stepById("cp");
    const ab = parseDecoratedAlg(cp.algs.find((x) => x.id === "a-plus-b")!.alg).tokens.join(" ");
    const ba = parseDecoratedAlg(cp.algs.find((x) => x.id === "b-plus-a")!.alg).tokens.join(" ");
    expect(kpuzzle.defaultPattern().applyAlg(ab).isIdentical(literal)).toBe(true);
    const literalBa = kpuzzle.defaultPattern().applyAlg(`${b} ${a}`);
    expect(kpuzzle.defaultPattern().applyAlg(ba).isIdentical(literalBa)).toBe(true);
  });

  it("EO step comes before CP and its algs keep corners oriented", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const order = FOUR_LOOK_LL_CORNERS_FIRST.steps.map((s) => s.id);
    expect(order).toEqual(["co", "eo", "cp", "epll"]);
    for (const alg of stepById("eo").algs) {
      const p = kpuzzle.defaultPattern().applyAlg(parseDecoratedAlg(alg.alg).tokens.join(" "));
      for (const c of [0, 1, 2, 3]) expect(p.patternData.CORNERS.orientation[c]).toBe(0);
      // and it genuinely flips edges
      expect([0, 1, 2, 3].some((e) => p.patternData.EDGES.orientation[e] !== 0)).toBe(true);
    }
  });

  it("corner-permutation algs permute corners without disturbing their orientation", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    for (const id of ["a-plus-b", "b-plus-a"]) {
      const alg = stepById("cp").algs.find((x) => x.id === id)!;
      const p = kpuzzle.defaultPattern().applyAlg(parseDecoratedAlg(alg.alg).tokens.join(" "));
      // U-layer corners: permuted (not identity), all orientations 0.
      const uCorners = [0, 1, 2, 3];
      expect(uCorners.some((c) => p.patternData.CORNERS.pieces[c] !== c)).toBe(true);
      for (const c of uCorners) expect(p.patternData.CORNERS.orientation[c]).toBe(0);
    }
  });

  it("EPLL algs touch only edge permutation (corners fully solved)", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    for (const alg of stepById("epll").algs) {
      const p = kpuzzle.defaultPattern().applyAlg(parseDecoratedAlg(alg.alg).tokens.join(" "));
      expect(p.patternData.CORNERS.pieces.join()).toBe("0,1,2,3,4,5,6,7");
      expect(p.patternData.CORNERS.orientation.join()).toBe("0,0,0,0,0,0,0,0");
      for (const e of [0, 1, 2, 3]) expect(p.patternData.EDGES.orientation[e]).toBe(0);
    }
  });

  it("lesson registry exposes the lesson", () => {
    expect(ACADEMY_LESSONS.length).toBe(1);
  });

  it("step views follow the curriculum: OLL-style for orientation, corner-only for CP", () => {
    expect(FOUR_LOOK_LL_CORNERS_FIRST.steps.map((s) => s.view)).toEqual([
      "oll-corners",
      "oll",
      "corners",
      "full",
    ]);
    // "oll-corners": LL corners primary-sticker-only (OLL look), LL edges blacked out.
    const co = academyStepMask("oll-corners");
    expect(co.orbits.CORNERS.pieces[0]!.facelets).toEqual(["regular", "ignored", "ignored"]);
    expect(co.orbits.EDGES.pieces[0]!.facelets).toEqual(["ignored", "ignored"]);
    expect(co.orbits.EDGES.pieces[5]!.facelets[0]).toBe("dim");
    // "oll": classic OLL — LL edges also show their primary sticker.
    const oll = academyStepMask("oll");
    expect(oll.orbits.EDGES.pieces[0]!.facelets).toEqual(["regular", "ignored"]);
    expect(oll.orbits.CORNERS.pieces[0]!.facelets).toEqual(["regular", "ignored", "ignored"]);
    expect(oll.orbits.CORNERS.pieces[5]!.facelets[0]).toBe("dim");
    // "corners": full-color LL corners (permutation visible), edges blacked out.
    const cp = academyStepMask("corners");
    expect(cp.orbits.CORNERS.pieces[0]!.facelets).toEqual(["regular", "regular", "regular"]);
    expect(cp.orbits.EDGES.pieces[0]!.facelets).toEqual(["ignored", "ignored"]);
    const full = academyStepMask("full");
    for (const orbit of Object.values(full.orbits)) {
      for (const piece of orbit.pieces) for (const f of piece!.facelets) expect(f).toBe("regular");
    }
    // PG3D requires 4 facelets per center (numOrientations = 4).
    expect(co.orbits.CENTERS.pieces[0]!.facelets.length).toBe(4);
  });
});

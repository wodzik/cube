import { describe, it, expect } from "bun:test";
import { cube3x3x3 } from "cubing/puzzles";
import { ACADEMY_LESSONS, F2L_METHOD, FOUR_LOOK_LL_CORNERS_FIRST, TWO_FIRST_LAYERS, SECOND_LAYER, ZETA_SLOTTING, parseDecoratedAlg } from "./academy";
import { academyStepMask } from "../logic/trainer/trainerMasks";
import { buildCaseSetupAlg } from "../logic/moveParser";

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

  it("lesson registry lists Two first layers, Last layer, Zeta Slotting, F2L in order — four independent lessons", () => {
    expect(ACADEMY_LESSONS.map((l) => l.id)).toEqual(["two-first-layers", "4lll-corners-first", "zeta-slotting", "f2l"]);
    expect(ACADEMY_LESSONS.map((l) => l.title)).toEqual(["Two first layers", "Last layer", "Zeta Slotting", "F2L"]);
  });

  it("Two first layers reuses FIRST_LAYER/SECOND_LAYER's step objects; Zeta Slotting has its own, distinct edges step", () => {
    expect(TWO_FIRST_LAYERS.steps.map((s) => s.id)).toEqual(["corners", "edges"]);
    expect(TWO_FIRST_LAYERS.steps[1]).toBe(SECOND_LAYER.steps[0]);
    expect(ZETA_SLOTTING.steps.map((s) => s.id)).toEqual(["zeta-edges", "zeta-corners"]);
    expect(ZETA_SLOTTING.steps[0]).not.toBe(SECOND_LAYER.steps[0]);
    // Corner-blind edge inserts: three-move inserts for oriented edges, the hedgeslammer for unoriented ones.
    const zetaEdges = ZETA_SLOTTING.steps[0].algs;
    expect(zetaEdges.map((a) => [a.id, a.alg])).toEqual([
      ["edge-right", "R U' R'"],
      ["edge-left", "L' U L"],
      ["edge-unoriented-right", "F R' F' R"],
      ["edge-unoriented-left", "F' L F L'"],
    ]);
    expect(SECOND_LAYER.steps[0].algs.some((a) => a.id === "edge-unoriented-right")).toBe(false);
    // No lesson shares last-layer steps anymore — it's its own top-level lesson.
    for (const lesson of [TWO_FIRST_LAYERS, ZETA_SLOTTING, F2L_METHOD]) {
      for (const step of lesson.steps) expect(FOUR_LOOK_LL_CORNERS_FIRST.steps).not.toContain(step);
    }
  });

  it("Zeta Slotting's edge cases insert without disturbing the cross; oriented ones start with orientation 0, unoriented with 1", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    for (const id of ["edge-right", "edge-left", "edge-unoriented-right", "edge-unoriented-left"]) {
      const alg = ZETA_SLOTTING.steps[0].algs.find((a) => a.id === id)!;
      const { tokens } = parseDecoratedAlg(alg.alg);
      const p = kpuzzle.defaultPattern().applyAlg(buildCaseSetupAlg(tokens.join(" ")));
      const crossOk = [4, 5, 6, 7].every((e) => p.patternData.EDGES.pieces[e] === e && p.patternData.EDGES.orientation[e] === 0);
      expect(`${id}: cross intact ${crossOk}`).toBe(`${id}: cross intact true`);
      // Before insertion the edge sits up in the last layer (U-index slots), same as any other not-yet-placed piece.
      const edgeId = id.endsWith("left") ? 9 : 8;
      const slot = p.patternData.EDGES.pieces.indexOf(edgeId);
      expect([0, 1, 2, 3]).toContain(slot);
      expect(p.patternData.EDGES.orientation[slot]).toBe(id.includes("unoriented") ? 1 : 0);
    }
  });

  it("every algorithm in every lesson solves its case from the drill's setup (inverse applied to solved)", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    for (const lesson of ACADEMY_LESSONS) {
      for (const step of lesson.steps) {
        for (const a of step.algs) {
          const { tokens } = parseDecoratedAlg(a.alg);
          const p = kpuzzle.defaultPattern().applyAlg(buildCaseSetupAlg(tokens.join(" "))).applyAlg(tokens.join(" "));
          expect(`${lesson.id}/${step.id}/${a.id}: ${p.experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true })}`).toBe(
            `${lesson.id}/${step.id}/${a.id}: true`
          );
        }
      }
    }
    // The inserts act on the D slots (U is the last layer, as for OLL), so the
    // case must leave U untouched apart from the displaced piece itself.
    const corner = parseDecoratedAlg(TWO_FIRST_LAYERS.steps[0].algs[0].alg).tokens.join(" ");
    const cornerCase = kpuzzle.defaultPattern().applyAlg(buildCaseSetupAlg(corner));
    expect([4, 5, 6, 7].filter((c) => cornerCase.patternData.CORNERS.pieces[c] !== c).length).toBe(1);
    // Views: first layer = D-index pieces; f2l greys out the U (last) layer.
    const fl = academyStepMask("first-layer");
    expect(fl.orbits.CORNERS.pieces[5]!.facelets).toEqual(["regular", "regular", "regular"]);
    expect(fl.orbits.CORNERS.pieces[0]!.facelets).toEqual(["ignored", "ignored", "ignored"]);
    expect(fl.orbits.EDGES.pieces[9]!.facelets).toEqual(["ignored", "ignored"]);
    const f2l = academyStepMask("f2l");
    expect(f2l.orbits.EDGES.pieces[9]!.facelets).toEqual(["regular", "regular"]);
    expect(f2l.orbits.EDGES.pieces[0]!.facelets).toEqual(["ignored", "ignored"]);
    expect(f2l.orbits.CORNERS.pieces[0]!.facelets).toEqual(["ignored", "ignored", "ignored"]);
  });

  const zetaCornersStep = () => ZETA_SLOTTING.steps.find((s) => s.id === "zeta-corners")!;

  it("Zeta Slotting's corner algs never disturb the already-seated FR edge or the cross", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    for (const a of zetaCornersStep().algs) {
      const { tokens } = parseDecoratedAlg(a.alg);
      const setup = kpuzzle.defaultPattern().applyAlg(buildCaseSetupAlg(tokens.join(" ")));
      const d = setup.patternData;
      const isLeft = a.id.startsWith("left-");
      const frEdgeHome = isLeft ? d.EDGES.pieces[9] === 9 && d.EDGES.orientation[9] === 0 : d.EDGES.pieces[8] === 8 && d.EDGES.orientation[8] === 0;
      expect(`${a.id}: FR/FL edge home`).toBe(`${a.id}: FR/FL edge home`);
      expect(frEdgeHome).toBe(true);
      for (let c = 4; c < 8; c++) {
        // the target corner (4 for right-hand cases, 5 for the mirror) is allowed to move; the other 3 D-corners must not.
        if ((isLeft && c === 5) || (!isLeft && c === 4)) continue;
        expect(`${a.id}: corner ${c} untouched`).toBe(`${a.id}: corner ${c} untouched`);
        expect(d.CORNERS.pieces[c] === c && d.CORNERS.orientation[c] === 0).toBe(true);
      }
    }
  });

  it("Zeta Slotting's 3 right-hand corner cases cover white pointing up / front / right", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const CORNERS = ["URF", "UBR", "ULB", "UFL", "DFR", "DLF", "DBL", "DRB"];
    const CORNER_FACES = CORNERS.map((n) => n.split(""));
    const faces = new Set<string>();
    for (const id of ["up", "front", "right"]) {
      const alg = zetaCornersStep().algs.find((a) => a.id === id)!;
      const { tokens } = parseDecoratedAlg(alg.alg);
      const setup = kpuzzle.defaultPattern().applyAlg(buildCaseSetupAlg(tokens.join(" ")));
      const slot = setup.patternData.CORNERS.pieces.indexOf(4);
      const ori = setup.patternData.CORNERS.orientation[slot];
      faces.add(CORNER_FACES[slot][ori % 3]);
    }
    expect(faces).toEqual(new Set(["U", "F", "R"]));
  });

  it("Zeta Slotting's 3 left-hand corner cases cover white pointing up / front / left", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const CORNERS = ["URF", "UBR", "ULB", "UFL", "DFR", "DLF", "DBL", "DRB"];
    const CORNER_FACES = CORNERS.map((n) => n.split(""));
    const faces = new Set<string>();
    for (const id of ["left-up", "left-front", "left-left"]) {
      const alg = zetaCornersStep().algs.find((a) => a.id === id)!;
      const { tokens } = parseDecoratedAlg(alg.alg);
      const setup = kpuzzle.defaultPattern().applyAlg(buildCaseSetupAlg(tokens.join(" ")));
      const slot = setup.patternData.CORNERS.pieces.indexOf(5);
      faces.add(CORNER_FACES[slot][setup.patternData.CORNERS.orientation[slot] % 3]);
    }
    expect(faces).toEqual(new Set(["U", "F", "L"]));
  });

  it("F2L lesson's set-up cases each reduce to a basic insert without moving the cross", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const setup = F2L_METHOD.steps[1];
    // The two inserts' distinguishing tail — matched ends "R U' R'", split ends "R U R'"
    // (see F2L_METHOD.steps[0]) — set-up cases prepend alignment/extraction moves but
    // always end in one of these two.
    const tails = ["R U' R'", "R U R'"];
    for (const a of setup.algs) {
      const { tokens } = parseDecoratedAlg(a.alg);
      const p = kpuzzle.defaultPattern().applyAlg(buildCaseSetupAlg(tokens.join(" ")));
      const crossOk = [4, 5, 6, 7].every((e) => p.patternData.EDGES.pieces[e] === e && p.patternData.EDGES.orientation[e] === 0);
      expect(`${a.id}: cross intact`).toBe(`${a.id}: cross intact`);
      expect(crossOk).toBe(true);
      const tail = tokens.slice(-3).join(" ");
      expect(`${a.id} tail: ${tail}`).toBe(`${a.id} tail: ${tails.find((t) => t === tail) ?? `expected one of ${tails.join(" / ")}`}`);
    }
  });

  it("step views follow the curriculum: OLL-style for orientation, corner-only for CP", () => {
    expect(FOUR_LOOK_LL_CORNERS_FIRST.steps.map((s) => s.view)).toEqual([
      "oll-corners",
      "oll",
      "corners",
      "full",
    ]);
    // "oll-corners": LL corners primary-sticker-only (OLL look), LL edges blacked out, F2L in full color.
    const co = academyStepMask("oll-corners");
    expect(co.orbits.CORNERS.pieces[0]!.facelets).toEqual(["regular", "ignored", "ignored"]);
    expect(co.orbits.EDGES.pieces[0]!.facelets).toEqual(["ignored", "ignored"]);
    expect(co.orbits.EDGES.pieces[5]!.facelets).toEqual(["regular", "regular"]);
    // "oll": classic OLL — LL edges also show their primary sticker; F2L stays in full color.
    const oll = academyStepMask("oll");
    expect(oll.orbits.EDGES.pieces[0]!.facelets).toEqual(["regular", "ignored"]);
    expect(oll.orbits.CORNERS.pieces[0]!.facelets).toEqual(["regular", "ignored", "ignored"]);
    expect(oll.orbits.CORNERS.pieces[5]!.facelets).toEqual(["regular", "regular", "regular"]);
    expect(oll.orbits.CENTERS.pieces[2]!.facelets[0]).toBe("regular");
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

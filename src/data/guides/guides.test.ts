/**
 * The guides' claims, checked against the engine. Every case card says
 * "you see X, hold it like Y, do Z" — these tests apply the card's scene
 * to a real cube and assert that X is what's there and that Z solves it.
 * A prose change that no longer matches the cube fails here.
 *
 * Frame: every scene starts with z2 (white on the bottom), so cubing.js's
 * U-layer pieces (indices 0-3, the WHITE ones) sit in the D slots and the
 * D-layer pieces (4-7, YELLOW) in the U slots. Slot names below are
 * SPATIAL (where you'd point on the picture), piece names are cubing.js's.
 */

import { describe, expect, it } from "bun:test";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPattern } from "cubing/kpuzzle";
import { GUIDES, guideById, type Guide, type GuideCase, type GuideDemo } from "./index";
import { LAYER_BY_LAYER_GUIDE } from "./layer-by-layer";
import { LAST_LAYER_GUIDE } from "./last-layer";
import { BEGINNER_F2L_GUIDE } from "./beginner-f2l";
import { ZETA_SLOTTING_GUIDE } from "./zeta-slotting";
import { algTokens, guideSetup } from "./helpers";
import { parseMove } from "../../logic/moveParser";
import { ACADEMY_LESSONS } from "../academy";
import { guideMask, type GuideMaskKind } from "../../logic/guideMasks";

const EDGES = ["UF", "UR", "UB", "UL", "DF", "DR", "DB", "DL", "FR", "FL", "BR", "BL"];
const CORNERS = ["URF", "UBR", "ULB", "UFL", "DFR", "DLF", "DBL", "DRB"];
const EDGE_FACES = EDGES.map((n) => n.split(""));
const CORNER_FACES = CORNERS.map((n) => n.split(""));
const slotE = (name: string) => EDGES.indexOf(name);
const slotC = (name: string) => CORNERS.indexOf(name);

const kpuzzle = await cube3x3x3.kpuzzle();
const solved = () => kpuzzle.defaultPattern();
const SOLVED_Z2 = solved().applyAlg("z2");

/** Where piece `piece` currently is, and which face its primary (index-0: white for 0-3, yellow for 4-7) sticker points to. */
function locateEdge(p: KPattern, piece: number): { slot: string; face: string } {
  const slot = p.patternData.EDGES.pieces.indexOf(piece);
  return { slot: EDGES[slot], face: EDGE_FACES[slot][p.patternData.EDGES.orientation[slot] % 2] };
}
function locateCorner(p: KPattern, piece: number): { slot: string; face: string } {
  const slot = p.patternData.CORNERS.pieces.indexOf(piece);
  return { slot: CORNERS[slot], face: CORNER_FACES[slot][p.patternData.CORNERS.orientation[slot] % 3] };
}
/** Spatial-U-slot corners: which face each yellow corner's yellow sticker points to, keyed by slot. */
function yellowCornerFaces(p: KPattern): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slot of [0, 1, 2, 3]) out[CORNERS[slot]] = CORNER_FACES[slot][p.patternData.CORNERS.orientation[slot] % 3];
  return out;
}
function yellowEdgeFaces(p: KPattern): Record<string, string> {
  const out: Record<string, string> = {};
  for (const slot of [0, 1, 2, 3]) out[EDGES[slot]] = EDGE_FACES[slot][p.patternData.EDGES.orientation[slot] % 2];
  return out;
}
const isSolved = (p: KPattern) => p.experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true });
const scene = (d: GuideDemo) => solved().applyAlg(d.setup ?? "");
const after = (d: GuideDemo) => scene(d).applyAlg(d.alg);
const whiteEdgesHome = (p: KPattern) =>
  [0, 1, 2, 3].every((piece) => {
    const slot = p.patternData.EDGES.pieces.indexOf(piece);
    return SOLVED_Z2.patternData.EDGES.pieces[slot] === piece && p.patternData.EDGES.orientation[slot] === 0;
  });

function* allDemos(guide: Guide): Generator<{ where: string; demo: GuideDemo }> {
  if (guide.hero) yield { where: `${guide.id}/hero`, demo: guide.hero };
  for (const s of guide.sections) {
    for (const b of s.blocks) {
      if (b.kind === "demo") yield { where: `${guide.id}/${s.id}`, demo: b.demo };
      if (b.kind === "demoGrid") for (const d of b.demos) yield { where: `${guide.id}/${s.id}`, demo: d };
      if (b.kind === "callout" && b.demo) yield { where: `${guide.id}/${s.id}/callout`, demo: b.demo };
      if (b.kind === "cases") for (const c of b.cases) yield { where: `${guide.id}/${s.id}/${c.id}`, demo: c.demo };
    }
  }
}
function* allCases(guide: Guide): Generator<GuideCase> {
  for (const s of guide.sections) for (const b of s.blocks) if (b.kind === "cases") yield* b.cases;
}
const caseById = (guide: Guide, id: string): GuideCase => {
  for (const c of allCases(guide)) if (c.id === id) return c;
  throw new Error(`no case ${id} in ${guide.id}`);
};

describe("guide data integrity", () => {
  it("guide, section and case ids are unique; links resolve", () => {
    expect(new Set(GUIDES.map((g) => g.id)).size).toBe(GUIDES.length);
    for (const g of GUIDES) {
      const sectionIds = g.sections.map((s) => s.id);
      expect(new Set(sectionIds).size).toBe(sectionIds.length);
      const caseIds = [...allCases(g)].map((c) => c.id);
      expect(new Set(caseIds).size).toBe(caseIds.length);
      for (const id of g.prerequisites ?? []) expect(guideById(id)).toBeDefined();
      for (const s of g.sections) {
        for (const b of s.blocks) {
          if (b.kind === "guideLink") expect(guideById(b.guideId)).toBeDefined();
          if (b.kind === "practice") {
            const lesson = ACADEMY_LESSONS.find((l) => l.id === b.lessonId);
            expect(lesson?.steps.some((st) => st.id === b.stepId)).toBe(true);
          }
        }
      }
    }
  });

  it("every algorithm and setup is valid notation", () => {
    for (const g of GUIDES) {
      for (const c of allCases(g)) for (const t of algTokens(c.alg)) expect(`${c.id}: ${t}`).toBe(`${c.id}: ${parseMove(t)?.raw}`);
      for (const { where, demo } of allDemos(g)) {
        for (const t of algTokens(demo.alg)) expect(`${where}: ${t}`).toBe(`${where}: ${parseMove(t)?.raw}`);
        for (const t of algTokens(demo.setup ?? "")) expect(`${where}: ${t}`).toBe(`${where}: ${parseMove(t)?.raw}`);
        // Every solving-guide scene is in the z2 frame (looping single-move demos have no scene).
        if (g.category === "learn" && !demo.loop) expect(`${where}: ${demo.setup?.split(" ")[0]}`).toBe(`${where}: z2`);
      }
    }
  });

  it("case demos play the case's own algorithm", () => {
    for (const g of GUIDES) for (const c of allCases(g)) expect(c.demo.alg).toBe(algTokens(c.alg).join(" "));
  });

  it("guideSetup builds z2 + inverse, spelling half turns as U2", () => {
    expect(guideSetup("(R U R' U') F2")).toBe("z2 F2 U R U' R'");
    expect(isSolved(solved().applyAlg(guideSetup("R U2 R' U' M U r'")).applyAlg("R U2 R' U' M U r'"))).toBe(true);
  });

  it("masks have the right orbit sizes (4 facelets per center)", () => {
    const kinds: GuideMaskKind[] = ["cross", "cross-edge-left", "white-edge-0", "white-edge-3", "first-layer", "cross-edge", "f2l", "f2l-pair", "ll-corners-orient", "ll-orient", "ll-corners", "ll", "full"];
    for (const k of kinds) {
      const m = guideMask(k);
      expect(m.orbits.EDGES.pieces.length).toBe(12);
      expect(m.orbits.CORNERS.pieces.length).toBe(8);
      expect(m.orbits.CENTERS.pieces.length).toBe(6);
      for (const c of m.orbits.CENTERS.pieces) expect(c!.facelets.length).toBe(4);
    }
  });

  it("white-edge-N shows the centres and exactly that one edge", () => {
    const m = guideMask("white-edge-2");
    const shown = m.orbits.EDGES.pieces.map((e, i) => (e!.facelets.every((f) => f === "regular") ? i : -1)).filter((i) => i >= 0);
    expect(shown).toEqual([2]);
    for (const c of m.orbits.CORNERS.pieces) expect(c!.facelets.every((f) => f === "ignored")).toBe(true);
    for (const c of m.orbits.CENTERS.pieces) expect(c!.facelets.every((f) => f === "regular")).toBe(true);
  });

  it("every default-scene case (setup = inverse of alg) ends solved", () => {
    for (const g of GUIDES) {
      for (const c of allCases(g)) {
        if (c.demo.setup === guideSetup(c.alg)) expect(`${c.id}: ${isSolved(after(c.demo))}`).toBe(`${c.id}: true`);
      }
    }
  });
});

describe("Layer by layer — the cross", () => {
  const g = LAYER_BY_LAYER_GUIDE;
  const target = 0; // the white/green edge
  const TOP = ["UF", "UR", "UB", "UL"];
  /** How many of the four white edges sit in the top layer with white facing up. */
  const petals = (p: KPattern) => [0, 1, 2, 3].filter((piece) => {
    const loc = locateEdge(p, piece);
    return TOP.includes(loc.slot) && loc.face === "U";
  }).length;

  it.each([
    // id, where the target edge starts (slot + which face its white sticker points to), moves, mask
    ["daisy-mid-right", "FR", "F", 1, "white-edge-0"],
    ["daisy-mid-left", "FL", "F", 1, "white-edge-0"],
    ["daisy-mid-front", "FL", "L", 1, "white-edge-0"],
    ["daisy-half-right", "DR", "D", 1, "white-edge-0"],
    ["daisy-half-left", "DL", "D", 1, "white-edge-0"],
    ["daisy-half-front", "DF", "D", 1, "white-edge-0"],
    ["daisy-bottom-flipped", "DF", "F", 2, "white-edge-0"],
    ["daisy-top-sideways", "UF", "F", 2, "white-edge-0"],
    ["daisy-blocked-one", "FR", "F", 2, "cross"],
    ["daisy-blocked-two", "DF", "F", 4, "cross"],
  ])("%s: starts as described and ends as a petal (white up) in the stated number of moves", (id, slot, face, moves, mask) => {
    const c = caseById(g, id);
    expect(locateEdge(scene(c.demo), target)).toEqual({ slot, face });
    expect(algTokens(c.alg).length).toBe(moves);
    expect(c.demo.mask as string).toBe(mask);
    const loc = locateEdge(after(c.demo), target);
    expect(TOP).toContain(loc.slot);
    expect(loc.face).toBe("U");
  });

  it("the one-move rule: the face carrying the edge's coloured sticker is the face turned", () => {
    for (const [id, face] of [["daisy-mid-right", "R"], ["daisy-mid-left", "L"], ["daisy-mid-front", "F"]]) {
      expect(algTokens(caseById(g, id).alg)[0][0]).toBe(face);
    }
  });

  it("bottom-layer half turns: the edge starts on the bottom with white down and needs no other move", () => {
    for (const id of ["daisy-half-right", "daisy-half-left", "daisy-half-front"]) expect(algTokens(caseById(g, id).alg)[0]).toMatch(/2$/);
  });

  it("the mirrored routes named in the two-move notes work too", () => {
    for (const [id, route] of [["daisy-bottom-flipped", "F L'"], ["daisy-top-sideways", "F' L'"]]) {
      const loc = locateEdge(scene(caseById(g, id).demo).applyAlg(route), target);
      expect(TOP).toContain(loc.slot);
      expect(loc.face).toBe("U");
    }
  });

  it.each(["daisy-blocked-one", "daisy-blocked-two"])("%s: three petals are up, the U turns finish the daisy, and skipping them breaks a petal", (id) => {
    const c = caseById(g, id);
    expect(petals(scene(c.demo))).toBe(3);
    expect(petals(after(c.demo))).toBe(4);
    const withoutU = algTokens(c.alg).filter((t) => t[0] !== "U").join(" ");
    expect(petals(scene(c.demo).applyAlg(withoutU))).toBeLessThan(4);
  });

  it.each([
    ["cross-aligned", "UF"],
    ["cross-unaligned", "UL"],
  ])("%s: the petal (white up at %s) goes down and completes the cross", (id, slot) => {
    const c = caseById(g, id);
    expect(locateEdge(scene(c.demo), target)).toEqual({ slot, face: "U" });
    expect(whiteEdgesHome(after(c.demo))).toBe(true);
  });

  it("cross-advanced: four petals up, two above their own centre and two swapped; the alg completes the cross (cube ends turned y')", () => {
    const c = caseById(g, "cross-advanced");
    const start = scene(c.demo);
    expect(petals(start)).toBe(4);
    const homeU = (piece: number) => EDGES[SOLVED_Z2.patternData.EDGES.pieces.indexOf(piece)].replace("D", "U");
    const settled = [0, 1, 2, 3].filter((piece) => locateEdge(start, piece).slot === homeU(piece));
    expect(settled.length).toBe(2);
    expect(c.demo.mask).toBe("cross");
    // The alg holds three y rotations, so the finished cross is compared against a solved cube turned the same way.
    const solvedTurned = solved().applyAlg("z2 y y y");
    const end = after(c.demo);
    for (const piece of [0, 1, 2, 3]) {
      const slot = end.patternData.EDGES.pieces.indexOf(piece);
      expect(solvedTurned.patternData.EDGES.pieces[slot]).toBe(piece);
      expect(end.patternData.EDGES.orientation[slot]).toBe(0);
    }
  });
});

describe("Layer by layer — first-layer corners", () => {
  const g = LAYER_BY_LAYER_GUIDE;
  const corner = 3; // the white/green/orange corner — front-right slot in the z2 frame

  it.each([
    ["corner-right", "R"],
    ["corner-up", "U"],
    ["corner-front", "F"],
  ])("%s: corner above the front-right slot with white facing %s, then solved", (id, face) => {
    const c = caseById(g, id);
    expect(locateCorner(scene(c.demo), corner)).toEqual({ slot: "URF", face });
    expect(isSolved(after(c.demo))).toBe(true);
  });

  it("corner-stuck: starts twisted in its slot, one sexy move pops it to the top with the cross intact", () => {
    const c = caseById(g, "corner-stuck");
    expect(locateCorner(scene(c.demo), corner).slot).toBe("DFR");
    expect(locateCorner(scene(c.demo), corner).face).not.toBe("D");
    const p = after(c.demo);
    expect(["URF", "UBR", "ULB", "UFL"]).toContain(locateCorner(p, corner).slot);
    expect(whiteEdgesHome(p)).toBe(true);
  });
});

describe("Layer by layer — second-layer edges", () => {
  const g = LAYER_BY_LAYER_GUIDE;
  it.each([
    ["edge-right", 9], // spatial front-right edge = cubing's FL piece
    ["edge-left", 8], // spatial front-left edge = cubing's FR piece
  ])("%s: the edge sits at the top-front, front colour facing front, then solved", (id, piece) => {
    const c = caseById(g, id);
    expect(locateEdge(scene(c.demo), piece)).toEqual({ slot: "UF", face: "F" });
    expect(isSolved(after(c.demo))).toBe(true);
  });
});

describe("Last layer — orient corners (edges ignored)", () => {
  const g = LAST_LAYER_GUIDE;
  it.each([
    ["co-headlights", { URF: "U", UBR: "U", ULB: "L", UFL: "L" }],
    ["co-a", { URF: "U", UBR: "U", ULB: "B", UFL: "F" }],
    ["co-b", { URF: "U", UBR: "R", ULB: "U", UFL: "F" }],
    ["co-sune", { URF: "F", UBR: "R", ULB: "B", UFL: "U" }],
    ["co-antisune", { URF: "R", UBR: "U", ULB: "L", UFL: "F" }],
    ["co-pi", { URF: "F", UBR: "B", ULB: "L", UFL: "L" }],
    ["co-h", { URF: "F", UBR: "B", ULB: "B", UFL: "F" }],
  ])("%s: yellow corner stickers point where the card says", (id, expected) => {
    const c = caseById(g, id);
    expect(yellowCornerFaces(scene(c.demo))).toEqual(expected);
    expect(isSolved(after(c.demo))).toBe(true);
  });

  it("the seven cases cover all seven corner-orientation patterns exactly once", () => {
    const signatures = new Set<string>();
    for (const id of ["co-headlights", "co-a", "co-b", "co-sune", "co-antisune", "co-pi", "co-h"]) {
      const p = scene(caseById(g, id).demo);
      // Canonical signature: orientation vector up to U-rotation.
      const ori = [0, 1, 2, 3].map((s) => p.patternData.CORNERS.orientation[s]);
      const rotations = [0, 1, 2, 3].map((k) => [...ori.slice(k), ...ori.slice(0, k)].join(""));
      signatures.add(rotations.sort()[0]);
    }
    expect(signatures.size).toBe(7);
  });
});

describe("Last layer — orient edges", () => {
  const g = LAST_LAYER_GUIDE;
  it.each([
    ["eo-adjacent", { UF: "F", UR: "R", UB: "U", UL: "U" }],
    ["eo-opposite", { UF: "F", UR: "U", UB: "B", UL: "U" }],
    ["eo-all", { UF: "F", UR: "R", UB: "B", UL: "L" }],
  ])("%s: flipped edges are where the card says; corners stay oriented", (id, expected) => {
    const c = caseById(g, id);
    const s = scene(c.demo);
    expect(yellowEdgeFaces(s)).toEqual(expected);
    expect(Object.values(yellowCornerFaces(s)).every((f) => f === "U")).toBe(true);
    expect(isSolved(after(c.demo))).toBe(true);
  });
});

describe("Last layer — permute corners", () => {
  const g = LAST_LAYER_GUIDE;
  const cornerAt = (p: KPattern, slot: string) => p.patternData.CORNERS.pieces[slotC(slot)];
  const home = (slot: string) => SOLVED_Z2.patternData.CORNERS.pieces[slotC(slot)];

  it("cp-adjacent (A + B): the two left corners are correct, the two right ones swap", () => {
    const s = scene(caseById(g, "cp-adjacent").demo);
    expect(cornerAt(s, "ULB")).toBe(home("ULB"));
    expect(cornerAt(s, "UFL")).toBe(home("UFL"));
    expect(cornerAt(s, "URF")).toBe(home("UBR"));
    expect(cornerAt(s, "UBR")).toBe(home("URF"));
    expect(isSolved(after(caseById(g, "cp-adjacent").demo))).toBe(true);
  });

  it("cp-diagonal (B + A): front-left and back-right are correct, front-right and back-left swap", () => {
    const s = scene(caseById(g, "cp-diagonal").demo);
    expect(cornerAt(s, "UFL")).toBe(home("UFL"));
    expect(cornerAt(s, "UBR")).toBe(home("UBR"));
    expect(cornerAt(s, "URF")).toBe(home("ULB"));
    expect(cornerAt(s, "ULB")).toBe(home("URF"));
    expect(isSolved(after(caseById(g, "cp-diagonal").demo))).toBe(true);
  });
});

describe("Last layer — permute edges", () => {
  const g = LAST_LAYER_GUIDE;
  const edgeAt = (p: KPattern, slot: string) => p.patternData.EDGES.pieces[slotE(slot)];
  const home = (slot: string) => SOLVED_Z2.patternData.EDGES.pieces[slotE(slot)];

  it("ep-ua: back edge correct, the front edge belongs on the right", () => {
    const s = scene(caseById(g, "ep-ua").demo);
    expect(edgeAt(s, "UB")).toBe(home("UB"));
    expect(edgeAt(s, "UF")).toBe(home("UR"));
  });
  it("ep-ub: back edge correct, the front edge belongs on the left", () => {
    const s = scene(caseById(g, "ep-ub").demo);
    expect(edgeAt(s, "UB")).toBe(home("UB"));
    expect(edgeAt(s, "UF")).toBe(home("UL"));
  });
  it("ep-h: front↔back and left↔right swap", () => {
    const s = scene(caseById(g, "ep-h").demo);
    expect(edgeAt(s, "UF")).toBe(home("UB"));
    expect(edgeAt(s, "UB")).toBe(home("UF"));
    expect(edgeAt(s, "UR")).toBe(home("UL"));
    expect(edgeAt(s, "UL")).toBe(home("UR"));
  });
  it("ep-z: front↔left and back↔right swap", () => {
    const s = scene(caseById(g, "ep-z").demo);
    expect(edgeAt(s, "UF")).toBe(home("UL"));
    expect(edgeAt(s, "UL")).toBe(home("UF"));
    expect(edgeAt(s, "UB")).toBe(home("UR"));
    expect(edgeAt(s, "UR")).toBe(home("UB"));
  });
  it("all four end solved", () => {
    for (const id of ["ep-ua", "ep-ub", "ep-h", "ep-z"]) expect(isSolved(after(caseById(g, id).demo))).toBe(true);
  });
});

describe("Beginner F2L", () => {
  const g = BEGINNER_F2L_GUIDE;
  // Right-hand pair: cubing's UFL corner (3) + FL edge (9) = the spatial front-right slot after z2.
  // Left-hand pair: URF corner (0) + FR edge (8) = spatial front-left.
  it.each([
    ["matched-right", 3, "URF", "F", 9, "UR", "U"],
    ["matched-left", 0, "UFL", "F", 8, "UL", "U"],
    ["split-right", 3, "URF", "R", 9, "UB", "U"],
    ["split-left", 0, "UFL", "L", 8, "UB", "U"],
    ["corner-in-slot-right", 3, "DFR", "R", 9, "UR", "U"],
    ["corner-in-slot-front", 3, "DFR", "F", 9, "UR", "U"],
    ["edge-in-slot", 3, "URF", "F", 9, "FR", "F"],
    ["both-in-slot", 3, "DFR", "R", 9, "FR", "F"],
    ["apart-white-front", 3, "URF", "F", 9, "UB", "U"],
    ["apart-white-right", 3, "URF", "R", 9, "UL", "U"],
    ["joined-wrong", 3, "URF", "R", 9, "UR", "U"],
    ["white-up-edge-right", 3, "URF", "U", 9, "UR", "U"],
    ["white-up-edge-left", 3, "URF", "U", 9, "UL", "U"],
  ])("%s: corner %i at %s (white → %s), edge %i at %s (front colour → %s); then solved", (id, corner, cSlot, cFace, edge, eSlot, eFace) => {
    const c = caseById(g, id);
    const s = scene(c.demo);
    expect(locateCorner(s, corner)).toEqual({ slot: cSlot, face: cFace });
    expect(locateEdge(s, edge)).toEqual({ slot: eSlot, face: eFace });
    // Everything except that pair is already solved in the scene (cross + the other three pairs).
    for (const piece of [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11].filter((p) => p !== edge)) {
      const slot = s.patternData.EDGES.pieces.indexOf(piece);
      if (piece >= 4 && piece <= 7) continue; // last-layer edges are free
      expect(SOLVED_Z2.patternData.EDGES.pieces[slot]).toBe(piece);
    }
    expect(isSolved(after(c.demo))).toBe(true);
  });
});

describe("Zeta Slotting — insert the edges", () => {
  const g = ZETA_SLOTTING_GUIDE;
  // Colour letters are cubing.js's piece names; in the z2 frame the front centre is F, the right centre L, the left centre R.
  /** Where each of a slot edge's two colours points: e.g. { F: "U", L: "F" } = the F-colour sticker on top, the L-colour one on the front. */
  const stickers = (p: KPattern, piece: number): { slot: string; faces: Record<string, string> } => {
    const slot = p.patternData.EDGES.pieces.indexOf(piece);
    const o = p.patternData.EDGES.orientation[slot] % 2;
    const home = EDGES[piece];
    return { slot: EDGES[slot], faces: { [home[0]]: EDGES[slot][o], [home[1]]: EDGES[slot][1 - o] } };
  };

  it.each([
    // id, edge piece (9 = the front-right slot's edge, 8 = the front-left one's), colour on top, colour on the front, mask
    ["edge-right", 9, "F", "L", "cross-edge"],
    ["edge-left", 8, "F", "R", "cross-edge-left"],
    ["edge-unoriented-right", 9, "L", "F", "cross-edge"],
    ["edge-unoriented-left", 8, "R", "F", "cross-edge-left"],
  ])("%s: the edge starts above the front face as described, and goes in with the cross intact", (id, piece, top, front, mask) => {
    const c = caseById(g, id);
    const { slot, faces } = stickers(scene(c.demo), piece as number);
    expect(slot).toBe("UF");
    expect(Object.entries(faces).find(([, f]) => f === "U")![0]).toBe(top);
    expect(Object.entries(faces).find(([, f]) => f === "F")![0]).toBe(front);
    expect(c.demo.mask as string).toBe(mask);
    const end = after(c.demo);
    expect(stickers(end, piece as number)).toEqual({ slot: piece === 9 ? "FR" : "FL", faces: piece === 9 ? { F: "F", L: "R" } : { F: "F", R: "L" } });
    expect(whiteEdgesHome(end)).toBe(true);
  });

  it("the oriented inserts use no F or B, the unoriented ones do", () => {
    const uses = (id: string) => algTokens(caseById(g, id).alg).some((t) => "FB".includes(t[0]));
    for (const id of ["edge-right", "edge-left"]) expect(uses(id)).toBe(false);
    for (const id of ["edge-unoriented-right", "edge-unoriented-left"]) expect(uses(id)).toBe(true);
  });

  it("the edge masks hide every corner and show the cross plus only the case's own slot edge", () => {
    for (const [kind, edge] of [["cross-edge", 9], ["cross-edge-left", 8]] as const) {
      const m = guideMask(kind);
      for (const c of m.orbits.CORNERS.pieces) expect(c!.facelets.every((f) => f === "ignored")).toBe(true);
      const shown = m.orbits.EDGES.pieces.map((e, i) => (e!.facelets.every((f) => f === "regular") ? i : -1)).filter((i) => i >= 0);
      expect(shown).toEqual([0, 1, 2, 3, edge]);
    }
  });
});

describe("Zeta Slotting — insert the corners", () => {
  const g = ZETA_SLOTTING_GUIDE;

  it.each([
    // id, corner piece, the slot it starts above, which face its white sticker points to, the seated edge (piece, its slot)
    ["up", 3, "URF", "U", 9, 8],
    ["front", 3, "URF", "F", 9, 8],
    ["right", 3, "URF", "R", 9, 8],
    ["left-up", 0, "UFL", "U", 8, 9],
    ["left-front", 0, "UFL", "F", 8, 9],
    ["left-left", 0, "UFL", "L", 8, 9],
  ])("%s: the corner starts above its slot with white on %s, the seated edge stays put, and it ends solved", (id, corner, slot, face, edge, edgeSlot) => {
    const c = caseById(g, id);
    const p = scene(c.demo);
    expect(locateCorner(p, corner as number)).toEqual({ slot, face });
    expect(p.patternData.EDGES.pieces[edgeSlot as number]).toBe(edge as number);
    expect(p.patternData.EDGES.orientation[edgeSlot as number]).toBe(0);
    expect(isSolved(after(c.demo))).toBe(true);
  });

  it("each left-hand algorithm is the mirror image of its right-hand twin", () => {
    const mirror = (alg: string) => algTokens(alg).map((t) => {
      const face = t[0] === "R" ? "L" : t[0] === "L" ? "R" : t[0];
      const suffix = t.slice(1);
      return face + (suffix === "" ? "'" : suffix === "'" ? "" : suffix);
    }).join(" ");
    for (const [left, right] of [["left-up", "up"], ["left-front", "front"], ["left-left", "right"]]) {
      expect(algTokens(caseById(g, left).alg).join(" ")).toBe(mirror(caseById(g, right).alg));
    }
  });
});

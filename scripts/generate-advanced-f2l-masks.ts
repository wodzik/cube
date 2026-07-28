/**
 * One-off generator: adds a per-case displayConfigOverride (piece mask) to
 * Advanced F2L cases whose default-variant setup scramble happens to leave
 * a SECOND, unrelated corner+edge pair sitting fully assembled somewhere
 * on the cube — visually indistinguishable from a real F2L pair, and
 * confusing about which pair the case is actually about (reported by the
 * user: "czesto na poczatku algorytmu mamy 2 rozne pary, co moze byc
 * mylace jakiego przypadku sie uczymy").
 *
 * Method:
 *  - advanced-f2l.json has explicit subgroups (front-right/front-left/
 *    back-left/back-right) — the subgroup IS the target pair identity.
 *  - f2l-advanced.json (J Perm's sheet) is a flat, single-slot set — the
 *    target is always front-right (verified below: for every case, the
 *    front-right identity's corner or edge is never simply left untouched
 *    at home while the scramble happens elsewhere).
 *  - For each case's DEFAULT variant (the one actually rendered on the
 *    card/practice view), compute the setup via the app's own
 *    buildCaseSetupAlg, simulate it, and check each of the OTHER 3 pair
 *    identities: is its corner AND edge currently sitting together in some
 *    D-layer+middle-layer slot that ISN'T that pair's own home? If so,
 *    that pair is a "displaced" — genuinely confusing — visible pair, and
 *    gets added to a per-case mask that hides it (piece-identity based, so
 *    it stays hidden as pieces move during live practice too) while
 *    replicating the group's existing "F2L" named-stickering look
 *    (D-layer + middle-layer bright, last layer dimmed) for everything
 *    else, since that's what these cases display today and this should
 *    only ADD hiding, not otherwise change the picture.
 *
 * Run: bun scripts/generate-advanced-f2l-masks.ts
 * Writes src/algs/advanced-f2l.json and src/algs/f2l-advanced.json in place.
 */
import { buildCaseSetupAlg } from "../src/logic/moveParser";
import { createSolvedState, applyMoveToState, type LiveCubeState } from "../src/logic/stageDetection/liveCubeState";
import type { FaceletMask, StickeringMaskOrbits } from "../src/types/cube";
import advancedF2lJson from "../src/algs/advanced-f2l.json";
import fperAdvJson from "../src/algs/f2l-advanced.json";
import { writeFileSync } from "fs";

// liveCubeState indexing: CORNERS 4=DFR 5=DLF 6=DBL 7=DRB, EDGES 8=FR 9=FL 10=BR 11=BL.
const PAIR_IDENTITIES: Record<string, { corner: number; edge: number }> = {
  "front-right": { corner: 4, edge: 8 },
  "front-left": { corner: 5, edge: 9 },
  "back-left": { corner: 6, edge: 11 },
  "back-right": { corner: 7, edge: 10 },
};
const PAIR_NAMES = Object.keys(PAIR_IDENTITIES);
const HOME_INDEX: Record<string, number> = { "front-right": 0, "front-left": 1, "back-left": 2, "back-right": 3 };

async function stateFor(alg: string): Promise<LiveCubeState> {
  const setup = buildCaseSetupAlg(alg);
  let s = await createSolvedState();
  for (const m of setup.trim().split(/\s+/).filter(Boolean)) s = applyMoveToState(s, m);
  return s;
}

function currentSlotOf(pieces: readonly number[], identity: number): number {
  return pieces.indexOf(identity);
}

/** Relative slot (0=FR,1=FL,2=BL,3=BR) this pair's OWN 2 pieces currently occupy TOGETHER, or null if not co-located at all. */
function coLocatedSlot(s: LiveCubeState, pair: { corner: number; edge: number }): number | null {
  const cSlot = currentSlotOf(s.patternData.CORNERS.pieces as unknown as number[], pair.corner);
  const eSlot = currentSlotOf(s.patternData.EDGES.pieces as unknown as number[], pair.edge);
  if (cSlot < 4 || cSlot > 7) return null;
  if (eSlot < 8 || eSlot > 11) return null;
  if (cSlot - 4 !== eSlot - 8) return null;
  return cSlot - 4;
}

/** Non-target pair identities that are co-located somewhere OTHER than their own home — the genuinely confusing, hide-worthy ones. */
function findConfusingPairs(s: LiveCubeState, targetName: string): string[] {
  const confusing: string[] = [];
  for (const name of PAIR_NAMES) {
    if (name === targetName) continue;
    const slot = coLocatedSlot(s, PAIR_IDENTITIES[name]);
    if (slot !== null && slot !== HOME_INDEX[name]) confusing.push(name);
  }
  return confusing;
}

// D-layer corner identities (4-7) and D-layer+middle-layer edge identities (4-7, 8-11) — replicates cubing.js's
// built-in "F2L" named scheme (bottom 2 layers bright, last layer dimmed), see this app's own CubeVisualisation
// stickering="F2L" rendering, verified live via Debug > Try Algorithm.
const F2L_CORNER_IDS = new Set([4, 5, 6, 7]);
const F2L_EDGE_IDS = new Set([4, 5, 6, 7, 8, 9, 10, 11]);

function buildMask(hiddenNames: string[]): StickeringMaskOrbits {
  const hiddenCorners = new Set(hiddenNames.map((n) => PAIR_IDENTITIES[n].corner));
  const hiddenEdges = new Set(hiddenNames.map((n) => PAIR_IDENTITIES[n].edge));
  const corner = (id: number): FaceletMask => (hiddenCorners.has(id) ? "ignored" : F2L_CORNER_IDS.has(id) ? "regular" : "dim");
  const edge = (id: number): FaceletMask => (hiddenEdges.has(id) ? "ignored" : F2L_EDGE_IDS.has(id) ? "regular" : "dim");
  return {
    orbits: {
      EDGES: { pieces: Array.from({ length: 12 }, (_, p) => ({ facelets: [edge(p), edge(p)] })) },
      CORNERS: { pieces: Array.from({ length: 8 }, (_, p) => ({ facelets: [corner(p), corner(p), corner(p)] })) },
      CENTERS: { pieces: Array.from({ length: 6 }, () => ({ facelets: ["regular", "regular", "regular", "regular"] as FaceletMask[] })) },
    },
  };
}

interface RawVariant { alg: string; isDefault: boolean }
interface RawCase { name: string; category?: string; algList: RawVariant[]; displayConfigOverride?: unknown }

async function processCases(cases: RawCase[], targetName: string, label: string): Promise<number> {
  let modified = 0;
  for (const c of cases) {
    const def = c.algList.find((v) => v.isDefault) ?? c.algList[0];
    const s = await stateFor(def.alg);
    const confusing = findConfusingPairs(s, targetName);
    if (confusing.length > 0) {
      c.displayConfigOverride = { stickering: { kind: "mask", pieceGroups: [], rawOverride: buildMask(confusing) } };
      modified++;
      console.log(`${label}/${c.name} [${c.category}] hides: ${confusing.join(", ")}`);
    }
  }
  return modified;
}

// ── Sanity check: verify front-right is a sensible universal target for f2l-advanced.json ──
async function verifyFrontRightTarget(cases: RawCase[]): Promise<void> {
  let suspicious = 0;
  for (const c of cases) {
    const def = c.algList.find((v) => v.isDefault) ?? c.algList[0];
    const s = await stateFor(def.alg);
    const cSlot = currentSlotOf(s.patternData.CORNERS.pieces as unknown as number[], PAIR_IDENTITIES["front-right"].corner);
    const eSlot = currentSlotOf(s.patternData.EDGES.pieces as unknown as number[], PAIR_IDENTITIES["front-right"].edge);
    const untouched = cSlot === 4 && eSlot === 8; // still exactly at home = scramble never touched it
    if (untouched) {
      suspicious++;
      console.warn(`SUSPICIOUS (front-right untouched): ${c.name} [${c.category}] alg="${def.alg}"`);
    }
  }
  console.log(`f2l-advanced.json: ${suspicious}/${cases.length} cases leave front-right fully untouched (should be 0 or near-0 if front-right is really the universal target)`);
}

const advanced = advancedF2lJson as unknown as { subgroups: { id: string; cases: RawCase[] }[] };
const jperm = fperAdvJson as unknown as RawCase[];

await verifyFrontRightTarget(jperm);

let total = 0;
for (const sg of advanced.subgroups) {
  total += await processCases(sg.cases, sg.id, `advanced-f2l/${sg.id}`);
}
total += await processCases(jperm, "front-right", "f2l-advanced");

console.log(`\nTotal cases modified: ${total}`);

// Preserve each bundled file's own pre-existing formatting convention
// (advanced-f2l.json is minified/single-line; f2l-advanced.json is
// pretty-printed) so the diff only shows what actually changed instead of
// reformatting the whole file.
writeFileSync("src/algs/advanced-f2l.json", JSON.stringify(advanced) + "\n");
writeFileSync("src/algs/f2l-advanced.json", JSON.stringify(jperm, null, 2) + "\n");
console.log("Wrote src/algs/advanced-f2l.json and src/algs/f2l-advanced.json");

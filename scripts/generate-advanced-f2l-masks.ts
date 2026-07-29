/**
 * One-off generator: gives every Advanced F2L / J Perm F2L case a uniform,
 * editable baseline mask override — bottom edges + the ONE F2L slot chip
 * matching the case's own subgroup shown (advanced-f2l.json's subgroup ids
 * are already exactly front-right/front-left/back-left/back-right; J
 * Perm's f2l-advanced.json is a flat sheet that's always front-right, see
 * the front-right-never-untouched check this script used to run), centers
 * shown (not dimmed) except the top one (last layer, its center included,
 * is fully hidden — matches the group's default named "F2L" scheme, just
 * now expressed as an editable per-case mask).
 *
 * This intentionally does NOT try to auto-detect a DIFFERENT target pair
 * per case beyond the subgroup itself — earlier attempts at that
 * (cross-variant majority voting) kept getting the specific per-case call
 * wrong in ways only visible by eye. Per the user: apply this
 * subgroup-matching baseline everywhere, then go through the cases BY HAND
 * in the app's own CaseEdit "Advanced" section (MaskPicker) — toggle on
 * any OTHER F2L slot chip a specific case's algorithm actually needs (a
 * "Trapped"/displaced-pair case), toggle any of the "Hide X center" chips
 * if needed — then export the group as JSON and re-import.
 *
 * Run: bun scripts/generate-advanced-f2l-masks.ts
 * Writes src/algs/advanced-f2l.json and src/algs/f2l-advanced.json in place.
 */
import advancedF2lJson from "../src/algs/advanced-f2l.json";
import fperAdvJson from "../src/algs/f2l-advanced.json";
import { writeFileSync } from "fs";

function baselineFor(slotId: string) {
  return {
    kind: "mask",
    pieceGroups: ["d-edges", slotId],
    showCenters: true,
    hiddenCenters: ["center-u"],
  };
}

interface RawCase { name: string; displayConfigOverride?: unknown }

function applyBaseline(cases: RawCase[], slotId: string): number {
  let modified = 0;
  for (const c of cases) {
    c.displayConfigOverride = { stickering: baselineFor(slotId) };
    modified++;
  }
  return modified;
}

interface RawSubgroup { id: string; cases: RawCase[]; displayConfig?: unknown }

const advanced = advancedF2lJson as unknown as { subgroups: RawSubgroup[] };
const jperm = fperAdvJson as unknown as RawCase[];

const SUBGROUP_TO_SLOT: Record<string, string> = {
  "front-right": "f2l-fr",
  "front-left": "f2l-fl",
  "back-left": "f2l-bl",
  "back-right": "f2l-br",
};

let total = 0;
for (const sg of advanced.subgroups) {
  const slotId = SUBGROUP_TO_SLOT[sg.id];
  if (!slotId) throw new Error(`No slot mapping for subgroup "${sg.id}"`);
  total += applyBaseline(sg.cases, slotId);
  // Also match the folder-card TILE shown before drilling into the subgroup
  // (SubgroupGrid/SubgroupCard) — otherwise it kept showing all 4 slots via
  // the group's own default "F2L" scheme while every case inside now shows
  // just its own slot.
  sg.displayConfig = { stickering: baselineFor(slotId) };
}
total += applyBaseline(jperm, "f2l-fr");

console.log(`Total cases modified: ${total}`);

// Preserve each bundled file's own pre-existing formatting convention
// (advanced-f2l.json is minified/single-line; f2l-advanced.json is
// pretty-printed) so the diff only shows what actually changed instead of
// reformatting the whole file.
writeFileSync("src/algs/advanced-f2l.json", JSON.stringify(advanced) + "\n");
writeFileSync("src/algs/f2l-advanced.json", JSON.stringify(jperm, null, 2) + "\n");
console.log("Wrote src/algs/advanced-f2l.json and src/algs/f2l-advanced.json");

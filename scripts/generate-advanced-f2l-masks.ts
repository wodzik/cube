/**
 * One-off generator: gives every Advanced F2L / J Perm F2L case a uniform,
 * editable baseline mask override — bottom edges + the 3 F2L slot chips
 * OTHER than the case's own subgroup shown, centers shown (not dimmed)
 * except the top one (last layer, its center included, is fully hidden —
 * matches the group's default named "F2L" scheme, just now expressed as
 * an editable per-case mask).
 *
 * The subgroup's OWN slot is hidden, not shown — per the user: these
 * subgroup names describe which slot's PHYSICAL SPACE the algorithm uses
 * as scratch space, not which pair it's teaching. A "Front Right" case's
 * actual target pair is a DIFFERENT slot's corner+edge that got displaced
 * through the front-right position; showing the front-right identity
 * (wherever it drifted to) is exactly the confusing, irrelevant clutter
 * this masking effort exists to hide, and the other 3 slots' identities
 * (wherever THEY currently sit) are the genuine, meaningful content.
 *
 * This intentionally does NOT try to auto-detect a DIFFERENT target pair
 * per case beyond "everything except the named slot" — earlier attempts
 * at that (cross-variant majority voting) kept getting the specific
 * per-case call wrong in ways only visible by eye. Per the user: apply
 * this subgroup-matching baseline everywhere, then go through the cases
 * BY HAND in the app's own CaseEdit "Advanced" section (MaskPicker) —
 * toggle chips as a specific case's algorithm actually needs, toggle any
 * of the "Hide X center" chips if needed — then export the group as JSON
 * and re-import.
 *
 * Run: bun scripts/generate-advanced-f2l-masks.ts
 * Writes src/algs/advanced-f2l.json and src/algs/f2l-advanced.json in place.
 */
import advancedF2lJson from "../src/algs/advanced-f2l.json";
import fperAdvJson from "../src/algs/f2l-advanced.json";
import { writeFileSync } from "fs";

const ALL_F2L_SLOTS = ["f2l-fr", "f2l-fl", "f2l-bl", "f2l-br"];

function baselineFor(hiddenSlotId: string) {
  return {
    kind: "mask",
    pieceGroups: ["d-edges", ...ALL_F2L_SLOTS.filter((id) => id !== hiddenSlotId)],
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

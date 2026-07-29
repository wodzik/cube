/**
 * Fixes the unclosed wide-move-rotation cases found by
 * find-unclosed-wide-move-rotations.ts: appends whichever single pure
 * rotation (x/x'/x2/y/y'/y2/z/z'/z2) restores identity orientation,
 * verified per case via finalOrientationAfterAlg (same pattern as
 * fix-unclosed-y-rotations.ts) — never guessed. Cases where no single
 * rotation closes it (a mixed multi-axis drift) are left untouched and
 * reported.
 *
 * SKIPPED entirely, same as the y-rotation pass: this app's Roux-category
 * groups (cmll, second-block-last-slot, eo4a) plus coll.json — printed as
 * a list instead of modified.
 *
 * Run: bun scripts/fix-unclosed-wide-move-rotations.ts
 */
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { parseMove, finalOrientationAfterAlg, identityOrientation } from "../src/logic/moveParser";

interface RawVariant { name?: string; alg: string; isDefault?: boolean }
interface RawCase { name: string; category?: string; algList: RawVariant[] }
interface RawSubgroup { id: string; name?: string; cases: RawCase[] }

function extractCases(data: unknown): RawCase[] {
  if (Array.isArray(data)) return data as RawCase[];
  if (data && typeof data === "object" && "subgroups" in data) {
    return (data as { subgroups: RawSubgroup[] }).subgroups.flatMap((sg) => sg.cases);
  }
  return [];
}

function isIdentity(o: ReturnType<typeof identityOrientation>): boolean {
  const id = identityOrientation();
  return (Object.keys(id) as (keyof typeof id)[]).every((k) => o[k] === id[k]);
}

function hasWideMove(tokens: string[]): boolean {
  return tokens.some((t) => parseMove(t)?.isWide);
}

function isFlagged(alg: string): boolean {
  const tokens = alg.trim().split(/\s+/).filter(Boolean);
  if (!hasWideMove(tokens)) return false;
  return !isIdentity(finalOrientationAfterAlg(alg));
}

const CLOSERS = ["y", "y'", "y2", "x", "x'", "x2", "z", "z'", "z2"];

function findClosingMove(alg: string): string | null {
  for (const closer of CLOSERS) {
    if (isIdentity(finalOrientationAfterAlg(`${alg} ${closer}`))) return closer;
  }
  return null;
}

const ROUX_FILES = new Set(["cmll.json", "second-block-last-slot.json", "eo4a.json"]);
const LIST_ONLY_FILES = new Set(["cmll.json", "coll.json"]);

const algsDir = join(import.meta.dir, "..", "src", "algs");
const files = readdirSync(algsDir).filter((f) => f.endsWith(".json"));

let totalFixed = 0;
let totalUnresolved = 0;
const listOnlyReport: string[] = [];

for (const file of files) {
  const path = join(algsDir, file);
  const raw = readFileSync(path, "utf-8");
  const isPretty = raw.includes("\n  ");
  const data = JSON.parse(raw);
  const cases = extractCases(data);

  const skipModification = ROUX_FILES.has(file);
  let fileFixed = 0;
  let fileUnresolved = 0;

  for (const c of cases) {
    for (const v of c.algList ?? []) {
      if (!isFlagged(v.alg)) continue;

      if (LIST_ONLY_FILES.has(file)) {
        listOnlyReport.push(`${file} :: ${c.name}${c.category ? ` [${c.category}]` : ""} :: ${v.name ?? "(variant)"} :: "${v.alg}"`);
        continue;
      }
      if (skipModification) continue;

      const closer = findClosingMove(v.alg);
      if (closer) {
        v.alg = `${v.alg} ${closer}`;
        fileFixed++;
        totalFixed++;
      } else {
        fileUnresolved++;
        totalUnresolved++;
        console.warn(`  UNRESOLVED (multi-axis drift) ${file} :: ${c.name} :: ${v.name ?? "(variant)"} :: "${v.alg}"`);
      }
    }
  }

  if (fileFixed > 0 || fileUnresolved > 0) {
    console.log(`${file}: fixed ${fileFixed}, unresolved ${fileUnresolved}`);
    writeFileSync(path, (isPretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)) + "\n");
  }
}

console.log(`\nTotal fixed: ${totalFixed}. Total unresolved (left as-is, needs manual review): ${totalUnresolved}.`);

if (listOnlyReport.length > 0) {
  console.log(`\n── COLL / CMLL cases (listed only, NOT modified, per Roux exclusion) ──`);
  for (const line of listOnlyReport) console.log(line);
  console.log(`\n${listOnlyReport.length} cases listed.`);
}

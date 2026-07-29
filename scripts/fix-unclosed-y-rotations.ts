/**
 * Fixes the unclosed mid/trailing y-rotation cases found by
 * find-unclosed-y-rotations.ts: appends a single closing y/y'/y2 token at
 * the very end of the algorithm so it finishes in the same orientation it
 * started (verified per-case via finalOrientationAfterAlg — if none of
 * y/y'/y2 alone restores identity, the drift isn't pure-y, e.g. an x/z is
 * also involved, and that case is left untouched and reported separately
 * for manual handling rather than guessed at).
 *
 * SKIPPED entirely (per the user — Roux algorithms intentionally move
 * centers/use wide moves a lot, and a leftover rotation there doesn't
 * affect the algorithm the way it does for the fixed-camera-frame F2L/LL
 * groups): cmll.json, second-block-last-slot.json, eo4a.json (this app's
 * Roux-category groups) and coll.json (grouped with CMLL by the user's own
 * request) — these are reported as a plain list instead of modified.
 *
 * Run: bun scripts/fix-unclosed-y-rotations.ts
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

function leadingYRunLength(tokens: string[]): number {
  let i = 0;
  while (i < tokens.length) {
    const parsed = parseMove(tokens[i]);
    if (!parsed || !parsed.isRotation || parsed.base !== "y") break;
    i++;
  }
  return i;
}

function isIdentity(o: ReturnType<typeof identityOrientation>): boolean {
  const id = identityOrientation();
  return (Object.keys(id) as (keyof typeof id)[]).every((k) => o[k] === id[k]);
}

function isFlagged(alg: string): boolean {
  const tokens = alg.trim().split(/\s+/).filter(Boolean);
  const leadingRun = leadingYRunLength(tokens);
  const hasMidOrTrailingY = tokens.slice(leadingRun).some((t) => {
    const p = parseMove(t);
    return p?.isRotation && p.base === "y";
  });
  if (!hasMidOrTrailingY) return false;
  return !isIdentity(finalOrientationAfterAlg(alg));
}

/** Try appending y / y' / y2; return the first that restores identity orientation, or null. */
function findClosingMove(alg: string): string | null {
  for (const closer of ["y'", "y", "y2"]) {
    const candidate = `${alg} ${closer}`;
    if (isIdentity(finalOrientationAfterAlg(candidate))) return closer;
  }
  return null;
}

const ROUX_FILES = new Set(["cmll.json", "second-block-last-slot.json", "eo4a.json"]);
const LIST_ONLY_FILES = new Set(["cmll.json", "coll.json"]); // Roux (cmll) + grouped-with-it-by-request (coll)

const algsDir = join(import.meta.dir, "..", "src", "algs");
const files = readdirSync(algsDir).filter((f) => f.endsWith(".json"));

let totalFixed = 0;
let totalUnresolved = 0;
const listOnlyReport: string[] = [];

for (const file of files) {
  const path = join(algsDir, file);
  const raw = readFileSync(path, "utf-8");
  const isPretty = raw.includes("\n  "); // 2-space indented pretty files vs minified single-line
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
      if (skipModification) continue; // Roux, not in LIST_ONLY_FILES (nothing requested) — skip silently.

      const closer = findClosingMove(v.alg);
      if (closer) {
        v.alg = `${v.alg} ${closer}`;
        fileFixed++;
        totalFixed++;
      } else {
        fileUnresolved++;
        totalUnresolved++;
        console.warn(`  UNRESOLVED (not pure-y drift) ${file} :: ${c.name} :: ${v.name ?? "(variant)"} :: "${v.alg}"`);
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

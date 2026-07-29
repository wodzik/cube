/**
 * Audit script (read-only, no writes): scans every bundled algorithm JSON
 * file — not just F2L — for algorithms that use a "y"/"y'"/"y2" rotation
 * OUTSIDE the leading run (i.e. not simply "regripping once at the very
 * start") without ever cancelling it back out, so the algorithm finishes
 * in a different absolute orientation than it started.
 *
 * Why this matters (see moveParser.ts's walkAlgOrientation doc comment,
 * an already-documented, pre-existing characteristic of this data): a
 * left-over net rotation is invisible to whether the algorithm SOLVES the
 * cube (rotations are always neutral for that), but it silently breaks
 * anything that assumes a fixed camera/display frame — this session's own
 * F2L-slot piece-group masks (f2l-fr/fl/bl/br, defined in one fixed
 * "D-cross" frame) chief among them, plus (per that doc comment) live
 * smart-cube tracking chained across algorithms without a regrip in
 * between.
 *
 * A LEADING rotation (or a matched leading+trailing pair, e.g. "y' ... y")
 * is fine and NOT flagged — both leave the algorithm's own net rotation at
 * zero relative to how buildCanonicalDisplaySetupAlg already displays it,
 * or are a deliberate one-time re-orientation with nothing after it to
 * desync. Flagged: a y/y' anywhere AFTER that leading run, where the
 * algorithm's FINAL orientation (computed via the app's own, already-used
 * finalOrientationAfterAlg — handles wide/slice/rotation interactions
 * properly, not just naive y-counting) isn't back to identity.
 *
 * Run: bun scripts/find-unclosed-y-rotations.ts
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { parseMove, finalOrientationAfterAlg, identityOrientation } from "../src/logic/moveParser";

interface RawVariant {
  name?: string;
  alg: string;
  isDefault?: boolean;
}
interface RawCase {
  name: string;
  category?: string;
  algList: RawVariant[];
}
interface RawSubgroup {
  id: string;
  name?: string;
  cases: RawCase[];
}

function extractCases(data: unknown): RawCase[] {
  if (Array.isArray(data)) return data as RawCase[];
  if (data && typeof data === "object" && "subgroups" in data) {
    const subgroups = (data as { subgroups: RawSubgroup[] }).subgroups;
    return subgroups.flatMap((sg) => sg.cases);
  }
  return [];
}

/** How many tokens, from the start, are y-rotations (y/y'/y2) — the exempt "regrip once at the start" run. */
function leadingYRunLength(tokens: string[]): number {
  let i = 0;
  while (i < tokens.length) {
    const parsed = parseMove(tokens[i]);
    if (!parsed || !parsed.isRotation || parsed.base !== "y") break;
    i++;
  }
  return i;
}

function isIdentityOrientation(o: ReturnType<typeof identityOrientation>): boolean {
  const id = identityOrientation();
  return (Object.keys(id) as (keyof typeof id)[]).every((k) => o[k] === id[k]);
}

const algsDir = join(import.meta.dir, "..", "src", "algs");
const files = readdirSync(algsDir).filter((f) => f.endsWith(".json"));

let totalVariantsScanned = 0;
let totalFlagged = 0;

for (const file of files) {
  const raw = readFileSync(join(algsDir, file), "utf-8");
  const data = JSON.parse(raw);
  const cases = extractCases(data);
  let fileFlagged = 0;

  for (const c of cases) {
    for (const v of c.algList ?? []) {
      totalVariantsScanned++;
      const tokens = v.alg.trim().split(/\s+/).filter(Boolean);
      const leadingRun = leadingYRunLength(tokens);

      // Any y-rotation token strictly after the leading run?
      const hasMidOrTrailingY = tokens.slice(leadingRun).some((t) => {
        const p = parseMove(t);
        return p?.isRotation && p.base === "y";
      });
      if (!hasMidOrTrailingY) continue;

      const finalOrientation = finalOrientationAfterAlg(v.alg);
      if (isIdentityOrientation(finalOrientation)) continue; // already properly closed

      fileFlagged++;
      totalFlagged++;
      console.log(`${file} :: ${c.name}${c.category ? ` [${c.category}]` : ""} :: ${v.name ?? "(variant)"} :: "${v.alg}"`);
    }
  }

  if (fileFlagged > 0) console.log(`  ── ${file}: ${fileFlagged} flagged\n`);
}

console.log(`\nScanned ${totalVariantsScanned} variants across ${files.length} files.`);
console.log(`Flagged ${totalFlagged} algorithms with an unclosed mid/trailing y-rotation.`);

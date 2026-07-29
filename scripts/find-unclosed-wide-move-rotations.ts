/**
 * Audit script (read-only): like find-unclosed-y-rotations.ts, but for
 * WIDE moves (Rw/Lw/Uw/Dw/Fw/Bw, or lowercase r/l/u/d/f/b) instead of pure
 * y/y'/y2 rotation tokens. Per this app's own move model
 * (moveParser.ts's walkAlgOrientation), a wide move ALSO shifts the
 * hardware-frame orientation, same as a pure rotation — so an algorithm
 * that uses one and never compensates for it finishes in a different
 * absolute orientation than it started, for the same reason a stray mid
 * y/y' does.
 *
 * Unlike a pure rotation, a wide move is never "just a reorientation" —
 * it's a real move doing real solving work — so there's no leading-run
 * exemption here the way there is for y: ANY algorithm containing a wide
 * move whose final orientation isn't back to identity is flagged,
 * regardless of where in the sequence the wide move sits.
 *
 * Run: bun scripts/find-unclosed-wide-move-rotations.ts
 */
import { readFileSync, readdirSync } from "fs";
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

const algsDir = join(import.meta.dir, "..", "src", "algs");
const files = readdirSync(algsDir).filter((f) => f.endsWith(".json"));

let totalVariantsScanned = 0;
let totalFlagged = 0;

for (const file of files) {
  const data = JSON.parse(readFileSync(join(algsDir, file), "utf-8"));
  const cases = extractCases(data);
  let fileFlagged = 0;

  for (const c of cases) {
    for (const v of c.algList ?? []) {
      totalVariantsScanned++;
      const tokens = v.alg.trim().split(/\s+/).filter(Boolean);
      if (!hasWideMove(tokens)) continue;
      if (isIdentity(finalOrientationAfterAlg(v.alg))) continue;

      fileFlagged++;
      totalFlagged++;
      console.log(`${file} :: ${c.name}${c.category ? ` [${c.category}]` : ""} :: ${v.name ?? "(variant)"} :: "${v.alg}"`);
    }
  }

  if (fileFlagged > 0) console.log(`  ── ${file}: ${fileFlagged} flagged\n`);
}

console.log(`\nScanned ${totalVariantsScanned} variants across ${files.length} files.`);
console.log(`Flagged ${totalFlagged} algorithms with an unclosed wide-move rotation.`);

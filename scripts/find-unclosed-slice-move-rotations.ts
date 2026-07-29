/**
 * Audit script (read-only): like find-unclosed-wide-move-rotations.ts, but
 * for SLICE moves (M/E/S) instead of wide moves. Same underlying cause per
 * moveParser.ts's walkAlgOrientation — a slice move shifts the
 * hardware-frame orientation same as a wide move or pure rotation does —
 * and same "no leading exemption" reasoning: a slice move is real solving
 * work, not an optional reorientation, so every algorithm containing one
 * is checked regardless of position.
 *
 * Run: bun scripts/find-unclosed-slice-move-rotations.ts
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

function hasSliceMove(tokens: string[]): boolean {
  return tokens.some((t) => parseMove(t)?.isSlice);
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
      if (!hasSliceMove(tokens)) continue;
      if (isIdentity(finalOrientationAfterAlg(v.alg))) continue;

      fileFlagged++;
      totalFlagged++;
      console.log(`${file} :: ${c.name}${c.category ? ` [${c.category}]` : ""} :: ${v.name ?? "(variant)"} :: "${v.alg}"`);
    }
  }

  if (fileFlagged > 0) console.log(`  ── ${file}: ${fileFlagged} flagged\n`);
}

console.log(`\nScanned ${totalVariantsScanned} variants across ${files.length} files.`);
console.log(`Flagged ${totalFlagged} algorithms with an unclosed slice-move rotation.`);

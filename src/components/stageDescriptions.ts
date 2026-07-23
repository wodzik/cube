/**
 * Friendlier row headings for LBL's 2-look OLL/PLL sub-stages — raw ids
 * like "oll-first"/"pll-corners" read as opaque strings otherwise. Shared
 * by SolveSummary (compact inline stats right after a solve) and
 * SolveAnalysis (the full modal breakdown) — both render a per-stage table
 * from the SAME StageTiming[] and need the SAME mapping.
 *
 * "oll-first"/"oll-second" are a fixed, stable PAIR OF IDS (2-look OLL is
 * commonly taught either order, so there's no single fixed identity for
 * "the first OLL milestone" — see lblStages.ts), but each carries a
 * `detail` ("corners" or "edges") recorded at the moment it actually
 * completed — the id says WHEN, the detail says WHAT. "pll-corners" is
 * always corners specifically (PLL's corner-then-edge order isn't
 * flexible, so no detail needed); "pll-edges" likewise always means
 * edges. Every other stage id (cross, f2l-1, oll, pll, ...) is already
 * self-explanatory as-is and falls through unchanged — note CFOP's own
 * "oll"/"pll" ids are deliberately untouched by this map: LBL's split
 * stages use their own "-first"/"-second"/"-corners"/"-edges" ids
 * specifically so they never collide with CFOP's single-stage names here.
 */
const OLL_DETAIL_LABELS: Record<string, string> = {
  corners: "Orient corners",
  edges: "Orient edges",
};

const STAGE_DESCRIPTIONS: Record<string, string> = {
  "pll-corners": "Permute corners",
  "pll-edges": "Permute edges",
};

export function stageDescription(stage: string, detail?: string): string {
  if (stage === "oll-first" || stage === "oll-second") {
    return (detail && OLL_DETAIL_LABELS[detail]) ?? "Orient corners/edges";
  }
  return STAGE_DESCRIPTIONS[stage] ?? stage;
}

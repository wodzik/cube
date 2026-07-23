/**
 * Friendlier row headings for LBL's 2-look OLL/PLL sub-stages — "oll-partial"
 * and "pll-corners" read as opaque IDs otherwise. Shared by SolveSummary
 * (compact inline stats right after a solve) and SolveAnalysis (the full
 * modal breakdown) — both render a per-stage table from the SAME
 * StageTiming[] and need the SAME mapping.
 *
 * oll-partial covers EITHER corners or edges (order-flexible, see
 * lblStages.ts) hence "corners/edges"; pll-corners is always corners
 * specifically (PLL's corner-then-edge order isn't flexible), hence no
 * "/edges". Every other stage id (cross, f2l-1, oll, pll, ...) is already
 * self-explanatory as-is and falls through unchanged.
 */
const STAGE_DESCRIPTIONS: Record<string, string> = {
  "oll-partial": "Orient corners/edges",
  "pll-corners": "Permute corners",
};

export function stageDescription(stage: string): string {
  return STAGE_DESCRIPTIONS[stage] ?? stage;
}

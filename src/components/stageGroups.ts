/**
 * Groups a method's flat per-stage StageTiming[] for display in
 * SolveTimingBar — e.g. CFOP's f2l-1..f2l-4 collapse into one "F2L" span
 * (still rendered as 4 sub-segments under it), while cross/oll/pll each stay
 * their own single-stage span. Purely a display grouping — stage detection/
 * timing itself (stageTiming.ts) has no concept of "group". Written against
 * stage ID patterns rather than one table per method, so a future method's
 * detector groups correctly for free as long as its multi-part stages follow
 * the existing "<name>-<n>" / "<name>-first" convention (see cfopStages.ts,
 * rouxStages.ts, lblStages.ts).
 */

const GROUP_LABELS: [pattern: RegExp, label: string][] = [
  [/^cross$/, "Cross"],
  [/^f2l/, "F2L"],
  [/^first-layer/, "First layer"],
  [/^second-layer/, "Second layer"],
  [/^oll/, "OLL"],
  [/^pll/, "PLL"],
  [/^auf$/, "AUF"],
  [/^fb$/, "FB"],
  [/^sb$/, "SB"],
  [/^cmll$/, "CMLL"],
  [/^lse$/, "LSE"],
];

export function stageGroupLabel(stage: string): string {
  return GROUP_LABELS.find(([pattern]) => pattern.test(stage))?.[1] ?? stage;
}

/**
 * Short qualifier for a stage WITHIN a multi-stage group, e.g. "f2l-2" ->
 * "Slot 2". Null for ids that don't carry a slot number (oll-first,
 * pll-corners, ...) — those are described well enough by stageDescription
 * (see stageDescriptions.ts) instead.
 */
export function stageSlotLabel(stage: string): string | null {
  const f2l = stage.match(/^f2l-(\d)$/);
  if (f2l) return `Slot ${f2l[1]}`;
  const firstLayer = stage.match(/^first-layer-(\d)$/);
  if (firstLayer) return `Corner ${firstLayer[1]}`;
  const secondLayer = stage.match(/^second-layer-(\d)$/);
  if (secondLayer) return `Edge ${secondLayer[1]}`;
  return null;
}

/**
 * Two hex shades per group label (base + a lighter alt for alternating
 * sub-segments within a multi-part group), keyed by name — not position —
 * so "Cross" reads the same violet whether it's CFOP, LBL, or
 * (hypothetically) any other face-agnostic-cross method. Values are
 * Tailwind's own violet/indigo/sky/teal/emerald 400/500, spelled out as hex
 * because these get used as inline `backgroundColor` styles (a class name
 * built with template-string interpolation, e.g. `bg-${color}-400`, isn't
 * visible to Tailwind's build-time scanner and silently produces no style).
 * Falls back to gray for an unrecognized label.
 */
const GROUP_SHADES_BY_LABEL: Record<string, [base: string, alt: string]> = {
  Cross: ["#8b5cf6", "#a78bfa"], // violet-500 / violet-400
  "First layer": ["#8b5cf6", "#a78bfa"],
  FB: ["#8b5cf6", "#a78bfa"],
  F2L: ["#6366f1", "#818cf8"], // indigo-500 / indigo-400
  "Second layer": ["#6366f1", "#818cf8"],
  SB: ["#6366f1", "#818cf8"],
  OLL: ["#0ea5e9", "#38bdf8"], // sky-500 / sky-400
  CMLL: ["#0ea5e9", "#38bdf8"],
  PLL: ["#14b8a6", "#2dd4bf"], // teal-500 / teal-400
  LSE: ["#14b8a6", "#2dd4bf"],
  AUF: ["#10b981", "#34d399"], // emerald-500 / emerald-400
};
const FALLBACK_SHADES: [string, string] = ["#6b7280", "#9ca3af"]; // gray-500 / gray-400

export function stageGroupShades(label: string): [base: string, alt: string] {
  return GROUP_SHADES_BY_LABEL[label] ?? FALLBACK_SHADES;
}

export interface StageGroup<T extends { stage: string }> {
  label: string;
  timings: T[];
}

/** Collapses consecutive same-label timings into groups, preserving stage order (stages are already in solve order, and a group's parts are always contiguous in that order). */
export function groupStageTimings<T extends { stage: string }>(timings: readonly T[]): StageGroup<T>[] {
  const groups: StageGroup<T>[] = [];
  for (const t of timings) {
    const label = stageGroupLabel(t.stage);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.timings.push(t);
    else groups.push({ label, timings: [t] });
  }
  return groups;
}

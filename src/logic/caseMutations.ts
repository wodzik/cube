/**
 * Pure AlgorithmCase[] transforms — the actual mutation logic behind every
 * algorithmStore.ts write. Extracted so subgroup case lists (which persist
 * via algGroupRegistry.ts's registry entry, not the alg_group_{id}
 * localStorage key) can share the exact same logic instead of a second,
 * drifting copy.
 */

import type { AlgorithmCase, AlgorithmVariant, AlgorithmAttempt, LearningStatus } from "../types/algorithm";
import { computeVariantStatsAttempts } from "./statistics";

/**
 * The cube an attempt was made on. Attempts are tiny and many, so `cube` is
 * stored only when it CHANGES (run-length): an attempt without the field
 * was made on the same cube as the one before it; "" = no cube connected.
 */
export function attemptCube(times: readonly AlgorithmAttempt[], index: number): string | undefined {
  for (let i = index; i >= 0; i--) if (times[i].cube !== undefined) return times[i].cube || undefined;
  return undefined;
}

/** The attempt as stored after `times`: its cube dropped when it's the same as the previous attempt's. */
function withRunLengthCube(times: readonly AlgorithmAttempt[], attempt: AlgorithmAttempt): AlgorithmAttempt {
  const { cube, ...rest } = attempt;
  const previous = times.length ? attemptCube(times, times.length - 1) : undefined;
  return (cube ?? undefined) === previous ? rest : { ...rest, cube: cube ?? "" };
}

function recalcStats(variant: AlgorithmVariant): AlgorithmVariant {
  const stats = computeVariantStatsAttempts(variant.times);
  return { ...variant, ...stats };
}

export function applyRecordAttempt(
  cases: AlgorithmCase[],
  caseName: string,
  variantId: string,
  attempt: AlgorithmAttempt
): AlgorithmCase[] {
  const ci = cases.findIndex((c) => c.name === caseName);
  if (ci < 0) return cases;
  const vi = cases[ci].algList.findIndex((v) => v.id === variantId);
  if (vi < 0) return cases;
  const next = [...cases];
  const algList = [...next[ci].algList];
  const times = algList[vi].times;
  algList[vi] = recalcStats({ ...algList[vi], times: [...times, withRunLengthCube(times, attempt)] });
  next[ci] = { ...next[ci], algList };
  return next;
}

export function applySetLearningStatus(
  cases: AlgorithmCase[],
  caseName: string,
  variantId: string,
  status: LearningStatus
): AlgorithmCase[] {
  const ci = cases.findIndex((c) => c.name === caseName);
  if (ci < 0) return cases;
  const vi = cases[ci].algList.findIndex((v) => v.id === variantId);
  if (vi < 0) return cases;
  const next = [...cases];
  const algList = [...next[ci].algList];
  algList[vi] = { ...algList[vi], learningStatus: status };
  next[ci] = { ...next[ci], algList };
  return next;
}

export function applyClearVariantTimes(cases: AlgorithmCase[], caseName: string, variantId: string): AlgorithmCase[] {
  const ci = cases.findIndex((c) => c.name === caseName);
  if (ci < 0) return cases;
  const vi = cases[ci].algList.findIndex((v) => v.id === variantId);
  if (vi < 0) return cases;
  const next = [...cases];
  const algList = [...next[ci].algList];
  algList[vi] = recalcStats({ ...algList[vi], times: [] });
  next[ci] = { ...next[ci], algList };
  return next;
}

/** Replace a full case (used by CaseEdit after editing variants). */
export function applyUpdateCase(cases: AlgorithmCase[], updated: AlgorithmCase): AlgorithmCase[] {
  const ci = cases.findIndex((c) => c.name === updated.name);
  if (ci < 0) return cases;
  const next = [...cases];
  next[ci] = updated;
  return next;
}

/** Append a brand-new case. Returns null (unchanged input semantics) if the name is already taken. */
export function applyAddCase(cases: AlgorithmCase[], newCase: AlgorithmCase): AlgorithmCase[] | null {
  if (cases.some((c) => c.name === newCase.name)) return null;
  return [...cases, newCase];
}

export function applyDeleteCase(cases: AlgorithmCase[], caseName: string): AlgorithmCase[] {
  return cases.filter((c) => c.name !== caseName);
}

export function applySetCaseSelected(cases: AlgorithmCase[], caseName: string, selected: boolean): AlgorithmCase[] {
  const ci = cases.findIndex((c) => c.name === caseName);
  if (ci < 0) return cases;
  const next = [...cases];
  next[ci] = { ...next[ci], selected };
  return next;
}

/** Bulk-set selected on multiple cases (all cases if caseNames is omitted). */
export function applySetSelectedBatch(cases: AlgorithmCase[], selected: boolean, caseNames?: string[]): AlgorithmCase[] {
  const nameSet = caseNames ? new Set(caseNames) : null;
  return cases.map((c) => (!nameSet || nameSet.has(c.name) ? { ...c, selected } : c));
}

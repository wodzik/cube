/**
 * Persistent storage for algorithm cases and execution times.
 *
 * localStorage key: alg_group_{group} -> AlgorithmCase[]
 *
 * On first load, if no key exists, data is imported from the static JSON
 * files (source of truth for case structure) and saved. All subsequent
 * reads/writes go to localStorage only.
 *
 * PURE FUNCTIONS — no React hooks.
 */

import type { AlgGroup, AlgorithmCase, AlgorithmVariant, AlgorithmAttempt, LearningStatus } from "../types/algorithm";
import { computeVariantStatsAttempts } from "../logic/statistics";

import ollJson from "../algs/formatted_oll.json";
import pllJson from "../algs/formatted_pll.json";
import f2lFrontRightJson from "../algs/f2l-front-right.json";
import f2lFrontLeftJson from "../algs/f2l-front-left.json";
import f2lBackRightJson from "../algs/f2l-back-right.json";
import f2lBackLeftJson from "../algs/f2l-back-left.json";
import f2lAdvancedJson from "../algs/f2l-advanced.json";

function storageKey(group: AlgGroup): string {
  return `alg_group_${group}`;
}

interface RawVariant {
  name: string;
  alg: string;
  isDefault: boolean;
  youtubeUrl?: string | null;
}

interface RawCase {
  name: string;
  category: string;
  subcategory?: string;
  algList: RawVariant[];
}

function hydrateVariant(raw: RawVariant, caseIdx: number, variantIdx: number, group: AlgGroup): AlgorithmVariant {
  return {
    id: `${group}-${caseIdx}-${variantIdx}`,
    name: raw.name,
    alg: raw.alg,
    isDefault: raw.isDefault,
    youtubeUrl: raw.youtubeUrl ?? undefined,
    times: [],
    ao5: null,
    ao12: null,
    ao100: null,
    bestTime: null,
    learningStatus: "not-started",
  };
}

function hydrateCase(raw: RawCase, caseIdx: number, group: AlgGroup): AlgorithmCase {
  return {
    name: raw.name,
    category: raw.category,
    subcategory: raw.subcategory,
    algList: raw.algList.map((v, i) => hydrateVariant(v, caseIdx, i, group)),
  };
}

const JSON_SOURCES: Record<AlgGroup, unknown> = {
  oll: ollJson,
  pll: pllJson,
  "f2l-front-right": f2lFrontRightJson,
  "f2l-front-left": f2lFrontLeftJson,
  "f2l-back-right": f2lBackRightJson,
  "f2l-back-left": f2lBackLeftJson,
  "f2l-advanced": f2lAdvancedJson,
};

function loadFromJson(group: AlgGroup): AlgorithmCase[] {
  const raw = JSON_SOURCES[group] as RawCase[];
  return raw.map((c, i) => hydrateCase(c, i, group));
}

// ─── Public API ───

export function loadAlgGroup(group: AlgGroup): AlgorithmCase[] {
  try {
    const raw = localStorage.getItem(storageKey(group));
    if (raw) return JSON.parse(raw) as AlgorithmCase[];
  } catch {
    // fall through to JSON import
  }
  const cases = loadFromJson(group);
  saveAlgGroup(group, cases);
  return cases;
}

export function saveAlgGroup(group: AlgGroup, cases: AlgorithmCase[]): void {
  localStorage.setItem(storageKey(group), JSON.stringify(cases));
}

/** Wipe localStorage and reload from the original JSON files. */
export function resetAlgGroup(group: AlgGroup): void {
  localStorage.removeItem(storageKey(group));
}

// ─── Mutations ───

function recalcStats(variant: AlgorithmVariant): AlgorithmVariant {
  const stats = computeVariantStatsAttempts(variant.times);
  return { ...variant, ...stats };
}

export function recordAttempt(group: AlgGroup, caseName: string, variantId: string, attempt: AlgorithmAttempt): void {
  const cases = loadAlgGroup(group);
  const ci = cases.findIndex((c) => c.name === caseName);
  if (ci < 0) return;
  const vi = cases[ci].algList.findIndex((v) => v.id === variantId);
  if (vi < 0) return;
  cases[ci].algList[vi] = recalcStats({
    ...cases[ci].algList[vi],
    times: [...cases[ci].algList[vi].times, attempt],
  });
  saveAlgGroup(group, cases);
}

export function setLearningStatus(group: AlgGroup, caseName: string, variantId: string, status: LearningStatus): void {
  const cases = loadAlgGroup(group);
  const ci = cases.findIndex((c) => c.name === caseName);
  if (ci < 0) return;
  const vi = cases[ci].algList.findIndex((v) => v.id === variantId);
  if (vi < 0) return;
  cases[ci].algList[vi] = { ...cases[ci].algList[vi], learningStatus: status };
  saveAlgGroup(group, cases);
}

export function clearVariantTimes(group: AlgGroup, caseName: string, variantId: string): void {
  const cases = loadAlgGroup(group);
  const ci = cases.findIndex((c) => c.name === caseName);
  if (ci < 0) return;
  const vi = cases[ci].algList.findIndex((v) => v.id === variantId);
  if (vi < 0) return;
  cases[ci].algList[vi] = recalcStats({ ...cases[ci].algList[vi], times: [] });
  saveAlgGroup(group, cases);
}

/** Replace a full case (used by CaseEdit after editing variants). */
export function updateCase(group: AlgGroup, updated: AlgorithmCase): void {
  const cases = loadAlgGroup(group);
  const ci = cases.findIndex((c) => c.name === updated.name);
  if (ci >= 0) {
    cases[ci] = updated;
    saveAlgGroup(group, cases);
  }
}

export function setCaseSelected(group: AlgGroup, caseName: string, selected: boolean): void {
  const cases = loadAlgGroup(group);
  const ci = cases.findIndex((c) => c.name === caseName);
  if (ci < 0) return;
  cases[ci] = { ...cases[ci], selected };
  saveAlgGroup(group, cases);
}

/** Bulk-set selected on multiple cases (all cases if caseNames is omitted). */
export function setSelectedBatch(group: AlgGroup, selected: boolean, caseNames?: string[]): void {
  const cases = loadAlgGroup(group);
  const nameSet = caseNames ? new Set(caseNames) : null;
  const updated = cases.map((c) => (!nameSet || nameSet.has(c.name) ? { ...c, selected } : c));
  saveAlgGroup(group, updated);
}

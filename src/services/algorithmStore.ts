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
import {
  applyRecordAttempt,
  applySetLearningStatus,
  applyClearVariantTimes,
  applyUpdateCase,
  applyAddCase,
  applyDeleteCase,
  applySetCaseSelected,
  applySetSelectedBatch,
} from "../logic/caseMutations";

import ollJson from "../algs/formatted_oll.json";
import pllJson from "../algs/formatted_pll.json";
import f2lFrontRightJson from "../algs/f2l-front-right.json";
import f2lFrontLeftJson from "../algs/f2l-front-left.json";
import f2lBackRightJson from "../algs/f2l-back-right.json";
import f2lBackLeftJson from "../algs/f2l-back-left.json";
import f2lAdvancedJson from "../algs/f2l-advanced.json";
import collJson from "../algs/coll.json";
import cmllJson from "../algs/cmll.json";
import winterVariationJson from "../algs/winter-variation.json";

function storageKey(group: AlgGroup): string {
  return `alg_group_${group}`;
}

export interface RawVariant {
  name: string;
  alg: string;
  isDefault: boolean;
  youtubeUrl?: string | null;
}

export interface RawCase {
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
  coll: collJson,
  cmll: cmllJson,
  "winter-variation": winterVariationJson,
};

function loadFromJson(group: AlgGroup): AlgorithmCase[] {
  const raw = JSON_SOURCES[group] as RawCase[] | undefined;
  return raw ? raw.map((c, i) => hydrateCase(c, i, group)) : [];
}

/** Hydrate a portable RawCase[] (hand-authored or imported) into full AlgorithmCase[] — same pipeline the bundled JSON files go through. Exported for algGroupRegistry's import. */
export function hydrateCasesFromRaw(raw: RawCase[], group: AlgGroup): AlgorithmCase[] {
  return raw.map((c, i) => hydrateCase(c, i, group));
}

// ─── Public API ───

/**
 * A group id is either one of the 7 built-ins (bundled JSON as the initial
 * source of truth) or any user-created id (algGroupRegistry.createGroup) —
 * for those there is no bundled JSON, a localStorage miss just means "brand
 * new, no cases yet".
 */
export function loadAlgGroup(group: AlgGroup): AlgorithmCase[] {
  try {
    const raw = localStorage.getItem(storageKey(group));
    if (raw) return JSON.parse(raw) as AlgorithmCase[];
  } catch {
    // fall through to JSON import / empty
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

export function recordAttempt(group: AlgGroup, caseName: string, variantId: string, attempt: AlgorithmAttempt): void {
  saveAlgGroup(group, applyRecordAttempt(loadAlgGroup(group), caseName, variantId, attempt));
}

export function setLearningStatus(group: AlgGroup, caseName: string, variantId: string, status: LearningStatus): void {
  saveAlgGroup(group, applySetLearningStatus(loadAlgGroup(group), caseName, variantId, status));
}

export function clearVariantTimes(group: AlgGroup, caseName: string, variantId: string): void {
  saveAlgGroup(group, applyClearVariantTimes(loadAlgGroup(group), caseName, variantId));
}

/** Replace a full case (used by CaseEdit after editing variants). */
export function updateCase(group: AlgGroup, updated: AlgorithmCase): void {
  saveAlgGroup(group, applyUpdateCase(loadAlgGroup(group), updated));
}

/** Append a brand-new case — the "add algorithm" primitive (no equivalent existed before). Rejects a duplicate name. */
export function addCase(group: AlgGroup, newCase: AlgorithmCase): boolean {
  const next = applyAddCase(loadAlgGroup(group), newCase);
  if (!next) return false;
  saveAlgGroup(group, next);
  return true;
}

/** Remove a whole case (all its variants) from a group. */
export function deleteCase(group: AlgGroup, caseName: string): void {
  saveAlgGroup(group, applyDeleteCase(loadAlgGroup(group), caseName));
}

export function setCaseSelected(group: AlgGroup, caseName: string, selected: boolean): void {
  saveAlgGroup(group, applySetCaseSelected(loadAlgGroup(group), caseName, selected));
}

/** Bulk-set selected on multiple cases (all cases if caseNames is omitted). */
export function setSelectedBatch(group: AlgGroup, selected: boolean, caseNames?: string[]): void {
  saveAlgGroup(group, applySetSelectedBatch(loadAlgGroup(group), selected, caseNames));
}

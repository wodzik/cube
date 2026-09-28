/**
 * Persistent storage for algorithm cases and execution times — the flat
 * (no-subgroups) built-in and user-created groups. See algOverlayStore.ts
 * for the actual sparse-overlay persistence engine this wraps (bundled JSON
 * is this file's "base" for built-in groups); algGroupRegistry.ts's
 * subgroup-based groups (ZBLL, F2L, Advanced F2L, VLS, and any user-created
 * subgroup group) use the same engine with their own bundled bases.
 *
 * localStorage key: alg_group_{group} -> CasesOverlay
 *
 * PURE FUNCTIONS — no React hooks.
 */

import type { AlgGroup, AlgorithmCase, AlgorithmVariant, AlgorithmAttempt, LearningStatus, DisplayConfig } from "../types/algorithm";
import { loadOverlayed, saveOverlay, saveOverlayStructural } from "./algOverlayStore";
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
import summerVariationJson from "../algs/summer-variation.json";
import secondBlockLastSlotJson from "../algs/second-block-last-slot.json";
import antiPllJson from "../algs/anti-pll.json";
import edgesOfTheLastLayerJson from "../algs/edges-of-the-last-layer.json";
import cornersLastSlotJson from "../algs/corners-last-slot.json";
import eo4aJson from "../algs/eo4a.json";
import { BLD_M2, BLD_OP_CORNERS, BLD_OP_EDGES, BLD_SWAPS } from "../algs/bld";

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
  /** Bundled equivalent of AlgorithmCase's "Advanced" per-case override — e.g. EO4A's precomputed per-case good/bad edge mask. */
  displayConfigOverride?: Partial<DisplayConfig>;
}

/**
 * A built-in variant's id: from its case and its algorithm, so progress stays
 * with the algorithm whatever the bundled list's order ("b-" + a short hash;
 * a second identical algorithm in the same case gets "~2"…).
 */
export function stableVariantId(caseName: string, alg: string, occurrence = 1): string {
  const text = `${caseName}\n${alg.replace(/[()]/g, "").replace(/\s+/g, " ").trim()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `b-${(h >>> 0).toString(36)}${occurrence > 1 ? `~${occurrence}` : ""}`;
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

function hydrateCase(raw: RawCase, caseIdx: number, group: AlgGroup, builtIn = false): AlgorithmCase {
  const seen = new Map<string, number>();
  const algList = raw.algList.map((v, i) => {
    const variant = hydrateVariant(v, caseIdx, i, group);
    if (!builtIn) return variant;
    const base = stableVariantId(raw.name, v.alg);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...variant, id: stableVariantId(raw.name, v.alg, n), builtIn: true, legacyId: variant.id };
  });
  return {
    name: raw.name,
    category: raw.category,
    subcategory: raw.subcategory,
    algList,
    displayConfigOverride: raw.displayConfigOverride,
    ...(builtIn ? { builtIn: true } : {}),
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
  "summer-variation": summerVariationJson,
  "second-block-last-slot": secondBlockLastSlotJson,
  "anti-pll": antiPllJson,
  "edges-of-the-last-layer": edgesOfTheLastLayerJson,
  "corners-last-slot": cornersLastSlotJson,
  eo4a: eo4aJson,
  "blind-swaps": BLD_SWAPS,
  "blind-op-edges": BLD_OP_EDGES,
  "blind-op-corners": BLD_OP_CORNERS,
  "blind-m2": BLD_M2,
};

/** The bundled (built-in) cases of a group — hydrated once, they never change at runtime. [] for a group of your own. */
const bundledCache = new Map<AlgGroup, AlgorithmCase[]>();
export function bundledCases(group: AlgGroup): AlgorithmCase[] {
  let cases = bundledCache.get(group);
  if (!cases) {
    const raw = JSON_SOURCES[group] as RawCase[] | undefined;
    cases = raw ? raw.map((c, i) => hydrateCase(c, i, group, true)) : [];
    bundledCache.set(group, cases);
  }
  return cases;
}
const loadFromJson = bundledCases;

/**
 * Hydrate a portable RawCase[] (hand-authored or imported) into full AlgorithmCase[] — same pipeline
 * the bundled JSON files go through. `builtIn` for a bundled set (read-only, stable ids).
 */
export function hydrateCasesFromRaw(raw: RawCase[], group: AlgGroup, builtIn = false): AlgorithmCase[] {
  return raw.map((c, i) => hydrateCase(c, i, group, builtIn));
}

// ─── Public API ───

/**
 * A group id is either one of the built-ins (bundled JSON is the structure
 * source of truth) or any user-created id (algGroupRegistry.createGroup) —
 * for those there is no bundled JSON, so they're always in "full" mode
 * (see algOverlayStore.ts) from their first case onward.
 */
export function loadAlgGroup(group: AlgGroup): AlgorithmCase[] {
  return loadOverlayed(storageKey(group), loadFromJson(group));
}

/** For dynamic-only mutations (attempts, learning status, selection) — stays in whichever mode (sparse overlay or full) the group is already in. */
export function saveAlgGroup(group: AlgGroup, cases: AlgorithmCase[]): void {
  saveOverlay(storageKey(group), cases, loadFromJson(group));
}

/** A built-in group (bundled cases, read-only structure) — vs one of your own. */
export const isBuiltInGroup = (group: AlgGroup): boolean => loadFromJson(group).length > 0;

/**
 * For structural mutations — the case/variant SET itself changed (added,
 * edited, deleted, or replaced wholesale by an import), which can't be
 * expressed as a delta against the bundled JSON. Switches (or keeps) the
 * group in "full" mode from now on.
 */
export function saveAlgGroupStructural(group: AlgGroup, cases: AlgorithmCase[]): void {
  saveOverlayStructural(storageKey(group), cases, loadFromJson(group));
}

/** Wipe localStorage and reload from the original JSON files (or, for a user-created group, back to empty). */
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

/** Replace a full case (used by CaseEdit after editing variants) — structural: the edited case's variant set/algs no longer necessarily matches the bundled JSON. */
export function updateCase(group: AlgGroup, updated: AlgorithmCase): void {
  saveAlgGroupStructural(group, applyUpdateCase(loadAlgGroup(group), updated));
}

/** Append a brand-new case — the "add algorithm" primitive. Rejects a duplicate name. Structural (see updateCase). */
export function addCase(group: AlgGroup, newCase: AlgorithmCase): boolean {
  if (isBuiltInGroup(group)) return false; // built-in sets are fixed — add cases to a group of your own
  const next = applyAddCase(loadAlgGroup(group), newCase);
  if (!next) return false;
  saveAlgGroupStructural(group, next);
  return true;
}

/** Remove a whole case (all its variants) from a group of your own — a built-in case is hidden instead. */
export function deleteCase(group: AlgGroup, caseName: string): void {
  if (isBuiltInGroup(group)) return setCaseHidden(group, caseName, true);
  saveAlgGroupStructural(group, applyDeleteCase(loadAlgGroup(group), caseName));
}

/** Hide / show a case in its list (built-in cases are hidden rather than deleted). */
export function setCaseHidden(group: AlgGroup, caseName: string, hidden: boolean): void {
  saveAlgGroup(group, loadAlgGroup(group).map((c) => (c.name === caseName ? { ...c, hidden: hidden || undefined } : c)));
}

export function setCaseSelected(group: AlgGroup, caseName: string, selected: boolean): void {
  saveAlgGroup(group, applySetCaseSelected(loadAlgGroup(group), caseName, selected));
}

/** Bulk-set selected on multiple cases (all cases if caseNames is omitted). */
export function setSelectedBatch(group: AlgGroup, selected: boolean, caseNames?: string[]): void {
  saveAlgGroup(group, applySetSelectedBatch(loadAlgGroup(group), selected, caseNames));
}

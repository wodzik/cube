/**
 * Persistent storage for algorithm cases and execution times.
 *
 * Case/variant STRUCTURE (name, algorithm text, category, YouTube link, ...)
 * lives in the bundled JSON files for the built-in groups — it never
 * changes at runtime, so it's re-hydrated fresh on every load instead of
 * being duplicated into localStorage. Only what a user actually DOES
 * (attempt times, learning status, which cases are selected) is persisted,
 * as a sparse overlay keyed by variant id / case name — see AlgGroupOverlay.
 *
 * localStorage key: alg_group_{group} -> AlgGroupOverlay
 *
 * A group loses this distinction the moment its case/variant SET itself is
 * edited (addCase/updateCase/deleteCase, or a whole-group import) — there's
 * no way to express "case #14 was renamed" as a delta against the bundled
 * JSON, so from that point on the overlay's `full` field holds the WHOLE
 * case list verbatim (this file's pre-2026-09 behavior) and the sparse
 * fields are ignored. A user-created group (no bundled JSON at all) is
 * always in this "full" mode, from its very first case.
 *
 * PURE FUNCTIONS — no React hooks.
 */

import type { AlgGroup, AlgorithmCase, AlgorithmVariant, AlgorithmAttempt, LearningStatus, DisplayConfig } from "../types/algorithm";
import { computeVariantStatsAttempts } from "../logic/statistics";
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

function storageKey(group: AlgGroup): string {
  return `alg_group_${group}`;
}

function isQuotaExceededError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22);
}

// ─── On-disk overlay shape ───

interface StoredVariantOverlay {
  times: AlgorithmAttempt[];
  learningStatus: LearningStatus;
}
interface StoredCaseOverlay {
  selected: boolean;
}
interface AlgGroupOverlay {
  /** Non-default variant state (times.length > 0 or learningStatus !== "not-started"), keyed by variant id. */
  variants?: Record<string, StoredVariantOverlay>;
  /** Non-default case state (selected explicitly set), keyed by case name. */
  cases?: Record<string, StoredCaseOverlay>;
  /** Present once this group has been structurally edited — see file doc comment. When set, this IS the whole group; variants/cases above are unused. */
  full?: AlgorithmCase[];
}

/** Parses whatever's on disk for `group`, transparently accepting the pre-refactor bare-`AlgorithmCase[]` format as full-mode data. Null if nothing's stored yet. */
function readRawGroupData(group: AlgGroup): AlgGroupOverlay | null {
  try {
    const raw = localStorage.getItem(storageKey(group));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return { full: parsed as AlgorithmCase[] };
    return parsed as AlgGroupOverlay;
  } catch {
    return null;
  }
}

/** Recomputes a variant's moving averages from `times` — done at merge time so the overlay never needs to store them (see hydrateVariant's defaults for the shape being extended). */
function withRecalculatedStats(variant: AlgorithmVariant, times: AlgorithmAttempt[], learningStatus: LearningStatus): AlgorithmVariant {
  return { ...variant, times, learningStatus, ...computeVariantStatsAttempts(times) };
}

/** Applies a sparse overlay onto freshly-hydrated bundled cases — `base` is never mutated. */
function applyOverlay(base: AlgorithmCase[], overlay: AlgGroupOverlay): AlgorithmCase[] {
  if (!overlay.variants && !overlay.cases) return base;
  return base.map((c) => {
    const caseOverlay = overlay.cases?.[c.name];
    const algList = c.algList.map((v) => {
      const vOverlay = overlay.variants?.[v.id];
      return vOverlay ? withRecalculatedStats(v, vOverlay.times, vOverlay.learningStatus) : v;
    });
    return caseOverlay ? { ...c, algList, selected: caseOverlay.selected } : { ...c, algList };
  });
}

/** The overlay that reproduces `cases`' dynamic state — everything derivable (stats) or matching the bundled default is left out. */
function buildOverlay(cases: AlgorithmCase[]): AlgGroupOverlay {
  const overlay: AlgGroupOverlay = {};
  for (const c of cases) {
    if (c.selected !== undefined) {
      overlay.cases ??= {};
      overlay.cases[c.name] = { selected: c.selected };
    }
    for (const v of c.algList) {
      if (v.times.length > 0 || v.learningStatus !== "not-started") {
        overlay.variants ??= {};
        overlay.variants[v.id] = { times: v.times, learningStatus: v.learningStatus };
      }
    }
  }
  return overlay;
}

/** Caps every `times` array in an overlay (whichever shape it's in) to its `cap` most recent entries — see writeAlgGroupWithQuotaFallback. */
function capOverlayTimes(data: AlgGroupOverlay, cap: number): AlgGroupOverlay {
  if (data.full) {
    return {
      ...data,
      full: data.full.map((c) => ({
        ...c,
        algList: c.algList.map((v) => (v.times.length > cap ? { ...v, times: v.times.slice(-cap) } : v)),
      })),
    };
  }
  if (!data.variants) return data;
  const variants: Record<string, StoredVariantOverlay> = {};
  for (const [id, v] of Object.entries(data.variants)) {
    variants[id] = v.times.length > cap ? { ...v, times: v.times.slice(-cap) } : v;
  }
  return { ...data, variants };
}

/**
 * Every recorded attempt appends to a variant's `times` forever, so a
 * heavily-drilled group (many cases × many variants × months of practice)
 * can outgrow localStorage's quota (see the QuotaExceededError reports for
 * alg_group_second-block-last-slot — though storing only the sparse
 * overlay, per this file's whole design, should make that dramatically
 * rarer than it used to be). Rather than let that throw out of
 * saveAlgGroup mid-attempt, cap every variant's `times` to an ever-smaller
 * number of its MOST RECENT entries and retry until the write fits — ao100
 * (the widest moving average this app computes) only ever looks at the last
 * 100 anyway, so a moderate cap costs nothing until quota is genuinely
 * exhausted.
 *
 * If trimming even down to ONE attempt per variant still doesn't fit, the
 * real problem is the ORIGIN's total localStorage usage (this key plus
 * every solve/every other algorithm group), not this group alone —
 * nothing left to cut here will fix that. Giving up by re-throwing would
 * crash the app on every future attempt in this group, which is strictly
 * worse than silently not persisting one save, so this logs loudly and
 * returns instead of throwing once the cap fallback is exhausted.
 */
function writeAlgGroupWithQuotaFallback(key: string, data: AlgGroupOverlay): void {
  const CAPS = [500, 200, 100, 50, 20, 5, 1];
  let current = data;
  let capIndex = -1;
  while (true) {
    try {
      localStorage.setItem(key, JSON.stringify(current));
      if (capIndex >= 0) {
        console.warn(`${key} exceeded storage quota — trimmed attempt history to the most recent ${CAPS[capIndex]} per variant.`);
      }
      return;
    } catch (err) {
      if (!isQuotaExceededError(err)) throw err;
      if (capIndex >= CAPS.length - 1) {
        console.error(
          `${key}: storage quota exhausted even with only 1 attempt kept per variant — this browser's total ` +
            "localStorage for this site is full (not just this group). This save was dropped; free up space via " +
            "Settings -> Clear all solve history / Reset all algorithm progress."
        );
        return;
      }
      capIndex++;
      current = capOverlayTimes(current, CAPS[capIndex]);
    }
  }
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
    displayConfigOverride: raw.displayConfigOverride,
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
 * A group id is either one of the built-ins (bundled JSON is the structure
 * source of truth) or any user-created id (algGroupRegistry.createGroup) —
 * for those there is no bundled JSON, so they're always in "full" mode
 * (see file doc comment) from their first case onward.
 */
export function loadAlgGroup(group: AlgGroup): AlgorithmCase[] {
  const raw = readRawGroupData(group);
  if (raw?.full) return raw.full;
  const base = loadFromJson(group);
  // Nothing stored at all — pure bundled defaults. Deliberately NOT written
  // to localStorage here: merely visiting/hydrating a never-touched group
  // used to eagerly persist its full default state, which is exactly what
  // was tipping already-near-full origins over quota on a cold page visit
  // (see the alg_group_second-block-last-slot reports) with nothing to show
  // for it — nothing has actually changed yet.
  if (!raw) return base;
  return applyOverlay(base, raw);
}

/** For dynamic-only mutations (attempts, learning status, selection) — stays in whichever mode (sparse overlay or full) the group is already in. */
export function saveAlgGroup(group: AlgGroup, cases: AlgorithmCase[]): void {
  const raw = readRawGroupData(group);
  const data: AlgGroupOverlay = raw?.full ? { full: cases } : buildOverlay(cases);
  writeAlgGroupWithQuotaFallback(storageKey(group), data);
}

/**
 * For structural mutations — the case/variant SET itself changed (added,
 * edited, deleted, or replaced wholesale by an import), which can't be
 * expressed as a delta against the bundled JSON. Switches (or keeps) the
 * group in "full" mode from now on.
 */
export function saveAlgGroupStructural(group: AlgGroup, cases: AlgorithmCase[]): void {
  writeAlgGroupWithQuotaFallback(storageKey(group), { full: cases });
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
  const next = applyAddCase(loadAlgGroup(group), newCase);
  if (!next) return false;
  saveAlgGroupStructural(group, next);
  return true;
}

/** Remove a whole case (all its variants) from a group. Structural (see updateCase). */
export function deleteCase(group: AlgGroup, caseName: string): void {
  saveAlgGroupStructural(group, applyDeleteCase(loadAlgGroup(group), caseName));
}

export function setCaseSelected(group: AlgGroup, caseName: string, selected: boolean): void {
  saveAlgGroup(group, applySetCaseSelected(loadAlgGroup(group), caseName, selected));
}

/** Bulk-set selected on multiple cases (all cases if caseNames is omitted). */
export function setSelectedBatch(group: AlgGroup, selected: boolean, caseNames?: string[]): void {
  saveAlgGroup(group, applySetSelectedBatch(loadAlgGroup(group), selected, caseNames));
}

/**
 * Generic "sparse overlay over a bundled/base case list" persistence engine.
 *
 * Case/variant STRUCTURE (name, algorithm text, category, YouTube link, ...)
 * comes from bundled JSON and never changes at runtime, so it's re-hydrated
 * fresh on every load instead of being duplicated into localStorage. Only
 * what a user actually DOES (attempt times, learning status, which cases
 * are selected) is persisted, as a sparse overlay keyed by variant id /
 * case name — see CasesOverlay.
 *
 * Shared by algorithmStore.ts (flat groups, key `alg_group_{id}`) and
 * algGroupRegistry.ts (subgroups — ZBLL/F2L/Advanced F2L/VLS patterns/slots
 * — key `alg_subgroup_{groupId}_{subgroupId}`); both just supply their own
 * storage key and their own "bundled base" case list.
 *
 * A case list loses this distinction the moment its case/variant SET itself
 * is edited (a case added/updated/deleted, or the whole list replaced by an
 * import) — there's no way to express "case #14 was renamed" as a delta
 * against the bundled JSON, so from that point on the overlay's `full`
 * field holds the WHOLE case list verbatim and the sparse fields are
 * ignored. A case list with no bundled base at all (a user-created group,
 * or a user-created subgroup) is always in this "full" mode, from its very
 * first case.
 *
 * PURE FUNCTIONS — no React hooks.
 */

import type { AlgorithmCase, AlgorithmVariant, AlgorithmAttempt, DisplayConfig, LearningStatus } from "../types/algorithm";
import { computeVariantStatsAttempts } from "../logic/statistics";

export function isQuotaExceededError(err: unknown): boolean {
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
export interface CasesOverlay {
  /** Non-default variant state (times.length > 0 or learningStatus !== "not-started"), keyed by variant id. */
  variants?: Record<string, StoredVariantOverlay>;
  /** Non-default case state (selected explicitly set), keyed by case name. */
  cases?: Record<string, StoredCaseOverlay>;
  /** Present once this case list has been structurally edited — see file doc comment. When set, this IS the whole list; variants/cases above are unused. */
  full?: AlgorithmCase[];
}

/** Parses whatever's on disk at `key`, transparently accepting a bare-`AlgorithmCase[]` value (this engine's own pre-refactor format, or any other caller that used to store one directly) as full-mode data. Null if nothing's stored yet. */
export function readRawOverlay(key: string): CasesOverlay | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return { full: parsed as AlgorithmCase[] };
    return parsed as CasesOverlay;
  } catch {
    return null;
  }
}

/** Recomputes a variant's moving averages from `times` — done at merge time so the overlay never needs to store them. */
function withRecalculatedStats(variant: AlgorithmVariant, times: AlgorithmAttempt[], learningStatus: LearningStatus): AlgorithmVariant {
  return { ...variant, times, learningStatus, ...computeVariantStatsAttempts(times) };
}

/** Applies a sparse overlay onto a freshly-hydrated bundled base — `base` is never mutated. */
export function applyOverlay(base: AlgorithmCase[], overlay: CasesOverlay): AlgorithmCase[] {
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
export function buildOverlay(cases: AlgorithmCase[]): CasesOverlay {
  const overlay: CasesOverlay = {};
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

/** Caps every `times` array in an overlay (whichever shape it's in) to its `cap` most recent entries — see writeOverlayWithQuotaFallback. */
function capOverlayTimes(data: CasesOverlay, cap: number): CasesOverlay {
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
 * heavily-drilled case list (many cases × many variants × months of
 * practice) can outgrow localStorage's quota. Rather than let that throw
 * mid-attempt, cap every variant's `times` to an ever-smaller number of its
 * MOST RECENT entries and retry until the write fits — ao100 (the widest
 * moving average this app computes) only ever looks at the last 100
 * anyway, so a moderate cap costs nothing until quota is genuinely
 * exhausted.
 *
 * If trimming even down to ONE attempt per variant still doesn't fit, the
 * real problem is the ORIGIN's total localStorage usage (every other key —
 * solves, every other algorithm group/subgroup), not this one alone —
 * nothing left to cut here will fix that. Giving up by re-throwing would
 * crash the app on every future attempt here, which is strictly worse than
 * silently not persisting one save, so this logs loudly and returns
 * instead of throwing once the cap fallback is exhausted.
 */
export function writeOverlayWithQuotaFallback(key: string, data: CasesOverlay): void {
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
            "localStorage for this site is full (not just this data). This save was dropped; free up space via " +
            "Settings -> Clear all solve history / Reset all algorithm progress."
        );
        return;
      }
      capIndex++;
      current = capOverlayTimes(current, CAPS[capIndex]);
    }
  }
}

/** For dynamic-only mutations (attempts, learning status, selection) — stays in whichever mode (sparse overlay or full) `key` is already in. */
export function saveOverlay(key: string, cases: AlgorithmCase[], base?: AlgorithmCase[]): void {
  if (base && isBuiltInList(base)) return writeOverlayWithQuotaFallback(key, buildBuiltInOverlay(cases, base) as unknown as CasesOverlay);
  const raw = readRawOverlay(key);
  const data: CasesOverlay = raw?.full ? { full: cases } : buildOverlay(cases);
  writeOverlayWithQuotaFallback(key, data);
}

/**
 * For structural mutations — the case/variant SET itself changed (added,
 * edited, deleted, or replaced wholesale by an import), which can't be
 * expressed as a delta against a bundled base. Switches (or keeps) `key`
 * in "full" mode from now on.
 */
export function saveOverlayStructural(key: string, cases: AlgorithmCase[], base?: AlgorithmCase[]): void {
  // A built-in list has no "full" mode: what's yours is stored as for any other change.
  if (base && isBuiltInList(base)) return saveOverlay(key, cases, base);
  writeOverlayWithQuotaFallback(key, { full: cases });
}

/** `base` merged with whatever overlay (if any) is stored at `key` — the general-purpose read, for a case list WITH a bundled base to fall back to. */
export function loadOverlayed(key: string, base: AlgorithmCase[]): AlgorithmCase[] {
  if (isBuiltInList(base)) return loadBuiltIn(key, base);
  const raw = readRawOverlay(key);
  if (raw?.full) return raw.full;
  // Nothing stored at all — pure bundled defaults. Deliberately NOT written
  // to localStorage here: merely visiting/hydrating a never-touched case
  // list used to eagerly persist its full default state, which is exactly
  // what tips an already-near-full origin over quota on a cold page visit,
  // with nothing to show for it — nothing has actually changed yet.
  if (!raw) return base;
  return applyOverlay(base, raw);
}

// ─── Built-in lists (v2): the bundled cases are read-only ───
//
// A built-in list (bundled OLL, PLL, F2L, ZBLL…) is never stored: only what's
// yours is, keyed by the variants' STABLE ids (algorithmStore.stableVariantId —
// from the case and the algorithm, not the list position):
//   variants  times + learning status (bundled variants and your own)
//   cases     selected for drilling
//   extra     variants of your own added to a built-in case
//   defaults  the variant you made the default, where it isn't the bundled one
//   hidden    cases you hid (built-in cases are hidden, never deleted)
//   display   a case's own look ("Advanced" in the case editor)
// Older data (sparse, keyed by list position — or a "full" copy after an edit)
// is migrated on first read; cases you had added to a built-in list move to a
// group of your own (see takeOrphanCases / algGroupRegistry).

interface ExtraVariant {
  id: string;
  name: string;
  alg: string;
  youtubeUrl?: string;
}
export interface BuiltInOverlay {
  v: 2;
  variants?: Record<string, StoredVariantOverlay>;
  cases?: Record<string, StoredCaseOverlay>;
  extra?: Record<string, ExtraVariant[]>;
  defaults?: Record<string, string>;
  hidden?: string[];
  display?: Record<string, Partial<DisplayConfig>>;
}

const isBuiltInList = (base: AlgorithmCase[]) => base.length > 0 && !!base[0].builtIn;
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const normAlg = (alg: string) => alg.replace(/[()]/g, "").replace(/\s+/g, " ").trim();

function readBuiltIn(key: string): BuiltInOverlay | CasesOverlay | null {
  return readRawOverlay(key) as BuiltInOverlay | CasesOverlay | null;
}

const ORPHANS_KEY = "nact_alg_orphans";
/** Cases you had added to a built-in list (before built-ins became read-only), waiting to move to a group of your own. */
export function takeOrphanCases(): { from: string; cases: AlgorithmCase[] }[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ORPHANS_KEY) ?? "[]") as { from: string; cases: AlgorithmCase[] }[];
    localStorage.removeItem(ORPHANS_KEY);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
function stashOrphans(from: string, cases: AlgorithmCase[]): void {
  if (!cases.length) return;
  try {
    const list = JSON.parse(localStorage.getItem(ORPHANS_KEY) ?? "[]") as { from: string; cases: AlgorithmCase[] }[];
    list.push({ from, cases });
    localStorage.setItem(ORPHANS_KEY, JSON.stringify(list));
  } catch {
    // not kept
  }
}

/** Old storage (v1) of a built-in list → v2. Returns the v2 overlay and the cases that aren't built-in (yours). */
export function migrateToBuiltIn(raw: CasesOverlay, base: AlgorithmCase[]): { overlay: BuiltInOverlay; orphans: AlgorithmCase[] } {
  const ov: BuiltInOverlay = { v: 2 };
  const orphans: AlgorithmCase[] = [];
  const put = (id: string, v: { times: AlgorithmAttempt[]; learningStatus: LearningStatus }) => {
    if (!v.times?.length && (v.learningStatus ?? "not-started") === "not-started") return;
    (ov.variants ??= {})[id] = { times: v.times ?? [], learningStatus: v.learningStatus ?? "not-started" };
  };
  if (raw.full) {
    const byName = new Map(base.map((c) => [c.name, c]));
    const kept = new Set<string>();
    for (const fc of raw.full) {
      const bc = byName.get(fc.name);
      if (!bc) {
        orphans.push(fc);
        continue;
      }
      kept.add(fc.name);
      const unmatched = [...bc.algList];
      let defaultId: string | undefined;
      for (const fv of fc.algList) {
        const i = unmatched.findIndex((bv) => normAlg(bv.alg) === normAlg(fv.alg));
        let id: string;
        if (i >= 0) {
          id = unmatched[i].id;
          unmatched.splice(i, 1);
        } else {
          id = fv.id && !fv.id.startsWith("b-") ? fv.id : `u-${Math.random().toString(36).slice(2, 10)}`;
          (ov.extra ??= {})[fc.name] = [...(ov.extra?.[fc.name] ?? []), { id, name: fv.name, alg: fv.alg, ...(fv.youtubeUrl ? { youtubeUrl: fv.youtubeUrl } : {}) }];
        }
        put(id, fv);
        if (fv.isDefault) defaultId ??= id;
      }
      const baseDefault = (bc.algList.find((v) => v.isDefault) ?? bc.algList[0])?.id;
      if (defaultId && defaultId !== baseDefault) (ov.defaults ??= {})[fc.name] = defaultId;
      if (fc.selected !== undefined) (ov.cases ??= {})[fc.name] = { selected: fc.selected };
      if (!sameJson(fc.displayConfigOverride, bc.displayConfigOverride) && fc.displayConfigOverride) (ov.display ??= {})[fc.name] = fc.displayConfigOverride;
    }
    const hidden = base.filter((c) => !kept.has(c.name)).map((c) => c.name);
    if (hidden.length) ov.hidden = hidden;
  } else {
    const byLegacy = new Map(base.flatMap((c) => c.algList.map((v) => [v.legacyId ?? v.id, v.id] as const)));
    for (const [oldId, v] of Object.entries(raw.variants ?? {})) {
      const id = byLegacy.get(oldId);
      if (id) put(id, v);
    }
    if (raw.cases) ov.cases = raw.cases;
  }
  return { overlay: ov, orphans };
}

/** Your data (v2) over the bundled cases. */
function applyBuiltIn(base: AlgorithmCase[], ov: BuiltInOverlay): AlgorithmCase[] {
  const hidden = new Set(ov.hidden ?? []);
  return base.map((c) => {
    const variant = (v: AlgorithmVariant): AlgorithmVariant => {
      const o = ov.variants?.[v.id];
      return o ? withRecalculatedStats(v, o.times, o.learningStatus) : { ...v };
    };
    const extras: AlgorithmVariant[] = (ov.extra?.[c.name] ?? []).map((e) =>
      variant({ id: e.id, name: e.name, alg: e.alg, youtubeUrl: e.youtubeUrl, isDefault: false, times: [], ao5: null, ao12: null, ao100: null, bestTime: null, learningStatus: "not-started" })
    );
    let algList = [...c.algList.map(variant), ...extras];
    const chosen = ov.defaults?.[c.name];
    if (chosen && algList.some((v) => v.id === chosen)) algList = algList.map((v) => ({ ...v, isDefault: v.id === chosen }));
    const selected = ov.cases?.[c.name]?.selected;
    const display = ov.display?.[c.name];
    return {
      ...c,
      algList,
      ...(selected !== undefined ? { selected } : {}),
      ...(display ? { displayConfigOverride: display } : {}),
      ...(hidden.has(c.name) ? { hidden: true } : {}),
    };
  });
}

/** What of `cases` is yours (v2), against the bundled `base`. Cases not in `base` can't be kept here (they belong in a group of your own). */
export function buildBuiltInOverlay(cases: AlgorithmCase[], base: AlgorithmCase[]): BuiltInOverlay {
  const ov: BuiltInOverlay = { v: 2 };
  const byName = new Map(base.map((c) => [c.name, c]));
  for (const c of cases) {
    const bc = byName.get(c.name);
    if (!bc) continue;
    const baseIds = new Set(bc.algList.map((v) => v.id));
    for (const v of c.algList) {
      if (v.times.length > 0 || v.learningStatus !== "not-started") (ov.variants ??= {})[v.id] = { times: v.times, learningStatus: v.learningStatus };
      if (!baseIds.has(v.id)) (ov.extra ??= {})[c.name] = [...(ov.extra?.[c.name] ?? []), { id: v.id, name: v.name, alg: v.alg, ...(v.youtubeUrl ? { youtubeUrl: v.youtubeUrl } : {}) }];
    }
    const def = (c.algList.find((v) => v.isDefault) ?? c.algList[0])?.id;
    const baseDef = (bc.algList.find((v) => v.isDefault) ?? bc.algList[0])?.id;
    if (def && def !== baseDef) (ov.defaults ??= {})[c.name] = def;
    if (c.selected !== undefined) (ov.cases ??= {})[c.name] = { selected: c.selected };
    if (c.hidden) (ov.hidden ??= []).push(c.name);
    if (c.displayConfigOverride && !sameJson(c.displayConfigOverride, bc.displayConfigOverride)) (ov.display ??= {})[c.name] = c.displayConfigOverride;
  }
  return ov;
}

function loadBuiltIn(key: string, base: AlgorithmCase[]): AlgorithmCase[] {
  let raw = readBuiltIn(key);
  if (raw && (raw as BuiltInOverlay).v !== 2) {
    const { overlay, orphans } = migrateToBuiltIn(raw as CasesOverlay, base);
    stashOrphans(key, orphans);
    writeOverlayWithQuotaFallback(key, overlay as unknown as CasesOverlay);
    raw = overlay;
  }
  return applyBuiltIn(base, (raw as BuiltInOverlay | null) ?? { v: 2 });
}

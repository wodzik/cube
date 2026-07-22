/**
 * Registry of Practice groups — metadata (display config, subgroups) for
 * every group, dynamic and built-in alike.
 *
 * The 7 originally-hardcoded groups (oll/pll/f2l-front-right/f2l-front-left/
 * f2l-back-right/f2l-back-left/f2l-advanced) keep their exact ids and their
 * CASE DATA keeps living at the existing `alg_group_{id}` localStorage key,
 * read via algorithmStore's loadAlgGroup/saveAlgGroup exactly as before —
 * this registry only adds METADATA (display config) alongside it, seeded
 * once from what used to be algGroupConfig.ts's hardcoded tables. Existing
 * stats/learning-status data is never touched by anything in this file.
 *
 * A group with `hasSubgroups: true` is necessarily user-created (built-ins
 * never have subgroups) and stores its subgroups' case lists INSIDE this
 * registry entry, not in a separate alg_group_{id} key — there is no
 * pre-existing data to preserve for those, so it's simplest to keep it
 * self-contained.
 *
 * PURE FUNCTIONS — no React hooks.
 */

import type { AlgGroupMeta, AlgSubgroup, AlgorithmCase, AlgorithmAttempt, DisplayConfig, LearningStatus, StickeringConfig } from "../types/algorithm";
import type { StickeringMaskOrbits, VisualizationMode } from "../types/cube";
import { loadAlgGroup, saveAlgGroup, resetAlgGroup, hydrateCasesFromRaw, type RawCase } from "./algorithmStore";
import { buildMaskFromPieceGroups } from "../logic/maskPieceGroups";
import {
  applyRecordAttempt,
  applySetLearningStatus,
  applyUpdateCase,
  applyAddCase,
  applyDeleteCase,
  applySetCaseSelected,
  applySetSelectedBatch,
} from "../logic/caseMutations";
import zbllJson from "../algs/zbll.json";
import advancedF2lJson from "../algs/advanced-f2l.json";

const REGISTRY_KEY = "nact_alg_groups";

interface RawSubgroup {
  id: string;
  name: string;
  previewAlg: string;
  cases: RawCase[];
}

/** ZBLL — bundled like OLL/PLL/F2L, but shipped pre-split into its 7 top-pattern subgroups (see scrape-zbll.mjs in the repo root). Built fresh from the bundled JSON on demand so "reset" can rebuild it exactly like the flat built-ins reload from their JSON. */
function buildZbllMeta(): AlgGroupMeta {
  const subgroups: AlgSubgroup[] = (zbllJson as { subgroups: RawSubgroup[] }).subgroups.map((sg) => ({
    id: sg.id,
    name: sg.name,
    previewAlg: sg.previewAlg,
    cases: hydrateCasesFromRaw(sg.cases, sg.id),
  }));
  return {
    id: "zbll",
    name: "ZBLL",
    isBuiltIn: true,
    displayConfig: {
      // ZBLL needs full last-layer color info (orientation + permutation).
      stickering: { kind: "named", value: "PLL" },
      cardVisualization: "experimental-2D-LL",
      cubeVisualization: "3D",
      cameraLatitude: 20,
      cameraLongitude: 20,
    },
    previewAlg: subgroups[0]?.previewAlg ?? "",
    hasSubgroups: true,
    subgroups,
    // 472 cases is a lot for a flat Attack queue — off by default, user-toggleable.
    availableInAttack: false,
  };
}

const F2L_SLOT_IDS = ["f2l-front-right", "f2l-front-left", "f2l-back-right", "f2l-back-left"] as const;
const F2L_SLOT_LABELS: Record<(typeof F2L_SLOT_IDS)[number], string> = {
  "f2l-front-right": "Front Right",
  "f2l-front-left": "Front Left",
  "f2l-back-right": "Back Right",
  "f2l-back-left": "Back Left",
};

/**
 * F2L — used to be 4 separate flat built-in groups (one per slot); now one
 * built-in group with 4 subgroups. loadAlgGroup(oldId) is reused as the data
 * source for each subgroup: on a fresh install it falls through to that
 * slot's bundled JSON exactly as before, and on an existing install it
 * returns whatever's actually in `alg_group_{oldId}` — so this single
 * function is both "seed fresh" and "migrate existing progress" at once,
 * the same as loadAlgGroup already was for the old flat groups.
 */
function buildF2LMeta(): AlgGroupMeta {
  const subgroups: AlgSubgroup[] = F2L_SLOT_IDS.map((oldId) => {
    const cases = loadAlgGroup(oldId);
    const previewAlg = cases[0]?.algList.find((v) => v.isDefault)?.alg ?? cases[0]?.algList[0]?.alg ?? "";
    return { id: oldId.replace("f2l-", ""), name: F2L_SLOT_LABELS[oldId], previewAlg, cases };
  });
  return {
    id: "f2l",
    name: "F2L",
    isBuiltIn: true,
    displayConfig: { stickering: { kind: "named", value: "F2L" }, cardVisualization: "3D", cubeVisualization: "3D", cameraLatitude: 20, cameraLongitude: 25 },
    previewAlg: subgroups[0]?.previewAlg ?? "",
    hasSubgroups: true,
    subgroups,
    availableInAttack: true,
  };
}

/** Advanced F2L (speedcubedb.com, scrape-advanced-f2l.mjs) — same per-slot subgroup shape as the merged F2L group above, but a much larger, separate set (not merged into it, since these are largely NOT the same cases as the plain F2L set). */
function buildAdvancedF2LMeta(): AlgGroupMeta {
  const subgroups: AlgSubgroup[] = (advancedF2lJson as { subgroups: RawSubgroup[] }).subgroups.map((sg) => ({
    id: sg.id,
    name: sg.name,
    previewAlg: sg.previewAlg,
    cases: hydrateCasesFromRaw(sg.cases, sg.id),
  }));
  return {
    id: "advanced-f2l",
    name: "Advanced F2L",
    isBuiltIn: true,
    displayConfig: { stickering: { kind: "named", value: "F2L" }, cardVisualization: "3D", cubeVisualization: "3D", cameraLatitude: 20, cameraLongitude: 25 },
    previewAlg: subgroups[0]?.previewAlg ?? "",
    hasSubgroups: true,
    subgroups,
    // 216 cases, uncertain fit for a timed queue — off by default, user-toggleable.
    availableInAttack: false,
  };
}

/** Built-ins added after initial release don't exist in an already-seeded registry — inject/migrate them once, self-healing, same idea as migrateDisplayConfig above. */
function ensureBuiltInExtras(groups: AlgGroupMeta[]): AlgGroupMeta[] {
  let next = groups;
  let changed = false;

  if (!next.some((g) => g.id === "zbll")) {
    next = [...next, buildZbllMeta()];
    changed = true;
  }

  if (!next.some((g) => g.id === "f2l")) {
    // Drop the 4 old flat slot groups (if present) — their data was already
    // folded into buildF2LMeta()'s subgroups via loadAlgGroup above.
    next = [...next.filter((g) => !(F2L_SLOT_IDS as readonly string[]).includes(g.id)), buildF2LMeta()];
    F2L_SLOT_IDS.forEach(resetAlgGroup);
    changed = true;
  }

  if (!next.some((g) => g.id === "advanced-f2l")) {
    next = [...next, buildAdvancedF2LMeta()];
    changed = true;
  }

  // One-time rename: this group's original bundled name was "F2L Adv" — now
  // that "Advanced F2L" names the bigger speedcubedb-scraped set, disambiguate
  // this one as its origin (J Perm's algorithm sheet). Only touches it if the
  // name is still exactly the old default, so a user's own rename is left alone.
  const advIdx = next.findIndex((g) => g.id === "f2l-advanced");
  if (advIdx >= 0 && (next[advIdx].name === "F2L Adv" || next[advIdx].availableInAttack === undefined)) {
    next = [...next];
    next[advIdx] = {
      ...next[advIdx],
      name: next[advIdx].name === "F2L Adv" ? "Advanced F2L (J Perm)" : next[advIdx].name,
      availableInAttack: false,
    };
    changed = true;
  }

  // Any other flat built-in added after initial release (e.g. COLL/CMLL/
  // Winter Variation) — append whichever of BUILT_IN_SEED isn't in the
  // registry yet. BUILT_IN_SEED is declared further down this module but
  // this function's body only runs when called (via listGroups()), by
  // which point the whole module has finished initializing.
  for (const seed of BUILT_IN_SEED) {
    if (!next.some((g) => g.id === seed.id)) {
      next = [...next, { id: seed.id, name: seed.name, isBuiltIn: true, displayConfig: seed.displayConfig, hasSubgroups: false }];
      changed = true;
    }
  }

  if (changed) writeRegistry(next);
  return next;
}

/** The built-in groups that shipped with the app, and their original hardcoded display config (was algGroupConfig.ts). Cards get the compact 2D-last-layer grid for OLL/PLL; the cube preview always defaults to 3D. F2L's 4 slots and ZBLL/Advanced F2L are added separately (see ensureBuiltInExtras) since they need subgroups. */
const BUILT_IN_SEED: { id: string; name: string; displayConfig: DisplayConfig }[] = [
  { id: "oll", name: "OLL", displayConfig: { stickering: { kind: "named", value: "OLL" }, cardVisualization: "experimental-2D-LL", cubeVisualization: "3D", cameraLatitude: 20, cameraLongitude: 20 } },
  { id: "pll", name: "PLL", displayConfig: { stickering: { kind: "named", value: "PLL" }, cardVisualization: "experimental-2D-LL", cubeVisualization: "3D", cameraLatitude: 20, cameraLongitude: 20 } },
  // COLL solves LL corner orientation+permutation together — full-info PLL-style stickering (same reason PLL needs it: permutation matters, not just orientation).
  { id: "coll", name: "COLL", displayConfig: { stickering: { kind: "named", value: "PLL" }, cardVisualization: "experimental-2D-LL", cubeVisualization: "3D", cameraLatitude: 20, cameraLongitude: 20 } },
  // CMLL (Roux) only cares about the 4 top corners — mask to just those (top edges + everything else greyed out), not a named scheme.
  {
    id: "cmll",
    name: "CMLL",
    displayConfig: {
      stickering: { kind: "mask", pieceGroups: ["u-corners"] },
      cardVisualization: "experimental-2D-LL",
      cubeVisualization: "3D",
      cameraLatitude: 20,
      cameraLongitude: 20,
    },
  },
  { id: "winter-variation", name: "Winter Variation", displayConfig: { stickering: { kind: "named", value: "OLL" }, cardVisualization: "experimental-2D-LL", cubeVisualization: "3D", cameraLatitude: 20, cameraLongitude: 20 } },
  { id: "f2l-advanced", name: "F2L Adv", displayConfig: { stickering: { kind: "named", value: "F2L" }, cardVisualization: "3D", cubeVisualization: "3D", cameraLatitude: 20, cameraLongitude: 25 } },
];

/**
 * Self-healing migration for the pre-split `{ visualization }` shape (before
 * card/cube preview had independent settings) — maps it onto both new
 * fields so a group configured before this split keeps behaving exactly as
 * it did, instead of silently losing its visualization to the default.
 */
function migrateDisplayConfig<T extends Partial<DisplayConfig> | undefined>(dc: T): T {
  if (!dc || "cardVisualization" in dc) return dc;
  const legacy = dc as Partial<DisplayConfig> & { visualization?: VisualizationMode };
  if (!legacy.visualization) return dc;
  const { visualization, ...rest } = legacy;
  return { ...rest, cardVisualization: visualization, cubeVisualization: visualization } as T;
}

function readRegistry(): AlgGroupMeta[] | null {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return null;
    const groups = JSON.parse(raw) as AlgGroupMeta[];
    let migrated = false;
    const next = groups.map((g) => {
      let displayConfig = migrateDisplayConfig(g.displayConfig);
      // Built-ins never actually had an independent cube-preview setting
      // before this split — the practice panel's cube was always 3D
      // regardless of group. A legacy shape means that distinction was
      // lost (folded into one field); restore the real built-in default
      // instead of carrying the card's 2D-LL value onto the cube preview.
      if (g.isBuiltIn && displayConfig !== g.displayConfig) {
        const seed = BUILT_IN_SEED.find((s) => s.id === g.id);
        if (seed) displayConfig = { ...displayConfig, cubeVisualization: seed.displayConfig.cubeVisualization };
      }
      const subgroups = g.subgroups?.map((s) => {
        const sDisplayConfig = migrateDisplayConfig(s.displayConfig);
        if (sDisplayConfig !== s.displayConfig) migrated = true;
        return sDisplayConfig === s.displayConfig ? s : { ...s, displayConfig: sDisplayConfig };
      });
      if (displayConfig !== g.displayConfig) migrated = true;
      return displayConfig === g.displayConfig && subgroups === g.subgroups ? g : { ...g, displayConfig, subgroups };
    });
    if (migrated) writeRegistry(next);
    return next;
  } catch {
    return null;
  }
}

function writeRegistry(groups: AlgGroupMeta[]): void {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(groups));
}

function seedRegistry(): AlgGroupMeta[] {
  // Just the plain flat built-ins here — zbll/f2l/advanced-f2l (all
  // subgroup-based) are added right after by ensureBuiltInExtras, which
  // also handles adding them to an already-seeded EXISTING registry, so
  // there's no reason to duplicate that logic for the fresh-install case.
  const groups: AlgGroupMeta[] = BUILT_IN_SEED.map((g) => ({
    id: g.id,
    name: g.name,
    isBuiltIn: true,
    displayConfig: g.displayConfig,
    hasSubgroups: false,
  }));
  writeRegistry(groups);
  return groups;
}

/** Fixed display order for the built-ins — everything else (user-created groups) sorts after, in creation order. */
const BUILT_IN_ORDER = ["f2l", "oll", "pll", "coll", "cmll", "winter-variation", "f2l-advanced", "advanced-f2l", "zbll"];

function sortGroups(groups: AlgGroupMeta[]): AlgGroupMeta[] {
  // Array.prototype.sort is stable (ES2019+), so custom groups (index -1,
  // sorted after everything named) keep their relative creation order.
  return [...groups].sort((a, b) => {
    const ai = BUILT_IN_ORDER.indexOf(a.id);
    const bi = BUILT_IN_ORDER.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/** All registered groups, built-in + user-created, seeding the built-ins on first call. */
export function listGroups(): AlgGroupMeta[] {
  return sortGroups(ensureBuiltInExtras(readRegistry() ?? seedRegistry()));
}

export function getGroupMeta(id: string): AlgGroupMeta | undefined {
  return listGroups().find((g) => g.id === id);
}

/** Reload a built-in group from its bundled data, discarding any recorded times/learning status — the built-in equivalent of algorithmStore's resetAlgGroup, extended to cover subgroup-based built-ins (whose cases live in the registry, not an alg_group_{id} key). */
export function resetBuiltInGroup(id: string): void {
  const meta = getGroupMeta(id);
  if (!meta?.isBuiltIn) return;
  if (id === "zbll") {
    updateGroupMeta(id, { subgroups: buildZbllMeta().subgroups });
  } else if (id === "advanced-f2l") {
    updateGroupMeta(id, { subgroups: buildAdvancedF2LMeta().subgroups });
  } else if (id === "f2l") {
    F2L_SLOT_IDS.forEach(resetAlgGroup);
    updateGroupMeta(id, { subgroups: buildF2LMeta().subgroups });
  } else {
    resetAlgGroup(id);
  }
}

function slugify(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "group";
}

/** Unique id for a new group — slugified name, deduped against existing ids. */
function uniqueGroupId(name: string, existing: AlgGroupMeta[]): string {
  const base = slugify(name);
  if (!existing.some((g) => g.id === base)) return base;
  let i = 2;
  while (existing.some((g) => g.id === `${base}-${i}`)) i++;
  return `${base}-${i}`;
}

const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  stickering: { kind: "named", value: "full" },
  cardVisualization: "3D",
  cubeVisualization: "3D",
  cameraLatitude: 20,
  cameraLongitude: 20,
};

/** Create a new, empty (or subgroup-only) group. Returns the new id. */
export function createGroup(
  name: string,
  displayConfig: DisplayConfig = DEFAULT_DISPLAY_CONFIG,
  hasSubgroups = false,
  previewAlg = ""
): string {
  const groups = listGroups();
  const id = uniqueGroupId(name, groups);
  const meta: AlgGroupMeta = {
    id,
    name: name.trim() || id,
    isBuiltIn: false,
    displayConfig,
    previewAlg,
    hasSubgroups,
    ...(hasSubgroups ? { subgroups: [] } : {}),
  };
  writeRegistry([...groups, meta]);
  if (!hasSubgroups) saveAlgGroup(id, []); // fresh flat group starts with no cases; subgroup groups keep cases inside the registry entry
  return id;
}

export function updateGroupMeta(id: string, patch: Partial<Omit<AlgGroupMeta, "id" | "isBuiltIn">>): void {
  const groups = listGroups();
  const i = groups.findIndex((g) => g.id === id);
  if (i < 0) return;
  groups[i] = { ...groups[i], ...patch };
  writeRegistry(groups);
}

/** Refuses to delete a built-in group. Returns false if blocked or not found. */
export function deleteGroup(id: string): boolean {
  const groups = listGroups();
  const meta = groups.find((g) => g.id === id);
  if (!meta || meta.isBuiltIn) return false;
  writeRegistry(groups.filter((g) => g.id !== id));
  if (!meta.hasSubgroups) resetAlgGroup(id);
  return true;
}

// ─── Subgroups ───

export function addSubgroup(groupId: string, subgroup: Omit<AlgSubgroup, "cases">): void {
  const groups = listGroups();
  const i = groups.findIndex((g) => g.id === groupId);
  if (i < 0) return;
  const existing = groups[i].subgroups ?? [];
  groups[i] = { ...groups[i], hasSubgroups: true, subgroups: [...existing, { ...subgroup, cases: [] }] };
  writeRegistry(groups);
}

export function updateSubgroupMeta(groupId: string, subgroupId: string, patch: Partial<Omit<AlgSubgroup, "id" | "cases">>): void {
  const groups = listGroups();
  const gi = groups.findIndex((g) => g.id === groupId);
  if (gi < 0 || !groups[gi].subgroups) return;
  const subgroups = groups[gi].subgroups!.map((s) => (s.id === subgroupId ? { ...s, ...patch } : s));
  groups[gi] = { ...groups[gi], subgroups };
  writeRegistry(groups);
}

export function deleteSubgroup(groupId: string, subgroupId: string): void {
  const groups = listGroups();
  const gi = groups.findIndex((g) => g.id === groupId);
  if (gi < 0 || !groups[gi].subgroups) return;
  groups[gi] = { ...groups[gi], subgroups: groups[gi].subgroups!.filter((s) => s.id !== subgroupId) };
  writeRegistry(groups);
}

export function getSubgroupCases(groupId: string, subgroupId: string): AlgorithmCase[] {
  return getGroupMeta(groupId)?.subgroups?.find((s) => s.id === subgroupId)?.cases ?? [];
}

export function saveSubgroupCases(groupId: string, subgroupId: string, cases: AlgorithmCase[]): void {
  const groups = listGroups();
  const gi = groups.findIndex((g) => g.id === groupId);
  if (gi < 0 || !groups[gi].subgroups) return;
  const subgroups = groups[gi].subgroups!.map((s) => (s.id === subgroupId ? { ...s, cases } : s));
  groups[gi] = { ...groups[gi], subgroups };
  writeRegistry(groups);
}

// ─── Subgroup case mutations — same transforms as algorithmStore.ts's
// alg_group_{id}-backed API, applied to a subgroup's own case list instead. ───

export function recordSubgroupAttempt(
  groupId: string,
  subgroupId: string,
  caseName: string,
  variantId: string,
  attempt: AlgorithmAttempt
): void {
  saveSubgroupCases(groupId, subgroupId, applyRecordAttempt(getSubgroupCases(groupId, subgroupId), caseName, variantId, attempt));
}

export function setSubgroupLearningStatus(
  groupId: string,
  subgroupId: string,
  caseName: string,
  variantId: string,
  status: LearningStatus
): void {
  saveSubgroupCases(
    groupId,
    subgroupId,
    applySetLearningStatus(getSubgroupCases(groupId, subgroupId), caseName, variantId, status)
  );
}

export function updateSubgroupCase(groupId: string, subgroupId: string, updated: AlgorithmCase): void {
  saveSubgroupCases(groupId, subgroupId, applyUpdateCase(getSubgroupCases(groupId, subgroupId), updated));
}

/** Rejects a duplicate name (same semantics as algorithmStore's addCase). */
export function addSubgroupCase(groupId: string, subgroupId: string, newCase: AlgorithmCase): boolean {
  const next = applyAddCase(getSubgroupCases(groupId, subgroupId), newCase);
  if (!next) return false;
  saveSubgroupCases(groupId, subgroupId, next);
  return true;
}

export function deleteSubgroupCase(groupId: string, subgroupId: string, caseName: string): void {
  saveSubgroupCases(groupId, subgroupId, applyDeleteCase(getSubgroupCases(groupId, subgroupId), caseName));
}

export function setSubgroupCaseSelected(groupId: string, subgroupId: string, caseName: string, selected: boolean): void {
  saveSubgroupCases(groupId, subgroupId, applySetCaseSelected(getSubgroupCases(groupId, subgroupId), caseName, selected));
}

export function setSubgroupSelectedBatch(groupId: string, subgroupId: string, selected: boolean, caseNames?: string[]): void {
  saveSubgroupCases(groupId, subgroupId, applySetSelectedBatch(getSubgroupCases(groupId, subgroupId), selected, caseNames));
}

// ─── Display config resolution ───

/** Group → subgroup → case, later wins. Every field is independently overridable. */
export function resolveDisplayConfig(
  groupMeta: AlgGroupMeta | undefined,
  subgroupOverride?: Partial<DisplayConfig>,
  caseOverride?: Partial<DisplayConfig>
): DisplayConfig {
  return {
    ...DEFAULT_DISPLAY_CONFIG,
    ...groupMeta?.displayConfig,
    ...migrateDisplayConfig(subgroupOverride),
    ...migrateDisplayConfig(caseOverride),
  };
}

/** A resolved StickeringConfig, translated into whichever CubeVisualisation prop it needs (named string vs. piece-level mask). */
export function resolveStickeringProps(
  stickering: StickeringConfig
): { stickering?: string; stickeringMaskOrbits?: StickeringMaskOrbits } {
  if (stickering.kind === "named") return { stickering: stickering.value };
  return { stickeringMaskOrbits: stickering.rawOverride ?? buildMaskFromPieceGroups(stickering.pieceGroups) };
}

// ─── Export / import ───

interface GroupExportFile {
  formatVersion: 1;
  name: string;
  displayConfig: DisplayConfig;
  hasSubgroups: boolean;
  cases?: AlgorithmCase[];
  subgroups?: AlgSubgroup[];
}

/** Serialize a group (its display config + cases, or + subgroups) to a JSON string ready to download. */
export function exportGroup(id: string): string {
  const meta = getGroupMeta(id);
  if (!meta) throw new Error(`Unknown group: ${id}`);
  const file: GroupExportFile = {
    formatVersion: 1,
    name: meta.name,
    displayConfig: meta.displayConfig,
    hasSubgroups: meta.hasSubgroups,
    ...(meta.hasSubgroups ? { subgroups: meta.subgroups ?? [] } : { cases: loadAlgGroup(id) }),
  };
  return JSON.stringify(file, null, 2);
}

/**
 * Import a group from a JSON string (either this app's own export format, or
 * a bare `RawCase[]` array like the bundled built-in files' shape — treated
 * as a flat, no-subgroups group named after `fallbackName`).
 */
export function importGroup(json: string, fallbackName: string): string {
  const parsed: unknown = JSON.parse(json);

  if (Array.isArray(parsed)) {
    const id = createGroup(fallbackName);
    saveAlgGroup(id, hydrateCasesFromRaw(parsed as RawCase[], id));
    return id;
  }

  const file = parsed as Partial<GroupExportFile>;
  if (typeof file.name !== "string" || typeof file.hasSubgroups !== "boolean") {
    throw new Error("Not a recognised group export file");
  }
  const groups = listGroups();
  const id = uniqueGroupId(file.name, groups);
  const displayConfig = file.displayConfig ?? DEFAULT_DISPLAY_CONFIG;
  const meta: AlgGroupMeta = {
    id,
    name: file.name,
    isBuiltIn: false,
    displayConfig,
    hasSubgroups: file.hasSubgroups,
    ...(file.hasSubgroups ? { subgroups: file.subgroups ?? [] } : {}),
  };
  writeRegistry([...groups, meta]);
  if (!file.hasSubgroups) saveAlgGroup(id, file.cases ?? []);
  return id;
}

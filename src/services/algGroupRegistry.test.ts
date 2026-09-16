import { describe, it, expect, beforeEach } from "bun:test";
import "../testSetup";
import {
  listGroups,
  getGroupMeta,
  getSubgroupCases,
  saveSubgroupCases,
  recordSubgroupAttempt,
  setSubgroupLearningStatus,
  setSubgroupCaseSelected,
  updateSubgroupCase,
  addSubgroupCase,
  deleteSubgroupCase,
  addSubgroup,
  deleteSubgroup,
  createGroup,
  deleteGroup,
  resetBuiltInGroup,
  exportGroup,
  importGroup,
} from "./algGroupRegistry";
import { loadAlgGroup, recordAttempt } from "./algorithmStore";
import type { AlgorithmCase } from "../types/algorithm";

/** Raw on-disk value for a localStorage key — asserting on this (not the hydrated API output) confirms WHAT'S actually persisted, not just what's readable back. */
function rawStored(key: string): unknown {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : undefined;
}

function makeCase(name: string, variantId = `${name}-v0`): AlgorithmCase {
  return {
    name,
    category: "Test",
    algList: [
      {
        id: variantId,
        name: "Main",
        alg: "R U R' U'",
        isDefault: true,
        times: [],
        ao5: null,
        ao12: null,
        ao100: null,
        bestTime: null,
        learningStatus: "not-started",
      },
    ],
  };
}

describe("algGroupRegistry — subgroup case storage (ZBLL/F2L/Advanced F2L/VLS pattern)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("listGroups() never hydrates subgroup cases — cheap [] placeholders, no per-subgroup localStorage reads needed", () => {
    const zbll = listGroups().find((g) => g.id === "zbll")!;
    expect(zbll.hasSubgroups).toBe(true);
    expect(zbll.subgroups!.length).toBe(7);
    for (const sg of zbll.subgroups!) expect(sg.cases).toEqual([]);
  });

  it("nact_alg_groups never carries subgroup case data, even for the biggest bundled set (ZBLL, 472 cases)", () => {
    listGroups(); // first-time seed/build
    const raw = rawStored("nact_alg_groups") as { id: string; subgroups?: { cases: unknown[] }[] }[];
    const zbll = raw.find((g) => g.id === "zbll")!;
    for (const sg of zbll.subgroups!) expect(sg.cases).toEqual([]);
    // Sanity: the whole registry blob stays small — nowhere near what 472
    // fully-hydrated cases would cost if they were embedded.
    expect(JSON.stringify(raw).length).toBeLessThan(20_000);
  });

  it("getGroupMeta() hydrates that ONE group's subgroups with real bundled cases", () => {
    const zbll = getGroupMeta("zbll")!;
    expect(zbll.subgroups![0].cases.length).toBeGreaterThan(0);
    expect(zbll.subgroups![0].cases[0].name).toBeTruthy();
  });

  it("getSubgroupCases() returns the bundled cases for one pattern without touching localStorage", () => {
    const cases = getSubgroupCases("zbll", "zbll-u");
    expect(cases.length).toBeGreaterThan(0);
    expect(localStorage.getItem("alg_subgroup_zbll_zbll-u")).toBeNull();
  });

  it("recording an attempt on a ZBLL case persists ONLY a sparse overlay at its own key — no case names/algs, nothing in nact_alg_groups", () => {
    const cases = getSubgroupCases("zbll", "zbll-u");
    const caseName = cases[0].name;
    const variantId = cases[0].algList[0].id;
    recordSubgroupAttempt("zbll", "zbll-u", caseName, variantId, { time: 4.2, hadErrors: false });

    const raw = rawStored("alg_subgroup_zbll_zbll-u") as { variants?: Record<string, unknown>; full?: unknown };
    expect(raw.full).toBeUndefined();
    expect(Object.keys(raw.variants!)).toEqual([variantId]);
    expect(JSON.stringify(raw)).not.toContain(caseName);
    expect(JSON.stringify(raw)).not.toContain(cases[0].algList[0].alg);

    // Sibling subgroups are untouched, and the registry was never even
    // read/written by this — recordSubgroupAttempt only ever touches this
    // one subgroup's own overlay key.
    expect(localStorage.getItem("alg_subgroup_zbll_zbll-l")).toBeNull();
    expect(localStorage.getItem("nact_alg_groups")).toBeNull();

    // And it reads back correctly, merged onto the bundled base.
    const reloaded = getSubgroupCases("zbll", "zbll-u");
    const variant = reloaded.find((c) => c.name === caseName)!.algList[0];
    expect(variant.times).toHaveLength(1);
    expect(variant.bestTime).toBe(4.2);
  });

  it("setSubgroupLearningStatus / setSubgroupCaseSelected persist correctly for a subgroup", () => {
    const cases = getSubgroupCases("vls", "ub");
    const caseName = cases[0].name;
    const variantId = cases[0].algList[0].id;
    setSubgroupLearningStatus("vls", "ub", caseName, variantId, "learned");
    setSubgroupCaseSelected("vls", "ub", cases[1].name, true);

    const reloaded = getSubgroupCases("vls", "ub");
    expect(reloaded.find((c) => c.name === caseName)!.algList[0].learningStatus).toBe("learned");
    expect(reloaded.find((c) => c.name === cases[1].name)!.selected).toBe(true);
  });

  it("a structural edit (updateSubgroupCase) switches THAT subgroup to full mode, and a later attempt stays in full mode", () => {
    const cases = getSubgroupCases("zbll", "zbll-l");
    const edited = { ...cases[0], algList: [{ ...cases[0].algList[0], alg: "EDITED ALG" }] };
    updateSubgroupCase("zbll", "zbll-l", edited);

    expect((rawStored("alg_subgroup_zbll_zbll-l") as { full?: unknown }).full).toBeDefined();
    expect(getSubgroupCases("zbll", "zbll-l")[0].algList[0].alg).toBe("EDITED ALG");

    recordSubgroupAttempt("zbll", "zbll-l", cases[0].name, cases[0].algList[0].id, { time: 3, hadErrors: false });
    expect((rawStored("alg_subgroup_zbll_zbll-l") as { full?: unknown }).full).toBeDefined(); // stayed full
    expect(getSubgroupCases("zbll", "zbll-l")[0].algList[0].alg).toBe("EDITED ALG"); // edit preserved

    // A DIFFERENT ZBLL subgroup is completely unaffected.
    expect(localStorage.getItem("alg_subgroup_zbll_zbll-u")).toBeNull();
  });

  it("addSubgroupCase / deleteSubgroupCase also switch to (and stay in) full mode, for that one subgroup only", () => {
    addSubgroupCase("vls", "uf", makeCase("My Custom VLS Case"));
    expect(getSubgroupCases("vls", "uf").some((c) => c.name === "My Custom VLS Case")).toBe(true);
    expect((rawStored("alg_subgroup_vls_uf") as { full?: unknown }).full).toBeDefined();

    deleteSubgroupCase("vls", "uf", "My Custom VLS Case");
    expect(getSubgroupCases("vls", "uf").some((c) => c.name === "My Custom VLS Case")).toBe(false);
  });

  describe("F2L subgroups — bundled base sourced from the pre-merge flat groups", () => {
    it("getSubgroupCases('f2l', 'front-right') matches loadAlgGroup('f2l-front-right') when untouched", () => {
      const viaSubgroup = getSubgroupCases("f2l", "front-right");
      const viaFlatStore = loadAlgGroup("f2l-front-right");
      expect(viaSubgroup.map((c) => c.name)).toEqual(viaFlatStore.map((c) => c.name));
    });

    it("recording an F2L subgroup attempt does NOT touch the old flat alg_group_f2l-front-right key — it's a separate overlay layered on top", () => {
      const cases = getSubgroupCases("f2l", "front-right");
      recordSubgroupAttempt("f2l", "front-right", cases[0].name, cases[0].algList[0].id, { time: 2, hadErrors: false });

      expect(localStorage.getItem("alg_group_f2l-front-right")).toBeNull();
      expect(rawStored("alg_subgroup_f2l_front-right")).toBeDefined();
      expect(getSubgroupCases("f2l", "front-right")[0].algList[0].times).toHaveLength(1);
    });

    it("pre-existing progress recorded directly on the flat group (before ever visiting F2L's subgroup tab) still shows up as the subgroup's base", () => {
      const flatCases = loadAlgGroup("f2l-front-left");
      recordAttempt("f2l-front-left", flatCases[0].name, flatCases[0].algList[0].id, { time: 7, hadErrors: false });

      const viaSubgroup = getSubgroupCases("f2l", "front-left");
      expect(viaSubgroup.find((c) => c.name === flatCases[0].name)!.algList[0].times).toHaveLength(1);
    });
  });

  describe("resetBuiltInGroup", () => {
    it("clears every subgroup's overlay for a bundled subgroup group (ZBLL)", () => {
      const cases = getSubgroupCases("zbll", "zbll-u");
      recordSubgroupAttempt("zbll", "zbll-u", cases[0].name, cases[0].algList[0].id, { time: 5, hadErrors: false });
      expect(localStorage.getItem("alg_subgroup_zbll_zbll-u")).not.toBeNull();

      resetBuiltInGroup("zbll");
      expect(localStorage.getItem("alg_subgroup_zbll_zbll-u")).toBeNull();
      expect(getSubgroupCases("zbll", "zbll-u")[0].algList[0].times).toEqual([]);
    });

    it("also clears the pre-merge flat groups' own data for F2L", () => {
      recordAttempt("f2l-back-right", loadAlgGroup("f2l-back-right")[0].name, loadAlgGroup("f2l-back-right")[0].algList[0].id, {
        time: 1,
        hadErrors: false,
      });
      resetBuiltInGroup("f2l");
      expect(localStorage.getItem("alg_group_f2l-back-right")).toBeNull();
      expect(getSubgroupCases("f2l", "back-right")[0].algList[0].times).toEqual([]);
    });
  });

  describe("custom (user-created) subgroup groups — no bundled base", () => {
    it("a freshly created subgroup + case persists correctly and cleans up on delete", () => {
      const groupId = createGroup("My ZBLL-like Set", undefined, true);
      addSubgroup(groupId, { id: "pattern-1", name: "Pattern 1", previewAlg: "" });
      const added = addSubgroupCase(groupId, "pattern-1", makeCase("Case A"));
      expect(added).toBe(true);

      const cases = getSubgroupCases(groupId, "pattern-1");
      expect(cases).toHaveLength(1);
      recordSubgroupAttempt(groupId, "pattern-1", "Case A", cases[0].algList[0].id, { time: 6, hadErrors: false });
      expect(getSubgroupCases(groupId, "pattern-1")[0].algList[0].times).toHaveLength(1);

      deleteSubgroup(groupId, "pattern-1");
      expect(localStorage.getItem(`alg_subgroup_${groupId}_pattern-1`)).toBeNull();

      deleteGroup(groupId);
      expect(listGroups().some((g) => g.id === groupId)).toBe(false);
    });
  });

  describe("export / import round-trip", () => {
    it("exporting and reimporting a subgroup-based group preserves case data (in the new group's own overlay keys, not the registry)", () => {
      const groupId = createGroup("Export Test", undefined, true);
      addSubgroup(groupId, { id: "p1", name: "P1", previewAlg: "" });
      addSubgroupCase(groupId, "p1", makeCase("Exported Case"));
      recordSubgroupAttempt(groupId, "p1", "Exported Case", getSubgroupCases(groupId, "p1")[0].algList[0].id, {
        time: 3.3,
        hadErrors: false,
      });

      const json = exportGroup(groupId);
      const importedId = importGroup(json, "Reimported");

      const importedCases = getSubgroupCases(importedId, "p1");
      expect(importedCases).toHaveLength(1);
      expect(importedCases[0].algList[0].times).toEqual([{ time: 3.3, hadErrors: false }]);

      // The registry itself never carries the imported case payload.
      const raw = rawStored("nact_alg_groups") as { id: string; subgroups?: { cases: unknown[] }[] }[];
      const importedMeta = raw.find((g) => g.id === importedId)!;
      for (const sg of importedMeta.subgroups!) expect(sg.cases).toEqual([]);
    });
  });

  it("saveSubgroupCases is the dynamic-mode entry point addSubgroup/mutations build on — direct use also respects sparse/full mode switching", () => {
    saveSubgroupCases("zbll", "zbll-t", [{ ...makeCase("Direct"), selected: true }]);
    const raw = rawStored("alg_subgroup_zbll_zbll-t") as { cases?: Record<string, { selected: boolean }> };
    expect(raw.cases?.Direct?.selected).toBe(true);
  });
});

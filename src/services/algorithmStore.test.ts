import { describe, it, expect, beforeEach } from "bun:test";
import "../testSetup";
import {
  loadAlgGroup,
  saveAlgGroupStructural,
  recordAttempt,
  setLearningStatus,
  setCaseSelected,
  updateCase,
  addCase,
  deleteCase,
  resetAlgGroup,
} from "./algorithmStore";
import type { AlgorithmCase } from "../types/algorithm";

/** Raw on-disk value for a group's key — asserting on this (not loadAlgGroup's hydrated output) is how these tests confirm WHAT'S actually persisted, not just what's readable back. */
function rawStored(group: string): unknown {
  const raw = localStorage.getItem(`alg_group_${group}`);
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

describe("algorithmStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hydrates cases from JSON on first load", () => {
    const cases = loadAlgGroup("pll");
    expect(cases.length).toBeGreaterThan(0);
    expect(cases[0].algList.length).toBeGreaterThan(0);
    expect(cases[0].algList[0].times).toEqual([]);
  });

  it("does NOT write anything to localStorage on a cold load of an untouched group — merely visiting a page shouldn't cost storage", () => {
    loadAlgGroup("second-block-last-slot");
    expect(localStorage.getItem("alg_group_second-block-last-slot")).toBeNull();
  });

  describe("sparse mode (untouched case/variant structure)", () => {
    it("persisting an attempt stores ONLY the sparse overlay — no case names, algorithm text, or other bundled structure on disk", () => {
      const cases = loadAlgGroup("pll");
      const caseName = cases[0].name;
      const variantId = cases[0].algList[0].id;
      recordAttempt("pll", caseName, variantId, { time: 2.5, hadErrors: false });

      const raw = rawStored("pll") as { variants?: Record<string, unknown>; cases?: unknown; full?: unknown };
      expect(raw.full).toBeUndefined();
      expect(Object.keys(raw.variants!)).toEqual([variantId]);
      // Nothing about case/algorithm structure leaked into the overlay.
      expect(JSON.stringify(raw)).not.toContain(caseName);
      expect(JSON.stringify(raw)).not.toContain(cases[0].algList[0].alg);
    });

    it("recomputes bestTime/ao5/ao12/ao100 from the persisted times on reload, without storing them", () => {
      const cases = loadAlgGroup("pll");
      const variantId = cases[0].algList[0].id;
      recordAttempt("pll", cases[0].name, variantId, { time: 2.5, hadErrors: false });

      const raw = rawStored("pll") as { variants: Record<string, { times: unknown[]; bestTime?: number }> };
      expect(raw.variants[variantId].bestTime).toBeUndefined(); // not stored — recomputed on read

      const reloaded = loadAlgGroup("pll");
      const variant = reloaded[0].algList[0];
      expect(variant.times).toHaveLength(1);
      expect(variant.times[0].time).toBe(2.5);
      expect(variant.bestTime).toBe(2.5);
    });

    it("persists learning status", () => {
      const cases = loadAlgGroup("oll");
      const variantId = cases[0].algList[0].id;
      setLearningStatus("oll", cases[0].name, variantId, "learned");
      expect(loadAlgGroup("oll")[0].algList[0].learningStatus).toBe("learned");
    });

    it("persists case selection independently of any variant's times/learningStatus", () => {
      const cases = loadAlgGroup("oll");
      const caseName = cases[1].name;
      setCaseSelected("oll", caseName, true);

      const reloaded = loadAlgGroup("oll");
      expect(reloaded[1].selected).toBe(true);
      expect(reloaded[0].selected).toBeUndefined();
      expect(reloaded[1].algList[0].times).toEqual([]); // untouched variant state stays default

      const raw = rawStored("oll") as { full?: unknown; variants?: unknown };
      expect(raw.full).toBeUndefined();
    });

    it("accumulates multiple kinds of overlay entries across separate mutations", () => {
      const cases = loadAlgGroup("pll");
      const caseA = cases[0];
      const caseB = cases[1];
      recordAttempt("pll", caseA.name, caseA.algList[0].id, { time: 3, hadErrors: false });
      setLearningStatus("pll", caseA.name, caseA.algList[0].id, "learning");
      setCaseSelected("pll", caseB.name, true);

      const reloaded = loadAlgGroup("pll");
      expect(reloaded.find((c) => c.name === caseA.name)!.algList[0].times).toHaveLength(1);
      expect(reloaded.find((c) => c.name === caseA.name)!.algList[0].learningStatus).toBe("learning");
      expect(reloaded.find((c) => c.name === caseB.name)!.selected).toBe(true);
    });

    it("resetAlgGroup wipes localStorage and reloads from JSON", () => {
      const cases = loadAlgGroup("pll");
      recordAttempt("pll", cases[0].name, cases[0].algList[0].id, { time: 1, hadErrors: false });
      resetAlgGroup("pll");
      expect(localStorage.getItem("alg_group_pll")).toBeNull();
      expect(loadAlgGroup("pll")[0].algList[0].times).toEqual([]);
    });
  });

  describe("structural edits switch a group to full mode", () => {
    it("updateCase persists the whole case list, and a later recordAttempt stays in full mode instead of reverting to sparse", () => {
      const cases = loadAlgGroup("pll");
      const edited = { ...cases[0], algList: [{ ...cases[0].algList[0], alg: "R U R' U' R U R' U'" }] };
      updateCase("pll", edited);

      expect((rawStored("pll") as { full?: unknown }).full).toBeDefined();
      expect(loadAlgGroup("pll")[0].algList[0].alg).toBe("R U R' U' R U R' U'");

      // A subsequent dynamic-only mutation must NOT drop back to sparse mode
      // (which would silently discard the edited algorithm text).
      recordAttempt("pll", cases[0].name, cases[0].algList[0].id, { time: 5, hadErrors: false });
      expect((rawStored("pll") as { full?: unknown }).full).toBeDefined();
      const reloaded = loadAlgGroup("pll");
      expect(reloaded[0].algList[0].alg).toBe("R U R' U' R U R' U'");
      expect(reloaded[0].algList[0].times).toHaveLength(1);
    });

    it("addCase / deleteCase also switch to (and stay in) full mode", () => {
      addCase("oll", makeCase("My Custom OLL"));
      expect((rawStored("oll") as { full?: AlgorithmCase[] }).full?.some((c) => c.name === "My Custom OLL")).toBe(true);

      setLearningStatus("oll", loadAlgGroup("oll")[0].name, loadAlgGroup("oll")[0].algList[0].id, "learned");
      expect((rawStored("oll") as { full?: unknown }).full).toBeDefined(); // stayed full, didn't regress to sparse

      deleteCase("oll", "My Custom OLL");
      expect(loadAlgGroup("oll").some((c) => c.name === "My Custom OLL")).toBe(false);
    });
  });

  describe("custom (non-built-in) groups — no bundled JSON to fall back to", () => {
    it("a freshly created custom group starts empty and addCase persists correctly (not silently dropped by the sparse/base-merge path)", () => {
      expect(loadAlgGroup("my-custom-group")).toEqual([]);

      const ok = addCase("my-custom-group", makeCase("Case 1"));
      expect(ok).toBe(true);

      const reloaded = loadAlgGroup("my-custom-group");
      expect(reloaded).toHaveLength(1);
      expect(reloaded[0].name).toBe("Case 1");

      recordAttempt("my-custom-group", "Case 1", reloaded[0].algList[0].id, { time: 4, hadErrors: false });
      expect(loadAlgGroup("my-custom-group")[0].algList[0].times).toHaveLength(1);
    });
  });

  describe("legacy on-disk format (pre-refactor bare AlgorithmCase[])", () => {
    it("is read as full-mode data, and further mutations keep it in full mode rather than reinterpreting it as a sparse overlay", () => {
      const legacyCases = [makeCase("Legacy Case", "legacy-v0")];
      legacyCases[0].algList[0].times = [{ time: 9, hadErrors: false }];
      localStorage.setItem("alg_group_legacy-group", JSON.stringify(legacyCases));

      const loaded = loadAlgGroup("legacy-group");
      expect(loaded).toHaveLength(1);
      expect(loaded[0].algList[0].times).toEqual([{ time: 9, hadErrors: false }]);

      recordAttempt("legacy-group", "Legacy Case", "legacy-v0", { time: 8, hadErrors: false });
      const raw = rawStored("legacy-group") as { full?: AlgorithmCase[] };
      expect(raw.full).toBeDefined(); // still an array under `full`, not reinterpreted as {variants:...}
      expect(raw.full![0].algList[0].times).toHaveLength(2);
    });
  });

  it("recordAttempt trims older attempts and retries instead of throwing when localStorage quota is exceeded", () => {
    const cases = loadAlgGroup("pll");
    const caseName = cases[0].name;
    const variantId = cases[0].algList[0].id;
    for (let i = 0; i < 5; i++) recordAttempt("pll", caseName, variantId, { time: 10 + i, hadErrors: false });
    expect(loadAlgGroup("pll")[0].algList[0].times).toHaveLength(5);

    const realSetItem = localStorage.setItem.bind(localStorage);
    const originalWarn = console.warn;
    console.warn = () => {};
    // Simulate real browser quota behavior: any write with more than 3
    // attempts on the target variant is rejected, forcing the fallback to
    // trim and retry with a smaller cap until one fits.
    localStorage.setItem = (key: string, value: string) => {
      if (key === "alg_group_pll") {
        const parsed = JSON.parse(value) as { variants: Record<string, { times: unknown[] }> };
        if (parsed.variants[variantId].times.length > 3) throw new DOMException("quota exceeded", "QuotaExceededError");
      }
      realSetItem(key, value);
    };

    try {
      expect(() => recordAttempt("pll", caseName, variantId, { time: 99, hadErrors: false })).not.toThrow();
    } finally {
      localStorage.setItem = realSetItem;
      console.warn = originalWarn;
    }

    const times = loadAlgGroup("pll")[0].algList[0].times;
    expect(times.length).toBeLessThanOrEqual(3);
    expect(times[times.length - 1]?.time).toBe(99); // the just-recorded attempt is never the one dropped
  });

  it("also trims a full-mode group's times the same way once it's been structurally customized", () => {
    const cases = loadAlgGroup("pll");
    updateCase("pll", { ...cases[0] }); // switch to full mode without changing anything observable
    const variantId = cases[0].algList[0].id;
    for (let i = 0; i < 5; i++) recordAttempt("pll", cases[0].name, variantId, { time: 10 + i, hadErrors: false });

    const realSetItem = localStorage.setItem.bind(localStorage);
    const originalWarn = console.warn;
    console.warn = () => {};
    localStorage.setItem = (key: string, value: string) => {
      if (key === "alg_group_pll") {
        const parsed = JSON.parse(value) as { full: AlgorithmCase[] };
        const variant = parsed.full[0].algList.find((v) => v.id === variantId)!;
        if (variant.times.length > 3) throw new DOMException("quota exceeded", "QuotaExceededError");
      }
      realSetItem(key, value);
    };

    try {
      expect(() => recordAttempt("pll", cases[0].name, variantId, { time: 99, hadErrors: false })).not.toThrow();
    } finally {
      localStorage.setItem = realSetItem;
      console.warn = originalWarn;
    }

    const times = loadAlgGroup("pll")[0].algList[0].times;
    expect(times.length).toBeLessThanOrEqual(3);
    expect(times[times.length - 1]?.time).toBe(99);
  });

  it("recordAttempt gives up quietly (never throws) when even 1 attempt per variant can't fit — origin quota is exhausted, not just this group", () => {
    const cases = loadAlgGroup("pll");
    const caseName = cases[0].name;
    const variantId = cases[0].algList[0].id;

    const realSetItem = localStorage.setItem.bind(localStorage);
    const originalError = console.error;
    let loggedError = false;
    console.error = () => {
      loggedError = true;
    };
    // Every write to this group fails, no matter how small — simulates the
    // total-origin-quota-exhausted case (other keys, not this group, are
    // what's actually full).
    localStorage.setItem = (key: string, value: string) => {
      if (key === "alg_group_pll") throw new DOMException("quota exceeded", "QuotaExceededError");
      realSetItem(key, value);
    };

    try {
      expect(() => recordAttempt("pll", caseName, variantId, { time: 1, hadErrors: false })).not.toThrow();
    } finally {
      localStorage.setItem = realSetItem;
      console.error = originalError;
    }
    expect(loggedError).toBe(true);
  });

  it("saveAlgGroupStructural is what addCase/updateCase/deleteCase use under the hood — exported for algGroupRegistry's own structural writes (group creation, import)", () => {
    saveAlgGroupStructural("registry-like-group", [makeCase("Imported Case")]);
    expect(loadAlgGroup("registry-like-group")).toHaveLength(1);
    expect((rawStored("registry-like-group") as { full?: unknown }).full).toBeDefined();
  });
});

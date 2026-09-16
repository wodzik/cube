import { describe, it, expect, beforeEach } from "bun:test";
import "../testSetup";
import { loadAlgGroup, recordAttempt, setLearningStatus, resetAlgGroup } from "./algorithmStore";

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

  it("persists a recorded attempt and recomputes stats", () => {
    const cases = loadAlgGroup("pll");
    const variantId = cases[0].algList[0].id;
    recordAttempt("pll", cases[0].name, variantId, { time: 2.5, hadErrors: false });

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

  it("resetAlgGroup wipes localStorage and reloads from JSON", () => {
    const cases = loadAlgGroup("pll");
    recordAttempt("pll", cases[0].name, cases[0].algList[0].id, { time: 1, hadErrors: false });
    resetAlgGroup("pll");
    expect(loadAlgGroup("pll")[0].algList[0].times).toEqual([]);
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
        const parsed = JSON.parse(value);
        const variant = parsed[0].algList.find((v: { id: string }) => v.id === variantId);
        if (variant.times.length > 3) throw new DOMException("quota exceeded", "QuotaExceededError");
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
});

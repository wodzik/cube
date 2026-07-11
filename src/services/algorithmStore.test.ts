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
});

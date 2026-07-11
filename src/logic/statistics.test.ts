import { describe, it, expect } from "bun:test";
import { attemptsForSource, computeVariantStatsForSource } from "./statistics";
import type { AlgorithmAttempt } from "../types/algorithm";

describe("attemptsForSource / computeVariantStatsForSource", () => {
  it("keeps Training and Attack attempts of the same variant separate", () => {
    const attempts: AlgorithmAttempt[] = [
      { time: 5, hadErrors: false, source: "training" },
      { time: 3, hadErrors: false, source: "attack" },
      { time: 4, hadErrors: false, source: "training" },
      { time: 2, hadErrors: false, source: "attack" },
    ];

    const training = computeVariantStatsForSource(attempts, "training");
    expect(training.count).toBe(2);
    expect(training.bestTime).toBe(4);
    expect(training.mean).toBe(4.5);

    const attack = computeVariantStatsForSource(attempts, "attack");
    expect(attack.count).toBe(2);
    expect(attack.bestTime).toBe(2);
    expect(attack.mean).toBe(2.5);
  });

  it("treats attempts recorded before `source` existed as training", () => {
    const attempts: AlgorithmAttempt[] = [{ time: 9, hadErrors: false }];
    expect(attemptsForSource(attempts, "training")).toHaveLength(1);
    expect(attemptsForSource(attempts, "attack")).toHaveLength(0);
  });

  it("a case never attempted in a given mode has count 0 and all-null stats", () => {
    const attempts: AlgorithmAttempt[] = [{ time: 5, hadErrors: false, source: "training" }];
    const attack = computeVariantStatsForSource(attempts, "attack");
    expect(attack.count).toBe(0);
    expect(attack.bestTime).toBeNull();
    expect(attack.mean).toBeNull();
    expect(attack.ao5).toBeNull();
  });
});

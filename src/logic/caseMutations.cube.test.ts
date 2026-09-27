import { describe, expect, it } from "bun:test";
import { applyRecordAttempt, attemptCube } from "./caseMutations";
import type { AlgorithmCase } from "../types/algorithm";

const kase = (): AlgorithmCase[] => [{ name: "T", algList: [{ id: "v1", alg: "R U R' U'", times: [] }] } as unknown as AlgorithmCase];

describe("attempt cube (run-length)", () => {
  it("stores the cube only when it changes; every attempt still reads its cube", () => {
    let cases = kase();
    const add = (cube?: string) => (cases = applyRecordAttempt(cases, "T", "v1", { time: 1, hadErrors: false, source: "training", cube }));
    add("c1");
    add("c1");
    add("c1");
    add(undefined); // no cube connected
    add("c2");
    add("c2");
    const times = cases[0].algList[0].times;
    expect(times.map((t) => t.cube)).toEqual(["c1", undefined, undefined, "", "c2", undefined]);
    expect(times.map((_, i) => attemptCube(times, i))).toEqual(["c1", "c1", "c1", undefined, "c2", "c2"]);
  });

  it("attempts before any cube was recorded have none", () => {
    let cases = kase();
    cases = applyRecordAttempt(cases, "T", "v1", { time: 1, hadErrors: false });
    const times = cases[0].algList[0].times;
    expect(times[0].cube).toBeUndefined();
    expect(attemptCube(times, 0)).toBeUndefined();
  });
});

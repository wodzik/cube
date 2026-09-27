import { beforeEach, describe, expect, it } from "bun:test";
import { activeCubeId, cubeLabel, forgetCube, listCubes, rememberCube, setActiveCube, updateCube } from "./cubeRegistry";

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage ??= {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

describe("cube registry", () => {
  beforeEach(() => localStorage.removeItem("nact_cubes"));

  it("remembers each cube once, by MAC (else name), with short ids", () => {
    const a = rememberCube({ name: "GAN12ui_A1B2", mac: "ab:cd:ef:01:02:03", protocol: "gan" });
    const b = rememberCube({ name: "QY-QYSC-S-1234", protocol: "qiyi" });
    const again = rememberCube({ name: "GAN12ui_A1B2", mac: "AB:CD:EF:01:02:03", protocol: "gan" });
    expect([a.id, b.id, again.id]).toEqual(["c1", "c2", "c1"]);
    expect(listCubes()).toHaveLength(2);
  });

  it("names, per-cube look, forgetting, and the active cube for records", () => {
    const a = rememberCube({ name: "WCU_MY32_0001", protocol: "moyu" });
    expect(cubeLabel(a.id)).toBe("WCU_MY32_0001");
    updateCube(a.id, { label: "My MoYu", look: { skin: "moyuStickers" } });
    expect(cubeLabel(a.id)).toBe("My MoYu");
    expect(listCubes()[0].look).toEqual({ skin: "moyuStickers" });
    setActiveCube(a.id);
    expect(activeCubeId()).toBe(a.id);
    setActiveCube(null);
    expect(activeCubeId()).toBeUndefined();
    forgetCube(a.id);
    expect(cubeLabel(a.id)).toBe(`cube ${a.id}`); // records keep pointing at it
    expect(cubeLabel(undefined)).toBeNull();
  });
});

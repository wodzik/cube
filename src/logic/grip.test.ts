import { describe, expect, it } from "bun:test";
import { ALL_GRIPS, GripTracker, IDENTITY_GRIP, gripOf, gripQuaternion, readGrip, rotateGrip, rotationBetween } from "./grip";

const axisAngle = (ax: [number, number, number], deg: number) => {
  const h = (deg * Math.PI) / 360;
  return { x: ax[0] * Math.sin(h), y: ax[1] * Math.sin(h), z: ax[2] * Math.sin(h), w: Math.cos(h) };
};

describe("grips", () => {
  it("reads every grip back from its own quaternion", () => {
    for (const g of ALL_GRIPS) expect(readGrip(gripQuaternion(g)).grip.id).toBe(g.id);
    expect(readGrip(gripQuaternion(IDENTITY_GRIP)).offDeg).toBeLessThan(0.01);
  });

  it("rotations move the faces the right way", () => {
    expect(rotateGrip(IDENTITY_GRIP, "x").face.U).toBe("F");
    expect(rotateGrip(IDENTITY_GRIP, "y").face.F).toBe("R");
    expect(rotateGrip(IDENTITY_GRIP, "y'").face.F).toBe("L");
    expect(rotateGrip(IDENTITY_GRIP, "z").face.U).toBe("L");
    expect(rotateGrip(IDENTITY_GRIP, "x2").face.U).toBe("D");
  });

  it("an x / y turn of the renderer quaternion is the x / y rotation", () => {
    // x: like R — the front comes up (−90° about +x); y: like U (−90° about +y).
    expect(readGrip(axisAngle([1, 0, 0], -90)).grip.id).toBe(rotateGrip(IDENTITY_GRIP, "x").id);
    expect(readGrip(axisAngle([0, 1, 0], -90)).grip.id).toBe(rotateGrip(IDENTITY_GRIP, "y").id);
    expect(readGrip(axisAngle([0, 0, 1], -90)).grip.id).toBe(rotateGrip(IDENTITY_GRIP, "z").id);
  });

  it("finds a rotation of at most two between any two grips", () => {
    for (const a of ALL_GRIPS)
      for (const b of ALL_GRIPS) {
        const r = rotationBetween(a, b);
        expect(rotateGrip(a, r).id).toBe(b.id);
        expect(r.split(" ").filter(Boolean).length).toBeLessThanOrEqual(2);
      }
    expect(rotationBetween(IDENTITY_GRIP, gripOf("U", "L"))).toBe("y'");
  });

  it("tracks changes with a dwell, timed from the first reach", () => {
    const t = new GripTracker(35, 150);
    expect(t.update(axisAngle([0, 1, 0], 5), 0)).toBeNull();
    expect(t.grip?.id).toBe(IDENTITY_GRIP.id);
    // passing through y on the way to y2 is not a rotation
    t.update(axisAngle([0, 1, 0], -90), 100);
    t.update(axisAngle([0, 1, 0], -135), 150);
    t.update(axisAngle([0, 1, 0], -180), 200);
    expect(t.update(axisAngle([0, 1, 0], -180), 300)).toBeNull();
    const c = t.update(axisAngle([0, 1, 0], -178), 360);
    expect(c?.rotation).toBe("y2");
    expect(c?.at).toBe(200);
  });
});

import { IDENTITY } from "@wodzik/cubecore/bluetooth";
import { multiply } from "@wodzik/cubecore/bluetooth";
describe("gyro view base", () => {
  it("a y held yellow-top turns the drawn cube like a y from there", () => {
    const yellowTop = gripOf("D", "F");
    const base = gripQuaternion(yellowTop);
    // The cube's own-axes turn for a y from the yellow-top grip: y of the held cube = −90° about its up (its D normal, −y in body axes).
    const rel = axisAngle([0, -1, 0], -90);
    expect(readGrip(multiply(base, rel)).grip.id).toBe(rotateGrip(yellowTop, "y").id);
    expect(readGrip(multiply(base, IDENTITY)).grip.id).toBe(yellowTop.id);
  });
});

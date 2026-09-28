/**
 * Grips — how a smart cube is held (which physical face is on top, which
 * faces you), read from its gyroscope — and the cube rotations (x, y, z)
 * between them.
 *
 * A grip is a cubecore Frame: `grip.face.U` is the physical face on top,
 * `grip.face.F` the one towards you (frameFor(bottom, front)). The identity
 * grip is the cube as drawn — physical U up, F front (white top, green front
 * in the western scheme) — which is also how "Reset gyro" expects it held.
 *
 * Physical moves (as the smart cube reports them) re-lettered for a grip are
 * the moves as the solver saw them: with orange (L) in front, an L turn is
 * "F" (frameView.heldMoves).
 */

import { FACES, FACE_NORMAL, FRAMES, IDENTITY_FRAME, type Face, type Frame, type Vec3, frameFor } from "@wodzik/cubecore/core";
import type { Quat } from "@wodzik/cubecore/bluetooth";
import { frameQuaternion } from "./frameView";

export type Grip = Frame;
export const IDENTITY_GRIP: Grip = IDENTITY_FRAME;

const OPPOSITE: Record<Face, Face> = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };

/** The grip with `top` up and `front` towards you. */
export const gripOf = (top: Face, front: Face): Grip => frameFor(OPPOSITE[top], front);

/** `v` turned by `q` (q v q*). */
export function rotateVec(q: Quat, v: Vec3): Vec3 {
  const [vx, vy, vz] = v;
  // t = 2 (q.xyz × v); v' = v + w t + q.xyz × t
  const tx = 2 * (q.y * vz - q.z * vy);
  const ty = 2 * (q.z * vx - q.x * vz);
  const tz = 2 * (q.x * vy - q.y * vx);
  return [vx + q.w * tx + (q.y * tz - q.z * ty), vy + q.w * ty + (q.z * tx - q.x * tz), vz + q.w * tz + (q.x * ty - q.y * tx)];
}

export interface GripReading {
  grip: Grip;
  /** The worse of the top / front faces' angle (degrees) from straight up / straight at you. */
  offDeg: number;
}

/** The grip nearest to the cube turned by `q` (the calibrated gyro orientation, as CubeRenderer.setOrientation takes it). */
export function readGrip(q: Quat): GripReading {
  let top: Face = "U";
  let front: Face = "F";
  let bestUp = -2;
  let bestFront = -2;
  for (const f of FACES) {
    const n = rotateVec(q, FACE_NORMAL[f]);
    if (n[1] > bestUp) [bestUp, top] = [n[1], f];
    if (n[2] > bestFront) [bestFront, front] = [n[2], f];
  }
  const deg = (c: number) => (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
  // top and front can only clash far from any grip (≈ 45° off on two axes).
  if (OPPOSITE[top] === front || top === front) return { grip: IDENTITY_GRIP, offDeg: 90 };
  return { grip: gripOf(top, front), offDeg: Math.max(deg(bestUp), deg(bestFront)) };
}

/** The orientation (as readGrip takes it) of a cube held exactly in `grip`. */
export const gripQuaternion = (grip: Grip): Quat => frameQuaternion(grip);

/** Where each rotation takes the grip: [new top, new front] as canonical faces of the old grip. */
const ROTATION_STEP: Record<"x" | "y" | "z", [Face, Face]> = {
  x: ["F", "D"], // the front comes up
  y: ["U", "R"], // the right comes to the front
  z: ["L", "F"], // the left comes up
};

/** The grip after a rotation ("x", "y'", "z2", or several: "x y"). */
export function rotateGrip(grip: Grip, rotation: string): Grip {
  let g = grip;
  for (const token of rotation.split(/\s+/).filter(Boolean)) {
    const axis = token[0] as "x" | "y" | "z";
    const step = ROTATION_STEP[axis];
    if (!step) throw new Error(`Not a rotation: ${token}`);
    const turns = token.endsWith("2") ? 2 : token.endsWith("'") ? 3 : 1;
    for (let i = 0; i < turns; i++) g = gripOf(g.face[step[0]], g.face[step[1]]);
  }
  return g;
}

const SINGLES = ["x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"];
/** Every grip from every other: one rotation, else two (x or z first, then y — the usual "x y'" shape). */
const CANDIDATES = [
  "",
  ...SINGLES,
  ...["x", "x'", "x2", "z", "z'"].flatMap((a) => ["y", "y'", "y2"].map((b) => `${a} ${b}`)),
  ...["x", "x'"].flatMap((a) => ["z", "z'", "z2"].map((b) => `${a} ${b}`)),
];

/** The shortest rotation from one grip to another ("" when the same). */
export function rotationBetween(from: Grip, to: Grip): string {
  if (from.id === to.id) return "";
  const r = CANDIDATES.find((c) => rotateGrip(from, c).id === to.id);
  if (r === undefined) throw new Error("unreachable grip");
  return r;
}

export interface GripChange {
  from: Grip;
  to: Grip;
  /** When the new grip was first reached (before the dwell confirmed it). */
  at: number;
  rotation: string;
}

/**
 * Grip changes from a stream of gyro readings, with hysteresis: a new grip
 * counts once the cube has sat within `maxOffDeg` of it for `dwellMs` — a
 * wobble during a turn, or passing through a grip on the way to another
 * (x2 through x), is not a rotation.
 */
export class GripTracker {
  grip: Grip | null = null;
  private candidate: { grip: Grip; since: number } | null = null;

  constructor(
    private readonly maxOffDeg = 35,
    private readonly dwellMs = 150
  ) {}

  update(q: Quat, t: number): GripChange | null {
    const { grip, offDeg } = readGrip(q);
    if (offDeg > this.maxOffDeg) {
      this.candidate = null;
      return null;
    }
    if (!this.grip) {
      this.grip = grip;
      return null;
    }
    if (grip.id === this.grip.id) {
      this.candidate = null;
      return null;
    }
    if (this.candidate?.grip.id !== grip.id) this.candidate = { grip, since: t };
    if (t - this.candidate.since < this.dwellMs) return null;
    const change = { from: this.grip, to: grip, at: this.candidate.since, rotation: rotationBetween(this.grip, grip) };
    this.grip = grip;
    this.candidate = null;
    return change;
  }

  reset(): void {
    this.grip = null;
    this.candidate = null;
  }
}

/** All 24 grips (for tests and pickers). */
export const ALL_GRIPS: readonly Grip[] = FRAMES;

/** "white top, green front"-style label of a grip, in physical face letters: "U/F". */
export const gripLabel = (g: Grip): string => `${g.face.U}/${g.face.F}`;

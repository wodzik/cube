/**
 * The smart cube's orientation, absolute: how the cube is held relative to
 * white top, green front (the identity grip, logic/grip.ts) — for counting
 * cube rotations during a solve and for the gyro view.
 *
 * Three corrections sit between the session's "orientation" event and that:
 *
 * - Axes: SmartCubeSession maps a cube's raw quaternion with GAN's axes. Other
 *   brands (MoYu…) may report theirs differently; a per-cube signed
 *   permutation of the vector part (`gyroAxes`, found with the Debug page's
 *   detector) is applied first.
 * - Calibration: "held as shown now" — the raw reading then, and the view's
 *   orientation it stands for (white top, green front on the Solve page).
 *   Kept as a raw reading, so a new axis correction applies to it too.
 * - Drift: the gyro's yaw wanders. At a solve's start the cube is held in
 *   some grip; `reanchor` snaps the reading onto it.
 */

import { GAN_AXES, IDENTITY, conjugate, multiply, normalize, type AxisMap, type Quat, type SmartCubeSession } from "@wodzik/cubecore/bluetooth";
import { type Grip, GripTracker, gripQuaternion, readGrip } from "../logic/grip";

// ── Axes ────────────────────────────────────────────────────────────────

/** "x,y,z" = unchanged; "-y,z,x" = the new x is the reading's −y, and so on. */
export const DEFAULT_AXES = "x,y,z";

const AXIS_INDEX = { x: 0, y: 1, z: 2 } as const;

/** All 48 signed permutations (rotations and mirrorings of the axes). */
export const ALL_AXES: readonly string[] = (() => {
  const perms = [
    ["x", "y", "z"],
    ["x", "z", "y"],
    ["y", "x", "z"],
    ["y", "z", "x"],
    ["z", "x", "y"],
    ["z", "y", "x"],
  ];
  const out: string[] = [];
  for (const p of perms)
    for (let s = 0; s < 8; s++) out.push(p.map((a, i) => ((s >> i) & 1 ? `-${a}` : a)).join(","));
  return out;
})();

/** An odd signed permutation (a mirror): a tie with a rotation goes to the rotation. */
function isMirror(spec: string): boolean {
  const t = spec.split(",");
  const order = t.map((a) => AXIS_INDEX[a.replace("-", "") as "x" | "y" | "z"]);
  const inversions = (order[0] > order[1] ? 1 : 0) + (order[0] > order[2] ? 1 : 0) + (order[1] > order[2] ? 1 : 0);
  const minus = t.filter((a) => a.startsWith("-")).length;
  return (inversions + minus) % 2 === 1;
}

export function applyAxes(spec: string, q: Quat): Quat {
  if (spec === DEFAULT_AXES) return q;
  const v = [q.x, q.y, q.z];
  const [x, y, z] = spec.split(",").map((t) => {
    const neg = t.startsWith("-");
    const value = v[AXIS_INDEX[t.replace("-", "") as "x" | "y" | "z"]];
    return neg ? -value : value;
  });
  return { x, y, z, w: q.w };
}

let axes = DEFAULT_AXES;
let lastRaw: Quat | null = null;

/** The axis map every session is opened with (GAN's, then this cube's correction). */
export const sessionAxes: AxisMap = (raw) => {
  const q = GAN_AXES(raw);
  lastRaw = q;
  return applyAxes(axes, q);
};

export const currentAxes = () => axes;

/** Use another correction (the connected cube's). Calibration is kept: it's held as raw readings. */
export function setAxes(spec: string | undefined): void {
  axes = spec && ALL_AXES.includes(spec) ? spec : DEFAULT_AXES;
}

/** Orientation from `a` to `b` in the corrected axes (a calibrated at `a`). */
const relative = (spec: string, a: Quat, b: Quat) => normalize(multiply(conjugate(normalize(applyAxes(spec, a))), normalize(applyAxes(spec, b))));

const angleDeg = (a: Quat, b: Quat) => {
  const d = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w);
  return (2 * Math.acos(Math.min(1, d)) * 180) / Math.PI;
};

/**
 * The correction from three raw readings: held white top / green front, then
 * after an x (front up) from there, then (back to the start) after a y
 * (right to the front). Best first, with how far off (degrees) it still is.
 */
export function detectAxes(start: Quat, afterX: Quat, afterY: Quat, xGrip: Grip, yGrip: Grip): { spec: string; errorDeg: number }[] {
  const ex = gripQuaternion(xGrip);
  const ey = gripQuaternion(yGrip);
  return ALL_AXES.map((spec) => ({
    spec,
    errorDeg: Math.max(angleDeg(relative(spec, start, afterX), ex), angleDeg(relative(spec, start, afterY), ey)),
  })).sort((a, b) => Math.round(a.errorDeg - b.errorDeg) || (isMirror(a.spec) ? 1 : 0) - (isMirror(b.spec) ? 1 : 0));
}

// ── Per session: calibration, drift, grips ──────────────────────────────

export interface GripEvent {
  /** performance.now() when the grip was reached. */
  at: number;
  grip: Grip;
  /** The rotation from the grip before ("" for the first reading). */
  rotation: string;
}

type AbsoluteListener = (abs: Quat) => void;

interface Tracking {
  /** Latest raw reading (GAN axes, uncorrected). */
  raw: Quat | null;
  /** The raw reading the cube was held as `shown` at; null: not yet (the first reading is taken). */
  basis: Quat | null;
  shown: Quat;
  /** Drift correction, world side. */
  anchor: Quat;
  userCalibrated: boolean;
  tracker: GripTracker;
  history: GripEvent[];
  listeners: Set<AbsoluteListener>;
  gripListeners: Set<() => void>;
}

const trackers = new WeakMap<SmartCubeSession, Tracking>();
const HISTORY = 500;

function absoluteOf(t: Tracking): Quat | null {
  if (!t.raw || !t.basis) return null;
  // The turn since calibrating is in the cube's own axes as it was held
  // then (`shown`): turned into screen axes it's shown·rel·shown⁻¹, applied
  // to `shown` → shown·rel. (rel·shown turned the wrong way round whenever
  // the view wasn't white top — yellow top on Steps.)
  return normalize(multiply(t.anchor, multiply(t.shown, relative(axes, t.basis, t.raw))));
}

/** Follow the session's orientation and grips (once per session; lives as long as the session). */
export function gripTracking(session: SmartCubeSession): Tracking {
  const existing = trackers.get(session);
  if (existing) return existing;
  const t: Tracking = {
    raw: null,
    basis: null,
    shown: IDENTITY,
    anchor: IDENTITY,
    userCalibrated: false,
    tracker: new GripTracker(),
    history: [],
    listeners: new Set(),
    gripListeners: new Set(),
  };
  trackers.set(session, t);
  session.on("orientation", () => {
    // sessionAxes ran for this very reading just before the event.
    if (!lastRaw) return;
    t.raw = lastRaw;
    t.basis ??= lastRaw;
    const abs = absoluteOf(t)!;
    t.listeners.forEach((l) => l(abs));
    const now = performance.now();
    const wasEmpty = t.tracker.grip === null;
    const change = t.tracker.update(abs, now);
    if (wasEmpty && t.tracker.grip) t.history.push({ at: now, grip: t.tracker.grip, rotation: "" });
    else if (change) t.history.push({ at: change.at, grip: change.to, rotation: change.rotation });
    else return;
    if (t.history.length > HISTORY) t.history.splice(0, t.history.length - HISTORY);
    t.gripListeners.forEach((l) => l());
  });
  return t;
}

/** The cube's absolute orientation, on every reading (identity = white top, green front). */
export function onAbsoluteOrientation(session: SmartCubeSession, fn: AbsoluteListener): () => void {
  const t = gripTracking(session);
  t.listeners.add(fn);
  return () => t.listeners.delete(fn);
}

/** On every grip change (and the first grip). */
export function onGripChange(session: SmartCubeSession, fn: () => void): () => void {
  const t = gripTracking(session);
  t.gripListeners.add(fn);
  return () => t.gripListeners.delete(fn);
}

/** The latest raw reading (GAN axes, before the correction) — for detecting the correction. */
export const rawReading = (session: SmartCubeSession): Quat | null => gripTracking(session).raw;

export const currentGrip = (session: SmartCubeSession): Grip | null => gripTracking(session).tracker.grip;
export const currentAbsolute = (session: SmartCubeSession): Quat | null => absoluteOf(gripTracking(session));

let shownView: Quat = IDENTITY;
/** The gyro view on screen shows the cube in `shown` ("Reset gyro" = held like that); returns the undo. */
export function setShownView(shown: Quat): () => void {
  shownView = shown;
  return () => {
    if (shownView === shown) shownView = IDENTITY;
  };
}
/** "Reset gyro": held as the view on screen shows it now. */
export const resetToShown = (session: SmartCubeSession) => calibrateAs(session, shownView);

/** "The cube is held as `shown` now" (a view's orientation; identity = white top, green front). */
export function calibrateAs(session: SmartCubeSession, shown: Quat = IDENTITY): void {
  const t = gripTracking(session);
  session.calibrate();
  t.basis = t.raw;
  t.shown = shown;
  t.anchor = IDENTITY;
  t.userCalibrated = true;
  t.tracker.reset();
}

/** Calibrated on purpose on this connection (else the first reading counts as held white top, green front). */
export const isCalibrated = (session: SmartCubeSession) => gripTracking(session).userCalibrated;

/** Snap the reading onto the grip it's nearest (yaw drift) — call when the cube is held square (a solve's start). */
export function reanchor(session: SmartCubeSession): void {
  const t = gripTracking(session);
  const abs = absoluteOf(t);
  if (!abs) return;
  const { grip, offDeg } = readGrip(abs);
  if (offDeg > 35) return;
  // new absolute = G: anchor' · shown · rel = G  →  anchor' = G · abs⁻¹ · anchor
  t.anchor = normalize(multiply(multiply(gripQuaternion(grip), conjugate(abs)), t.anchor));
}

/** The grip in effect at `time` (performance.now()), or null (no reading yet then). */
export function gripAt(session: SmartCubeSession, time: number): Grip | null {
  let g: Grip | null = null;
  for (const e of gripTracking(session).history) {
    if (e.at > time) break;
    g = e.grip;
  }
  return g;
}

/** Grip changes after `from` up to `to`. */
export const gripChangesBetween = (session: SmartCubeSession, from: number, to: number): GripEvent[] =>
  gripTracking(session).history.filter((e) => e.rotation && e.at > from && e.at <= to);

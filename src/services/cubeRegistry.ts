/**
 * The smart cubes this browser has connected — remembered on every
 * connection, each with its own settings (look: skin / stickers / finish,
 * a name of your own).
 *
 * Records (solves, trainer attempts, algorithm attempts, BLD times) point at
 * a cube by its SHORT id ("c1", "c2"…): a dozen bytes per record, the rest
 * (device name, MAC, settings) is stored once, here. localStorage, like the
 * other stores. PURE FUNCTIONS + one "active cube" slot the connection
 * provider fills.
 */

import type { CubeLook } from "../hooks/useCubeLook";

const KEY = "nact_cubes";

export interface KnownCube {
  /** Short id records use ("c1"…). */
  id: string;
  /** What identifies the device: its MAC when known, else its Bluetooth name. */
  key: string;
  /** Bluetooth name (e.g. "GAN12ui_A1B2"). */
  deviceName: string;
  /** Your own name for it. */
  label?: string;
  protocol: string;
  firstSeen: number;
  lastSeen: number;
  /** This cube's look; unset parts follow the app's look (Settings → Cube look). */
  look?: Partial<CubeLook>;
  /** This cube's turn arrows (off / round / along the edges); unset: the app's. */
  arrows?: "off" | "circle" | "box";
  /** Follow this cube's gyroscope (turn the 3D cube as it's held); unset: the app's. */
  gyro?: boolean;
  /** Count cube rotations (x, y, z) in solves from the gyroscope; unset: the app's. */
  rotations?: boolean;
  /** This cube's gyroscope axes, when its brand reports them unlike GAN (services/gyroOrientation: "x,y,z" = as GAN). */
  gyroAxes?: string;
  /**
   * A cube that can't reset its own state (QiYi…): what it reports when it's
   * solved since "Mark as solved" (stateCodec) — passed to the session on
   * every connection.
   */
  base?: string;
}

export function listCubes(): KnownCube[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as KnownCube[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function save(cubes: KnownCube[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cubes));
  } catch {
    // not persisted
  }
  listeners.forEach((l) => l());
}

/** Remember a connected cube (or refresh when it was last seen); returns its record. */
export function rememberCube(device: { name: string; mac?: string | null; protocol: string }): KnownCube {
  const cubes = listCubes();
  const key = device.mac ? device.mac.toUpperCase() : device.name;
  const now = Date.now();
  const found = cubes.find((c) => c.key === key);
  if (found) {
    found.lastSeen = now;
    found.deviceName = device.name;
    save(cubes);
    return found;
  }
  const next = Math.max(0, ...cubes.map((c) => Number(c.id.slice(1)) || 0)) + 1;
  const cube: KnownCube = { id: `c${next}`, key, deviceName: device.name, protocol: device.protocol, firstSeen: now, lastSeen: now };
  save([...cubes, cube]);
  return cube;
}

export function updateCube(id: string, patch: Partial<Pick<KnownCube, "label" | "look" | "arrows" | "gyro" | "rotations" | "gyroAxes" | "base">>): void {
  save(listCubes().map((c) => (c.id === id ? { ...c, ...patch } : c)));
}

/** Forget a cube (its records keep the id; they just show it as an unknown cube). */
export function forgetCube(id: string): void {
  save(listCubes().filter((c) => c.id !== id));
}

/** The record of a device (by MAC, else name), before it's remembered — e.g. to look up its base. */
export function findCube(device: { name: string; mac?: string | null }): KnownCube | undefined {
  const key = device.mac ? device.mac.toUpperCase() : device.name;
  return listCubes().find((c) => c.key === key);
}

export const cubeName = (c: KnownCube): string => c.label?.trim() || c.deviceName;

/** Display name for a record's cube id (null: no cube recorded). */
export function cubeLabel(id: string | undefined): string | null {
  if (!id) return null;
  const c = listCubes().find((x) => x.id === id);
  return c ? cubeName(c) : `cube ${id}`;
}

// ─── the connected cube ───

let active: string | null = null;
/** Set by the connection provider. */
export function setActiveCube(id: string | null): void {
  active = id;
}
/** The connected cube's short id — stamp it on every record made now. */
export const activeCubeId = (): string | undefined => active ?? undefined;

// ─── change notifications (settings page, look) ───

const listeners = new Set<() => void>();
export function onCubesChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

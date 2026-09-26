/**
 * act's stickering (cubing.js names / piece-orbit masks) → cubecore masks.
 *
 * Orbit masks: cubing's 3x3 piece slots, in the order verified in
 * logic/stageDetection/liveCubeState.ts; a piece's facelets come in the order
 * of the letters of its name (URF: U, R, F). cubecore masks are per sticker
 * (home facelet), so both follow the pieces as they move.
 */

import { FACELETS, MASK_STATES, type Mask, type MaskState, type Vec3, fullMask } from "@cubecore/core";
import { maskByName } from "@cubecore/methods";
import type { FaceletMask, StickeringMaskOrbits } from "../types/cube";

const ORBITS: Record<string, readonly string[]> = {
  CORNERS: ["URF", "UBR", "ULB", "UFL", "DFR", "DLF", "DBL", "DRB"],
  EDGES: ["UF", "UR", "UB", "UL", "DF", "DR", "DB", "DL", "FR", "FL", "BR", "BL"],
  CENTERS: ["U", "L", "F", "R", "B", "D"],
};

const NORMAL: Record<string, Vec3> = Object.fromEntries(FACELETS.filter((f) => f.index % 9 === 4).map((f) => [f.face, f.normal]));
const same = (a: Vec3, b: Vec3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** cubecore facelet index of sticker `k` of the piece named `name` (e.g. "URF", 1 → its R sticker). */
function faceletOf(name: string, k: number): number {
  const pos = [...name].reduce<Vec3>((p, c) => [p[0] + NORMAL[c][0], p[1] + NORMAL[c][1], p[2] + NORMAL[c][2]], [0, 0, 0]);
  const f = FACELETS.find((x) => x.face === name[k] && same(x.pos, pos));
  if (!f) throw new Error(`No facelet ${name}[${k}]`);
  return f.index;
}

const STATE: Record<FaceletMask, MaskState> = { regular: "regular", dim: "dim", oriented: "oriented", mystery: "dim", ignored: "ignored", invisible: "invisible" };

export function orbitMaskToCubecore(m: StickeringMaskOrbits): Mask {
  const mask = fullMask();
  for (const [orbit, names] of Object.entries(ORBITS)) {
    const pieces = m.orbits[orbit]?.pieces ?? [];
    names.forEach((name, slot) => {
      const facelets = pieces[slot]?.facelets;
      if (!facelets) return;
      for (let k = 0; k < name.length; k++) mask[faceletOf(name, k)] = MASK_STATES.indexOf(STATE[facelets[k] ?? "regular"]);
    });
  }
  return mask;
}

/** cubing.js stickering names act uses → cubecore mask names. */
const NAMED: Record<string, string> = {
  full: "full",
  Cross: "cfop:cross",
  F2L: "cfop:f2l",
  OLL: "cfop:oll",
  PLL: "cfop:pll",
  LL: "ll",
  COLL: "cfop:coll",
  OCLL: "cfop:ocll",
  CLL: "cfop:cll",
  ELL: "cfop:ell",
  EPLL: "cfop:epll",
  CPLL: "cfop:cpll",
  ZBLL: "cfop:zbll",
  FB: "roux:fb",
  Roux: "roux:blocks",
  CMLL: "roux:cmll",
  L6E: "roux:lse",
};

export function namedMaskToCubecore(name: string): Mask | null {
  const n = NAMED[name];
  return n && n !== "full" ? maskByName(n) : null;
}

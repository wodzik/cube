/**
 * Types related to the Rubik's Cube.
 */

/** 6 faces of the cube */
export type Face = "U" | "D" | "L" | "R" | "F" | "B";

/** Rotation axes */
export type Rotation = "x" | "y" | "z";

/**
 * Orientation mapping.
 * Key = logical position, value = physical face that is there.
 *
 * Default (no rotation): { U: 'U', D: 'D', L: 'L', R: 'R', F: 'F', B: 'B' }
 *
 * After x rotation (e.g. R → U goes to F):
 * { U: 'F', F: 'D', D: 'B', B: 'U', L: 'L', R: 'R' }
 */
export type Orientation = Record<Face, Face>;

/** Standard orientation (identity) */
export const IDENTITY_ORIENTATION: Orientation = {
  U: "U",
  D: "D",
  L: "L",
  R: "R",
  F: "F",
  B: "B",
};

/**
 * Representation of a single move in structured form.
 */
export interface ParsedMove {
  /** Original notation, e.g. "Rw2'" */
  raw: string;

  /** Move base (uppercase letter for faces, uppercase for slices, lowercase for rotations) */
  base: Face | "M" | "E" | "S" | Rotation;

  /** Move power: 1 = quarter, 2 = half, 3 = reverse quarter */
  power: number;

  /** Whether this is a wide move (e.g. Rw, r) */
  isWide: boolean;

  /** Whether this is a slice move (M, E, S) */
  isSlice: boolean;

  /** Whether this is a rotation (x, y, z) */
  isRotation: boolean;
}

/**
 * Physical face move after decomposition.
 *
 * Virtual moves (rotations, slices, wide) decompose to physical moves:
 * - `r` → {face: R, power: 1} + {face: L, power: 1} + rotation
 * - `M` → {face: L, power: 1} + {face: R, power: 3} + rotation
 * - `x` → no physical moves, just rotation
 */
export interface PhysicalMove {
  /** Physical face being turned */
  face: Face;

  /** Turn power: 1 = 90°, 2 = 180°, 3 = -90° */
  power: number;

  /** Index in original algorithm (for progress tracking) */
  algIndex: number;
}

/** TwistyPlayer visualisation modes */
export type VisualizationMode = "3D" | "2D" | "PG3D" | "experimental-2D-LL";

/** Facelet-level cube state — 6 faces × 9 stickers, used by the shared LiveCubeState (see logic/stageDetection). */
export type FaceletState = Record<Face, Face[]>;

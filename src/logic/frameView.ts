/**
 * Showing and reading a cube as it is HELD: a cubecore Frame says which
 * physical face plays each canonical one (e.g. white down, green front for
 * a cross on white). The view turns the picture that way; moves the solver
 * gives (physical faces, as the smart cube reports them) are re-lettered
 * for the holder.
 */

import { FACES, type Face, type Frame, type Move, type MoveFamily, formatMove } from "@wodzik/cubecore/core";

/** The quaternion that turns the drawn cube so `frame`'s faces sit where the holder sees them. */
export function frameQuaternion(frame: Frame): { x: number; y: number; z: number; w: number } {
  // physical = M · canonical → turn the picture by Mᵀ.
  const M = frame.matrix;
  const m = [0, 1, 2].map((r) => [0, 1, 2].map((c) => M[c][r]));
  const tr = m[0][0] + m[1][1] + m[2][2];
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    return { w: s / 4, x: (m[2][1] - m[1][2]) / s, y: (m[0][2] - m[2][0]) / s, z: (m[1][0] - m[0][1]) / s };
  }
  if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2;
    return { w: (m[2][1] - m[1][2]) / s, x: s / 4, y: (m[0][1] + m[1][0]) / s, z: (m[0][2] + m[2][0]) / s };
  }
  if (m[1][1] > m[2][2]) {
    const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2;
    return { w: (m[0][2] - m[2][0]) / s, x: (m[0][1] + m[1][0]) / s, y: s / 4, z: (m[1][2] + m[2][1]) / s };
  }
  const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
  return { w: (m[1][0] - m[0][1]) / s, x: (m[0][2] + m[2][0]) / s, y: (m[1][2] + m[2][1]) / s, z: s / 4 };
}

/** Face turns (physical faces) as the holder of `frame` names them. */
export function heldMoves(moves: readonly Move[], frame: Frame): Move[] {
  const letterOf = new Map<Face, Face>(FACES.map((canonical) => [frame.face[canonical], canonical]));
  return moves.map((m) => {
    const held = letterOf.get(m.family as Face);
    return held ? { ...m, family: held as MoveFamily } : m;
  });
}

export const heldAlg = (moves: readonly Move[], frame: Frame): string => heldMoves(moves, frame).map(formatMove).join(" ");

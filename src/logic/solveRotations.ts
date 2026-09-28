/**
 * Cube rotations in a solve (from the gyroscope, services/gyroOrientation):
 * recorded next to the raw moves, and the solve re-lettered as it was seen —
 * with orange in front, an L turn was an "F", a y later the faces shift again.
 *
 * record.moves keep the PHYSICAL faces (stage detection, case recognition
 * and every stat run on them, unchanged); rotations only change how the
 * solve is shown and replayed.
 *
 * PURE FUNCTIONS.
 */

import type { Face } from "@wodzik/cubecore/core";
import type { RotationRecord, SolveRecord } from "../types/solve";
import { type Grip, IDENTITY_GRIP, rotateGrip, rotationBetween } from "./grip";
import { collapseIdenticalMoves } from "./moveReduction";

/** A solve's rotations from the grip changes around it (times: performance.now(), like the moves' timestamps). */
export function recordRotations(
  startGrip: Grip,
  changes: readonly { at: number; rotation: string }[],
  moveTimestamps: readonly number[],
  startTime: number
): { startRotation: string; rotations: RotationRecord[] } {
  return {
    startRotation: rotationBetween(IDENTITY_GRIP, startGrip),
    rotations: changes.map((c) => ({
      after: moveTimestamps.filter((t) => t <= c.at).length,
      t: Math.max(0, Math.round(c.at - startTime)),
      move: c.rotation,
    })),
  };
}

export type HeldToken =
  | { kind: "rotation"; move: string; t: number; after: number }
  | { kind: "move"; move: string; t: number; index: number };

/** A physical move ("L'", "R2") as the holder of `grip` names it. */
export function heldMove(move: string, grip: Grip): string {
  const face = move[0] as Face;
  const canonical = (Object.keys(grip.face) as Face[]).find((c) => grip.face[c] === face);
  return canonical ? canonical + move.slice(1) : move;
}

export const hasRotations = (record: Pick<SolveRecord, "startRotation">): boolean => record.startRotation !== undefined;

/**
 * The solve as seen: the moves re-lettered for the grip they were made in,
 * the rotations between them (back-to-back ones combined: y y = y2, y y' =
 * nothing). Null for a solve recorded without rotations.
 */
export function heldTokens(record: Pick<SolveRecord, "moves" | "startRotation" | "rotations">): HeldToken[] | null {
  if (record.startRotation === undefined) return null;
  let grip = rotateGrip(IDENTITY_GRIP, record.startRotation);
  const rotations = [...(record.rotations ?? [])].sort((a, b) => a.after - b.after || a.t - b.t);
  const tokens: HeldToken[] = [];
  let r = 0;
  for (let i = 0; i <= record.moves.length; i++) {
    let target = grip;
    let t = 0;
    while (r < rotations.length && rotations[r].after <= i) {
      target = rotateGrip(target, rotations[r].move);
      t = rotations[r].t;
      r++;
    }
    const net = rotationBetween(grip, target);
    if (net) tokens.push({ kind: "rotation", move: net, t, after: i });
    grip = target;
    if (i < record.moves.length) {
      const m = record.moves[i];
      tokens.push({ kind: "move", move: heldMove(m.move, grip), t: m.relativeMs, index: i });
    }
  }
  return tokens;
}

/** Single rotations in a token's "x y" = 2. */
const rotationCountOf = (move: string) => move.split(/\s+/).filter(Boolean).length;

/** How many cube rotations the solve had (not counting how it was picked up). */
export const rotationCount = (tokens: readonly HeldToken[]): number =>
  tokens.reduce((n, t) => n + (t.kind === "rotation" ? rotationCountOf(t.move) : 0), 0);

/**
 * The display moves from raw move `from` to `to` (inclusive), with the
 * rotations made before each of them — a rotation between two stages opens
 * the later one. Runs of the same move collapse (R R = R2), like
 * SolveRecord.reducedMoves.
 */
export function heldDisplay(tokens: readonly HeldToken[], from: number, to: number): string[] {
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    out.push(...collapseIdenticalMoves(run));
    run = [];
  };
  for (const t of tokens) {
    if (t.kind === "move" && t.index >= from && t.index <= to) run.push(t.move);
    else if (t.kind === "rotation" && t.after >= from && t.after <= to) {
      flush();
      out.push(t.move);
    }
  }
  flush();
  return out;
}

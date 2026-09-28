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

import { type Face, applyMoves, solvedState } from "@wodzik/cubecore/core";
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
  | { kind: "move"; move: string; t: number; index: number; /** A slice / wide move made of several raw moves: the last one's index. */ lastIndex?: number };

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
  const rotations = snapToSlices(record.moves, grip, [...(record.rotations ?? [])].sort((a, b) => a.after - b.after || a.t - b.t));
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
  return mergeSlicesAndWides(tokens);
}

/**
 * The gyroscope sits in the core, with the centres: a slice or wide move
 * turns the centres, so it reaches us as face moves plus a "rotation" at the
 * same moment — S as F' B + z, r as L + x. Such a group (the rotation and one
 * or two moves on its axis, within SAME_MOMENT_MS) is the slice / wide move.
 */
const SAME_MOMENT_MS = 350;
const SLICE_WIDE = ["M", "E", "S", "r", "l", "u", "d", "f", "b"].flatMap((f) => [f, `${f}'`, `${f}2`]);
const effect = (alg: string) => applyMoves(solvedState(), alg).join();
const SLICE_WIDE_EFFECT = new Map<string, string>();

function sliceOrWide(group: readonly string[]): string | null {
  if (SLICE_WIDE_EFFECT.size === 0) for (const m of SLICE_WIDE) SLICE_WIDE_EFFECT.set(effect(m), m);
  return SLICE_WIDE_EFFECT.get(effect(group.join(" "))) ?? null;
}

/** How far apart (ms) the gyro's "rotation" of a slice / wide move and its face moves can be reported. */
const SNAP_MS = 600;
const AXIS_FACES: Record<string, [Face, Face]> = { x: ["R", "L"], y: ["U", "D"], z: ["F", "B"] };

/**
 * The gyro and the moves reach us with different delays: the "rotation" of
 * an S can be reported a move or two after its F' B (F' B U L z). Such a
 * rotation is put right after (or before) the face moves on its axis it
 * makes a slice / wide move with — and the moves in between, made after the
 * centres had turned, are lettered accordingly.
 */
function snapToSlices(moves: SolveRecord["moves"], startGrip: Grip, rotations: RotationRecord[]): RotationRecord[] {
  let grip = startGrip;
  const out = rotations.map((r) => ({ ...r }));
  for (const r of out) {
    const faces = AXIS_FACES[r.move[0]];
    if (faces && !/\s/.test(r.move)) {
      const physical = faces.map((f) => grip.face[f]);
      const onAxis = (j: number) => physical.includes(moves[j].move[0] as Face);
      const letters = (idx: number[]) => idx.map((j) => heldMove(moves[j].move, grip));
      const back: number[] = [];
      for (let j = r.after - 1; j >= 0 && back.length < 2 && moves[j].relativeMs >= r.t - SNAP_MS; j--) if (onAxis(j)) back.unshift(j);
      const fwd: number[] = [];
      for (let j = r.after; j < moves.length && fwd.length < 2 && moves[j].relativeMs <= r.t + SNAP_MS; j++) if (onAxis(j)) fwd.push(j);
      const tries: [number[], number][] = [
        [back, back.at(-1)! + 1],
        [back.slice(-1), back.at(-1)! + 1],
        [fwd, fwd[0]],
        [fwd.slice(0, 1), fwd[0]],
      ];
      for (const [idx, after] of tries) {
        if (idx.length === 0) continue;
        if (sliceOrWide([...letters(idx), r.move])) {
          r.after = after;
          break;
        }
      }
    }
    grip = rotateGrip(grip, r.move);
  }
  return out.sort((a, b) => a.after - b.after || a.t - b.t);
}

export function mergeSlicesAndWides(tokens: readonly HeldToken[]): HeldToken[] {
  const out = [...tokens];
  for (let k = 0; k < out.length; k++) {
    const rot = out[k];
    if (rot.kind !== "rotation" || /\s/.test(rot.move)) continue;
    // Two moves around it first (a slice), then one (a wide move).
    const windows: [number, number][] = [
      [k - 2, k],
      [k - 1, k + 1],
      [k, k + 2],
      [k - 1, k],
      [k, k + 1],
    ];
    for (const [a, b] of windows) {
      if (a < 0 || b >= out.length) continue;
      const group = out.slice(a, b + 1);
      const moves = group.filter((t): t is Extract<HeldToken, { kind: "move" }> => t.kind === "move");
      if (moves.length !== group.length - 1 || moves.some((m) => Math.abs(m.t - rot.t) > SAME_MOMENT_MS)) continue;
      const merged = sliceOrWide(group.map((t) => t.move));
      if (!merged) continue;
      const first = moves[0];
      out.splice(a, b - a + 1, { kind: "move", move: merged, t: first.t, index: first.index, lastIndex: moves.at(-1)!.index });
      k = a;
      break;
    }
  }
  return out;
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

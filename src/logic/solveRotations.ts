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
import { collapseRun } from "./moveReduction";

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
const SAME_MOMENT_MS = 500;
const SLICE_WIDE = ["M", "E", "S", "r", "l", "u", "d", "f", "b"].flatMap((f) => [f, `${f}'`, `${f}2`]);
const effect = (alg: string) => applyMoves(solvedState(), alg).join();
const SLICE_WIDE_EFFECT = new Map<string, string>();

function sliceOrWide(group: readonly string[]): string | null {
  if (SLICE_WIDE_EFFECT.size === 0) for (const m of SLICE_WIDE) SLICE_WIDE_EFFECT.set(effect(m), m);
  return SLICE_WIDE_EFFECT.get(effect(group.join(" "))) ?? null;
}

/** How far apart (ms) the gyro's "rotation" of a slice / wide move and its face moves can be reported. */
const SNAP_MS = 600;
/** Face moves one slice / wide move can come as: a half slice turn done as two quarters is four (R' L R' L). */
const MAX_GROUP = 4;
/** A slice's rotation can come in this late (ms) — past a couple of other moves — when the cube wasn't held still. */
const SLICE_LATE_MS = 2500;
const SLICE_SKIP = 2;

/**
 * The consecutive run (up to MAX_GROUP) of moves on the axis nearest to
 * `from` going `dir`, skipping at most SLICE_SKIP other moves before it,
 * within SLICE_LATE_MS of the rotation.
 */
function axisRun(moves: SolveRecord["moves"], from: number, dir: 1 | -1, onAxis: (j: number) => boolean, t: number): number[] {
  let j = from;
  let skipped = 0;
  while (j >= 0 && j < moves.length && !onAxis(j) && skipped < SLICE_SKIP && Math.abs(moves[j].relativeMs - t) <= SLICE_LATE_MS) {
    j += dir;
    skipped++;
  }
  const run: number[] = [];
  while (j >= 0 && j < moves.length && onAxis(j) && run.length < MAX_GROUP && Math.abs(moves[j].relativeMs - t) <= SLICE_LATE_MS) {
    if (dir === -1) run.unshift(j);
    else run.push(j);
    j += dir;
  }
  return run;
}
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
      // The last run of this axis's moves before it (a few other moves may
      // have come in between — made after the slice, while the gyro hadn't
      // settled, e.g. a pause to recognise the next case), and the first after.
      const back = axisRun(moves, r.after - 1, -1, onAxis, r.t);
      const fwd = axisRun(moves, r.after, 1, onAxis, r.t);
      // The most moves first (M2 as four quarter turns), then fewer.
      const tries: [number[], number][] = [];
      for (let n = MAX_GROUP; n >= 1; n--) if (back.length >= n) tries.push([back.slice(-n), back.at(-1)! + 1]);
      for (let n = MAX_GROUP; n >= 1; n--) if (fwd.length >= n) tries.push([fwd.slice(0, n), fwd[0]]);
      for (const [idx, after] of tries) {
        // Far from the rotation, only a slice's signature (both faces of the axis) is trusted —
        // one face and a rotation could as well be a real regrip after a face turn.
        const far = idx.some((j) => Math.abs(moves[j].relativeMs - r.t) > SNAP_MS);
        if (far && new Set(idx.map((j) => moves[j].move[0])).size < 2) continue;
        if (sliceOrWide([...letters(idx), r.move])) {
          r.after = after;
          // It happened with those moves: its time is theirs (the merge compares times).
          r.t = moves[after > idx[0] ? idx.at(-1)! : idx[0]].relativeMs;
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
    // The most moves around it first — a slice half turn made of quarters
    // is four (M2: R' L R' L + x2), a slice two, a wide move one.
    const windows: [number, number][] = [];
    for (let n = MAX_GROUP; n >= 1; n--) for (let o = 0; o <= n; o++) windows.push([k - n + o, k + o]);
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

/** The y's in a rotation token ("x y" = 1): an x or z is usually part of an algorithm, a y is a regrip. */
const rotationCountOf = (move: string) => move.split(/\s+/).filter((m) => m.startsWith("y")).length;

/** How many regrips (y rotations) the solve had — x / z aren't counted, nor how it was picked up. The moves still show every rotation. */
export const rotationCount = (tokens: readonly HeldToken[]): number =>
  tokens.reduce((n, t) => n + (t.kind === "rotation" ? rotationCountOf(t.move) : 0), 0);

/** A solve without rotations recorded as tokens: its raw moves. */
export const plainTokens = (record: Pick<SolveRecord, "moves">): HeldToken[] =>
  record.moves.map((m, i) => ({ kind: "move", move: m.move, t: m.relativeMs, index: i }));

/** The solve as seen (rotations recorded), else as reported. */
export const solveTokens = (record: Pick<SolveRecord, "moves" | "startRotation" | "rotations">): HeldToken[] =>
  heldTokens(record) ?? plainTokens(record);

/** One shown move — a run of the same quarter turn collapsed (U U = U2, U' U' = U2') — or a rotation. */
export interface DisplayItem {
  move: string;
  rotation: boolean;
  /** Raw moves (record.moves indices) it stands for; a rotation: none (first > last). */
  first: number;
  last: number;
  /** A rotation: how many raw moves came before it. */
  after?: number;
  /** Ms after the timer started (a run: its first move). */
  t: number;
}

/** Runs of the same move → one item each; `keep` picks which tokens take part. */
function collapseTokens(tokens: readonly HeldToken[], keep: (t: HeldToken) => boolean): DisplayItem[] {
  const out: DisplayItem[] = [];
  let run: Extract<HeldToken, { kind: "move" }>[] = [];
  const flush = () => {
    if (run.length > 0) {
      const merged = collapseRun(run[0].move, run.length);
      const first = run[0];
      const last = run[run.length - 1];
      if (merged) out.push({ move: merged, rotation: false, first: first.index, last: last.lastIndex ?? last.index, t: first.t });
    }
    run = [];
  };
  for (const t of tokens) {
    if (!keep(t)) continue;
    if (t.kind === "rotation") {
      flush();
      out.push({ move: t.move, rotation: true, first: 0, last: -1, after: t.after, t: t.t });
    } else {
      if (run.length > 0 && run[0].move !== t.move) flush();
      run.push(t);
    }
  }
  flush();
  return out;
}

/**
 * The shown moves from raw move `from` to `to` (inclusive), with the
 * rotations made before each of them — a rotation between two stages opens
 * the later one.
 */
export const displayItems = (tokens: readonly HeldToken[], from: number, to: number): DisplayItem[] =>
  collapseTokens(tokens, (t) => (t.kind === "move" ? t.index >= from && t.index <= to : t.after >= from && t.after <= to));

/** The same as text. */
export const heldDisplay = (tokens: readonly HeldToken[], from: number, to: number): string[] =>
  displayItems(tokens, from, to).map((d) => d.move);

/** What the replay plays, one step each: the whole solve's items (U U is one U2 step). */
export const playbackItems = (tokens: readonly HeldToken[]): DisplayItem[] => collapseTokens(tokens, () => true);

/** The item being shown now in a replay — a list item is "current" when it covers it. */
export type CurrentItem = { rotation: false; first: number; last: number } | { rotation: true; after: number };

export function isCurrent(item: DisplayItem, current: CurrentItem | null): boolean {
  if (!current) return false;
  if (item.rotation) return current.rotation && current.after === item.after;
  return !current.rotation && item.first <= current.last && current.first <= item.last;
}

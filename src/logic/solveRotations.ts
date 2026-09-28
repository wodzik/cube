/**
 * Cube rotations in a solve (from the gyroscope — cubecore GripRecorder, see
 * services/gyroOrientation): recorded next to the raw moves, and the solve
 * shown as it was seen — with orange in front, an L turn was an "F", a y
 * later the faces shift again.
 *
 * record.moves keep the PHYSICAL faces (stage detection, case recognition
 * and every stat run on them, unchanged); rotations only change how the
 * solve is shown and replayed.
 *
 * PURE FUNCTIONS.
 */

import { type HeldToken, heldTokens as cubecoreHeldTokens } from "@wodzik/cubecore/bluetooth";
import type { SolveRecord } from "../types/solve";
import { collapseRun } from "./moveReduction";

export type { HeldToken } from "@wodzik/cubecore/bluetooth";

export const hasRotations = (record: Pick<SolveRecord, "startRotation">): boolean => record.startRotation !== undefined;

/**
 * The solve as seen (cubecore rotations.heldTokens): the moves re-lettered
 * for the grip they were made in, the rotations between them, slices and
 * wide moves read back from face moves with the core's rotation. Null for a
 * solve recorded without rotations.
 */
export function heldTokens(record: Pick<SolveRecord, "moves" | "startRotation" | "rotations">): HeldToken[] | null {
  if (record.startRotation === undefined) return null;
  return cubecoreHeldTokens(
    record.moves.map((m) => ({ move: m.move, t: m.relativeMs })),
    record.startRotation,
    record.rotations ?? []
  );
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

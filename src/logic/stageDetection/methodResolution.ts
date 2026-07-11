/**
 * DORMANT — not currently wired into the live app (see methodResolvers.ts's
 * doc comment for why and what would use this later: real auto-detection,
 * or a "detected X, session says Y — switch?" suggestion). Kept working and
 * tested so reviving either feature is a wiring change, not a rebuild.
 *
 * Runs every candidate MethodResolver (see methodResolvers.ts) in parallel,
 * one StageWalker each, until one confirms — then locks onto it for the
 * rest of the solve and drops every other walker (they stop being
 * fed/evaluated entirely, which is what keeps this cheap even with several
 * undecided candidates: cost scales with the number of candidates still IN
 * THE RUNNING, dropping to exactly one the moment a winner exists).
 *
 * Before anything locks, `.method`/`.boundaries` fall back to the
 * highest-priority (first in registry order) still-active candidate's own
 * progress — a tentative best guess, not a confirmed answer. This is what
 * would let a registry of [cfopResolver, lblResolver] show CFOP's progress
 * right after cross (tentative default), then swap the displayed method to
 * LBL the moment LBL's stronger signal fires, with zero extra plumbing
 * beyond what's here already.
 *
 * With today's registry (methodResolvers.ts has exactly one resolver,
 * stubbed to confirm immediately) this would lock onto CFOP at
 * construction, before any moves.
 */

import type { LiveCubeState } from "./liveCubeState";
import { StageWalker, type TimedMove } from "./methodTracker";
import type { MethodResolver } from "./methodResolvers";
import type { StageBoundary } from "./types";

export class MethodResolution {
  private readonly resolvers: readonly MethodResolver[];
  /** method name -> its walker, for every candidate still in the running. Shrinks to size 1 the instant one confirms. */
  private walkers: Map<string, StageWalker>;
  private lockedMethod: string | null = null;

  constructor(resolvers: readonly MethodResolver[], startState: LiveCubeState) {
    this.resolvers = resolvers;
    this.walkers = new Map(resolvers.map((r) => [r.detector.method, new StageWalker(r.detector, startState)]));
    this.tryLock();
  }

  feedMove(move: TimedMove, moveIndex: number): void {
    if (this.lockedMethod) {
      this.walkers.get(this.lockedMethod)?.feedMove(move, moveIndex);
      return;
    }
    for (const walker of this.walkers.values()) walker.feedMove(move, moveIndex);
    this.tryLock();
  }

  private tryLock(): void {
    for (const resolver of this.resolvers) {
      const walker = this.walkers.get(resolver.detector.method);
      if (walker && resolver.isConfirmed(walker.boundaries)) {
        this.lockedMethod = resolver.detector.method;
        // Every other candidate is ruled out the instant one confirms —
        // stop feeding/evaluating them, freeing their state.
        for (const method of this.walkers.keys()) {
          if (method !== this.lockedMethod) this.walkers.delete(method);
        }
        return;
      }
    }
  }

  /** The locked method once confirmed, otherwise the highest-priority still-active candidate as a tentative default. */
  get method(): string {
    return this.lockedMethod ?? this.resolvers[0]?.detector.method ?? "CFOP";
  }

  get boundaries(): readonly StageBoundary[] {
    return this.walkers.get(this.method)?.boundaries ?? [];
  }

  get isLocked(): boolean {
    return this.lockedMethod !== null;
  }
}

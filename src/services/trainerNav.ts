/**
 * Opening a trainer on one case — e.g. a solve's cross, in the cross
 * trainer's Recognize mode at its optimal length. App listens and switches.
 */

import type { Face, State } from "@wodzik/cubecore/core";
import type { TrainerType } from "../types/trainer";

export interface TrainerRequest {
  type: TrainerType;
  /** The optimal length (the trainer's level) — for trainers with levels. */
  level?: number;
  /** F2L: the slots trained, and "free" / "solved" for the other ones. */
  slots?: string[];
  variant?: string;
  /** OLL / PLL: the case's name (for its stats). */
  caseName?: string;
  /** The face that goes down (the colour setting). */
  bottom: Face;
  /** Recognize mode (the case on the screen) — else scrambled on the cube. */
  virtual: boolean;
  /** The case itself (the whole cube, as in the solve). */
  caseState: State;
}

const EVENT = "act-open-trainer";

export function openTrainer(request: TrainerRequest): void {
  window.dispatchEvent(new CustomEvent<TrainerRequest>(EVENT, { detail: request }));
}

export function onOpenTrainer(fn: (r: TrainerRequest) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<TrainerRequest>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}

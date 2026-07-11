import type { LiveCubeState } from "./liveCubeState";

/**
 * A method (CFOP, Roux, ...) is just an ordered list of stages + a
 * predicate per stage, reading the ONE shared LiveCubeState. Adding a new
 * method is a new StageDetector config — zero changes to the shared state
 * or to any other method's detector.
 *
 * `context` is created once per computeStageBoundaries walk (via
 * createContext) and threaded through every isStageSolved call in that
 * walk — the one deliberate exception to "stateless per call". CFOP uses it
 * to LOCK which physical face the solver's cross is on the moment cross
 * first solves, so f2l/oll/pll/auf all keep checking that SAME face for the
 * rest of the walk, rather than re-running the face-agnostic search on
 * every move. Re-detecting fresh each time is what the pre-lock version did
 * — it's a real bug risk: a short move sequence can coincidentally line up
 * another face's 4 cross edges too, and the face-agnostic search
 * (`FACES.find`, first match wins) would silently jump to that OTHER face
 * for every stage from that point on, attributing OLL/PLL/AUF to the wrong
 * axis. A detector without this need (e.g. Roux, which tracks fixed
 * absolute-position blocks, not a face-agnostic cross) can just ignore the
 * parameter — it's optional on both sides.
 */
export interface StageDetector {
  method: string;
  stages: readonly string[];
  /** Fresh context for one computeStageBoundaries walk, or undefined if the caller checks a single stage/state in isolation (e.g. tests) — implementations should fall back to best-effort re-detection in that case. */
  createContext?(): unknown;
  isStageSolved(stage: string, state: LiveCubeState, context?: unknown): boolean;
}

/** A stage's completion point within a move sequence — boundaries only, no move duplication. */
export interface StageBoundary {
  stage: string;
  moveIndex: number;
  timestampMs: number;
}

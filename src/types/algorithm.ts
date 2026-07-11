/**
 * Types for the algorithm training system.
 * Used by algorithmStore, algorithm training hooks, and all algorithm pages.
 */

export type LearningStatus = "not-started" | "learning" | "learned";

export type AlgGroup =
  | "f2l-front-right"
  | "f2l-front-left"
  | "f2l-back-right"
  | "f2l-back-left"
  | "f2l-advanced"
  | "oll"
  | "pll";

/** Training and Attack are different practice contexts — their stats are kept separate, not pooled. */
export type AttemptSource = "training" | "attack";

/**
 * A single algorithm execution attempt.
 */
export interface AlgorithmAttempt {
  /** Execution time in seconds */
  time: number;
  /** Whether any errors were made during execution (even if corrected) */
  hadErrors: boolean;
  /** Which practice mode recorded this — absent on attempts recorded before this field existed, treated as "training" (the only mode that recorded attempts back then). */
  source?: AttemptSource;
}

/**
 * A single algorithm variant — one way to execute the case.
 */
export interface AlgorithmVariant {
  /** Unique ID: "{group}-{caseIndex}-{variantIndex}" */
  id: string;
  name: string;
  /** Algorithm in standard cube notation, e.g. "R U R' U'" */
  alg: string;
  /** Only the default variant is shown in the attack queue and case cards */
  isDefault: boolean;
  youtubeUrl?: string;
  /** Execution attempts (all recorded attempts with metadata) */
  times: AlgorithmAttempt[];
  /** WCA-style moving averages (null when not enough data) */
  ao5: number | null;
  ao12: number | null;
  ao100: number | null;
  bestTime: number | null;
  learningStatus: LearningStatus;
}

/**
 * A single recognisable case, e.g. "OLL 33", "Aa-perm", "F2L #1".
 * Each case may have multiple variants (different algorithms for the same case).
 */
export interface AlgorithmCase {
  name: string;
  category: string;
  subcategory?: string;
  algList: AlgorithmVariant[];
  /** Whether this case is marked/selected for a training session (persisted). */
  selected?: boolean;
}

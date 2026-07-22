/**
 * Types for the algorithm training system.
 * Used by algorithmStore, algorithm training hooks, and all algorithm pages.
 */

import type { StickeringMaskOrbits, VisualizationMode } from "./cube";

export type LearningStatus = "not-started" | "learning" | "learned";

/**
 * A group id used to be a fixed union of the 7 built-in groups. It's now any
 * string — user-created groups get a generated id, the 7 built-ins keep
 * their original literal ids ("oll", "f2l-advanced", …) so existing
 * localStorage data (alg_group_{id} keys, stats, learning status) is
 * unaffected. See services/algGroupRegistry.ts for how groups are listed,
 * created, and displayed.
 */
export type AlgGroup = string;

/**
 * How a group/subgroup/case's stickering resolves — either a named
 * cubing.js scheme ("OLL" | "PLL" | "F2L" | "full" | …) or a piece-level
 * mask built from a composable checklist of predefined piece-groups (see
 * logic/maskPieceGroups.ts), with an optional hand-edited raw override that
 * wins outright when present.
 */
export type StickeringConfig =
  | { kind: "named"; value: string }
  | { kind: "mask"; pieceGroups: string[]; rawOverride?: StickeringMaskOrbits };

/**
 * Per-group/subgroup/case display settings — what the case/subgroup card
 * and the (bigger) cube preview show. Visualization is intentionally split:
 * e.g. OLL/PLL show a compact 2D-last-layer grid on cards but a full 3D cube
 * on the practice/edit preview — stickering and camera stay shared since
 * there's rarely a reason for those to differ between the two.
 */
export interface DisplayConfig {
  stickering: StickeringConfig;
  cardVisualization: VisualizationMode;
  cubeVisualization: VisualizationMode;
  cameraLatitude: number;
  cameraLongitude: number;
}

/**
 * A clickable folder inside a group (e.g. ZBLL grouped by top-layer
 * pattern) — its own display config and its own case list. The folder
 * card's preview is rendered the exact same way a case card is: apply
 * `previewAlg`'s inverse as the setup alg.
 */
export interface AlgSubgroup {
  id: string;
  name: string;
  previewAlg: string;
  displayConfig?: Partial<DisplayConfig>;
  cases: AlgorithmCase[];
}

/** Registry entry describing one group — see services/algGroupRegistry.ts. */
export interface AlgGroupMeta {
  id: string;
  name: string;
  /** One of the 7 originally-hardcoded groups — kept around mostly so "delete" can refuse them. */
  isBuiltIn: boolean;
  displayConfig: DisplayConfig;
  /** Setup algorithm for this group's own card preview (tab icon, folder-grid view of a parent group) — same mechanism as a case/subgroup card. Blank = solved-cube icon. */
  previewAlg?: string;
  hasSubgroups: boolean;
  /** Present only when hasSubgroups. Cases for a subgroup-less group stay in the existing alg_group_{id} store. */
  subgroups?: AlgSubgroup[];
}

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
  /** "Advanced" per-case override of the group's (or subgroup's) display config — e.g. masking specific slots on one F2L Adv case. */
  displayConfigOverride?: Partial<DisplayConfig>;
}

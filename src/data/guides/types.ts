/**
 * Academy guides — long-form, single-scroll tutorials (see components/
 * GuidePage.tsx), replacing the earlier slide carousel. A guide is a list
 * of SECTIONS, each a list of typed BLOCKS; the page renders a sticky table
 * of contents from the sections and the blocks in order.
 *
 * Every cube demo is described by a `setup` (applied to a solved cube,
 * literally — rotations included) plus the `alg` the demo plays. Demos in
 * the solving guides use the "z2" frame: white cross on the BOTTOM, yellow
 * on top, green in front — the way a solver actually holds the cube — see
 * guideMask() in logic/guideMasks.ts for why masks are built in that frame.
 *
 * Inline notation: text in backticks (`R U R' U'`) renders as move
 * notation — see GuidePage's renderInline.
 */

import type { GuideMaskKind } from "../../logic/guideMasks";

export interface GuideDemo {
  /** Applied before `alg`, literally (not inverted). Use guideSetup() to build "z2 + inverse of alg" scenes. */
  setup?: string;
  /** Moves the demo plays from `setup`. "" for a static picture (checkpoints). */
  alg: string;
  /** Piece-level mask — which parts of the cube are relevant to this demo. */
  mask?: GuideMaskKind;
  /** Camera: "top" (default) looks down on the yellow face; "bottom" looks up at the white face — for cross / first-layer checkpoints. */
  view?: "top" | "bottom";
  /** Auto-play `alg` on a loop with no controls (single moves, triggers) instead of a parked, play-it-yourself player. */
  loop?: boolean;
  /** Repeat `alg` this many times back-to-back when looping (e.g. sexy move returns to solved after 6). */
  repeat?: number;
  /** Caption under the cube. */
  label?: string;
  /** Show a "Try this" button opening the physical-cube practice popup (VariantTest) for `alg`. */
  tryOnCube?: boolean;
}

/** One recognisable situation → what to do about it. Rendered as a card with a demo. */
export interface GuideCase {
  id: string;
  name: string;
  /** What you see — the recognition cue. */
  recognise: string;
  /** How to hold the cube before applying the alg. */
  hold?: string;
  /** Display notation — may contain "(...)" trigger grouping, like academy.ts. */
  alg: string;
  demo: GuideDemo;
  /** Extra remark under the alg (e.g. "same as OLL 45", a shortcut). */
  note?: string;
}

export type GuideBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "callout"; tone: "tip" | "checkpoint" | "warning" | "note"; title?: string; text: string[]; demo?: GuideDemo }
  | { kind: "demo"; demo: GuideDemo; caption?: string[] }
  | { kind: "demoGrid"; demos: GuideDemo[]; columns?: 2 | 3 }
  | { kind: "cases"; cases: GuideCase[] }
  /** "Practice this in the Academy drill" — jumps to a lesson step. */
  | { kind: "practice"; lessonId: string; stepId: string; label: string }
  /** Link to another guide. */
  | { kind: "guideLink"; guideId: string; label: string; text?: string };

export interface GuideSection {
  id: string;
  title: string;
  /** Short subtitle shown under the title and in the table of contents (e.g. "Step 3"). */
  eyebrow?: string;
  blocks: GuideBlock[];
}

export interface Guide {
  id: string;
  title: string;
  /** One-line hook for the guides index card. */
  tagline: string;
  /** Opening paragraphs under the title. */
  intro: string[];
  /** Grouping on the index page. */
  category: "learn" | "reference";
  /** e.g. "~45 min", shown on the index card and header. */
  readingTime: string;
  /** Guide ids the reader should have done first — rendered as chips linking to them. */
  prerequisites?: string[];
  /** Hero demo shown next to the intro. */
  hero?: GuideDemo;
  /** Looping cube on this guide's index card — an algorithm from one of the guide's own cases (same scene and mask), see helpers.previewOf. */
  preview?: GuideDemo;
  sections: GuideSection[];
}

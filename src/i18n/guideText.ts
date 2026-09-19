/**
 * Shape of a Polish guide overlay (i18n/guides/*.pl.ts). Only prose lives
 * here; algorithms, scenes, masks and ordering stay in data/guides. Blocks are
 * matched to the English blocks BY INDEX inside their section (an entry per
 * English block — `null` where the block has nothing to translate), cases by
 * id. guides.pl.test.ts checks the shapes line up, so an English edit that adds,
 * removes or reshapes a block fails until the Polish side follows.
 */

export type BlockText =
  | null
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "callout"; title?: string; text: string[]; demoLabel?: string }
  | { kind: "demo"; caption?: string[]; label?: string }
  | { kind: "demoGrid" }
  | { kind: "cases" }
  | { kind: "practice"; label: string }
  | { kind: "guideLink"; label: string; text?: string };

export interface CaseText {
  name: string;
  recognise: string;
  hold?: string;
  note?: string;
}

export interface SectionText {
  title: string;
  eyebrow?: string;
  blocks: BlockText[];
}

export interface GuideText {
  title: string;
  tagline: string;
  intro: string[];
  heroLabel?: string;
  sections: Record<string, SectionText>;
  cases: Record<string, CaseText>;
}

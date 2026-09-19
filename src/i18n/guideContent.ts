/**
 * Language-aware view of the Academy guides: data/guides with the Polish
 * overlay (i18n/guides/) applied to prose only. Structure (ids, algorithms,
 * scenes, masks, block order) is never touched. Missing Polish text falls back
 * to English, so a half-translated guide still renders.
 */

import { GUIDES, type Guide, type GuideBlock, type GuideCase, type GuideDemo } from "../data/guides";
import { GUIDES_PL } from "./guides";
import type { BlockText, GuideText } from "./guideText";
import type { Lang } from "./i18n";

function localizeDemo(demo: GuideDemo, label?: string): GuideDemo {
  return label === undefined ? demo : { ...demo, label };
}

function localizeBlock(block: GuideBlock, text: BlockText | undefined): GuideBlock {
  if (!text || text.kind !== block.kind) return block;
  switch (block.kind) {
    case "p":
      return text.kind === "p" ? { ...block, text: text.text } : block;
    case "list":
      return text.kind === "list" ? { ...block, items: text.items } : block;
    case "callout":
      return text.kind === "callout"
        ? { ...block, title: text.title ?? block.title, text: text.text, demo: block.demo ? localizeDemo(block.demo, text.demoLabel) : block.demo }
        : block;
    case "demo":
      return text.kind === "demo" ? { ...block, caption: text.caption ?? block.caption, demo: localizeDemo(block.demo, text.label) } : block;
    case "practice":
      return text.kind === "practice" ? { ...block, label: text.label } : block;
    case "guideLink":
      return text.kind === "guideLink" ? { ...block, label: text.label, text: text.text ?? block.text } : block;
    default:
      return block;
  }
}

function localizeCase(c: GuideCase, text: GuideText["cases"][string] | undefined): GuideCase {
  return text ? { ...c, name: text.name, recognise: text.recognise, hold: text.hold ?? c.hold, note: text.note ?? c.note } : c;
}

export function localizeGuide(guide: Guide, lang: Lang): Guide {
  if (lang === "en") return guide;
  const pl = GUIDES_PL[guide.id];
  if (!pl) return guide;
  return {
    ...guide,
    title: pl.title,
    tagline: pl.tagline,
    intro: pl.intro,
    hero: guide.hero && pl.heroLabel !== undefined ? { ...guide.hero, label: pl.heroLabel } : guide.hero,
    sections: guide.sections.map((section) => {
      const s = pl.sections[section.id];
      if (!s) return section;
      return {
        ...section,
        title: s.title,
        eyebrow: s.eyebrow ?? section.eyebrow,
        blocks: section.blocks.map((block, i) => {
          const localized = localizeBlock(block, s.blocks[i]);
          return localized.kind === "cases"
            ? { ...localized, cases: localized.cases.map((c) => localizeCase(c, pl.cases[c.id])) }
            : localized;
        }),
      };
    }),
  };
}

const cache = new Map<Lang, Guide[]>();

export function localizedGuides(lang: Lang): Guide[] {
  let guides = cache.get(lang);
  if (!guides) {
    guides = GUIDES.map((g) => localizeGuide(g, lang));
    cache.set(lang, guides);
  }
  return guides;
}

export function localizedGuideById(id: string, lang: Lang): Guide | undefined {
  return localizedGuides(lang).find((g) => g.id === id);
}

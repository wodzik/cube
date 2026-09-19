import { describe, expect, it } from "bun:test";
import { GUIDES, type GuideBlock } from "../data/guides";
import { GUIDES_PL } from "./guides";
import { localizeGuide, localizedGuides } from "./guideContent";

/** Notation spans (`R U R'`) must survive translation verbatim, and so must the number of **bold** spans. */
const codeSpans = (text: string) => (text.match(/`[^`]+`/g) ?? []).sort();
const boldCount = (text: string) => (text.match(/\*\*[^*]+\*\*/g) ?? []).length;
function sameMarkup(where: string, en: string, pl: string) {
  expect(`${where}: code ${codeSpans(pl).join(" | ")}`).toBe(`${where}: code ${codeSpans(en).join(" | ")}`);
  expect(`${where}: bold ${boldCount(pl)}`).toBe(`${where}: bold ${boldCount(en)}`);
}
const filled = (where: string, text: string | undefined) => expect(`${where}: ${text?.trim() ? "ok" : "missing"}`).toBe(`${where}: ok`);

function checkBlock(where: string, block: GuideBlock, pl: unknown) {
  const t = pl as { kind: string; [k: string]: unknown } | null;
  if (block.kind === "demoGrid" || block.kind === "cases") {
    expect(`${where}: ${t === null || t.kind === block.kind ? "ok" : "kind mismatch"}`).toBe(`${where}: ok`);
    return;
  }
  expect(`${where}: kind ${t?.kind}`).toBe(`${where}: kind ${block.kind}`);
  switch (block.kind) {
    case "p":
      filled(where, t!.text as string);
      sameMarkup(where, block.text, t!.text as string);
      break;
    case "list": {
      const items = t!.items as string[];
      expect(`${where}: ${items.length} items`).toBe(`${where}: ${block.items.length} items`);
      block.items.forEach((en, i) => sameMarkup(`${where} item ${i}`, en, items[i]));
      break;
    }
    case "callout": {
      const text = t!.text as string[];
      expect(`${where}: ${text.length} paragraphs`).toBe(`${where}: ${block.text.length} paragraphs`);
      block.text.forEach((en, i) => sameMarkup(`${where} para ${i}`, en, text[i]));
      expect(`${where}: title ${block.title ? "needed" : "none"}`).toBe(`${where}: title ${t!.title ? "needed" : "none"}`);
      expect(`${where}: demo label ${block.demo?.label ? "needed" : "none"}`).toBe(`${where}: demo label ${t!.demoLabel ? "needed" : "none"}`);
      break;
    }
    case "demo": {
      expect(`${where}: caption ${block.caption?.length ?? 0}`).toBe(`${where}: caption ${(t!.caption as string[] | undefined)?.length ?? 0}`);
      expect(`${where}: label ${block.demo.label ? "needed" : "none"}`).toBe(`${where}: label ${t!.label ? "needed" : "none"}`);
      break;
    }
    case "practice":
      filled(where, t!.label as string);
      break;
    case "guideLink":
      filled(where, t!.label as string);
      expect(`${where}: text ${block.text ? "needed" : "none"}`).toBe(`${where}: text ${t!.text ? "needed" : "none"}`);
      break;
  }
}

describe("Polish guide overlays line up with the English guides", () => {
  it("every guide has an overlay, and nothing extra", () => {
    expect(Object.keys(GUIDES_PL).sort()).toEqual(GUIDES.map((g) => g.id).sort());
  });

  for (const guide of GUIDES) {
    it(`${guide.id}: same sections, blocks, cases and notation`, () => {
      const pl = GUIDES_PL[guide.id];
      if (!pl) throw new Error(`no overlay for ${guide.id}`);
      filled(`${guide.id} title`, pl.title);
      filled(`${guide.id} tagline`, pl.tagline);
      expect(pl.intro.length).toBe(guide.intro.length);
      guide.intro.forEach((en, i) => sameMarkup(`${guide.id} intro ${i}`, en, pl.intro[i]));
      expect(`${guide.id} hero label ${guide.hero?.label ? "needed" : "none"}`).toBe(`${guide.id} hero label ${pl.heroLabel ? "needed" : "none"}`);
      expect(Object.keys(pl.sections)).toEqual(guide.sections.map((s) => s.id));

      const caseIds: string[] = [];
      for (const section of guide.sections) {
        const s = pl.sections[section.id];
        const where = `${guide.id}/${section.id}`;
        filled(`${where} title`, s.title);
        expect(`${where} eyebrow ${section.eyebrow ? "needed" : "none"}`).toBe(`${where} eyebrow ${s.eyebrow ? "needed" : "none"}`);
        expect(s.blocks.length).toBe(section.blocks.length);
        section.blocks.forEach((block, i) => {
          checkBlock(`${where}[${i}]`, block, s.blocks[i]);
          if (block.kind === "cases") for (const c of block.cases) caseIds.push(c.id);
        });
      }
      expect(Object.keys(pl.cases).sort()).toEqual(caseIds.sort());
      for (const section of guide.sections)
        for (const block of section.blocks)
          if (block.kind === "cases")
            for (const c of block.cases) {
              const t = pl.cases[c.id];
              const where = `${guide.id}/${c.id}`;
              filled(`${where} name`, t.name);
              filled(`${where} recognise`, t.recognise);
              sameMarkup(`${where} recognise`, c.recognise, t.recognise);
              expect(`${where} hold ${c.hold ? "needed" : "none"}`).toBe(`${where} hold ${t.hold ? "needed" : "none"}`);
              expect(`${where} note ${c.note ? "needed" : "none"}`).toBe(`${where} note ${t.note ? "needed" : "none"}`);
              if (c.note && t.note) sameMarkup(`${where} note`, c.note, t.note);
              if (c.hold && t.hold) sameMarkup(`${where} hold`, c.hold, t.hold);
            }
    });
  }

  it("localizing changes prose only — algorithms, scenes, masks and ids are identical", () => {
    for (const guide of GUIDES) {
      const local = localizeGuide(guide, "pl");
      const shape = (g: typeof guide) =>
        g.sections.map((s) => [
          s.id,
          s.blocks.map((b) => (b.kind === "cases" ? b.cases.map((c) => [c.id, c.alg, JSON.stringify({ ...c.demo, label: undefined })]) : b.kind === "demoGrid" ? b.demos : b.kind)),
        ]);
      expect(JSON.stringify(shape(local))).toBe(JSON.stringify(shape(guide)));
      expect(JSON.stringify({ ...local.preview })).toBe(JSON.stringify({ ...guide.preview }));
    }
    expect(localizedGuides("en")[0]).toBe(GUIDES[0]);
  });
});

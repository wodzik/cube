import { describe, it, expect, beforeEach } from "bun:test";
import "../testSetup";
import { en } from "./en";
import { pl } from "./pl";
import { getLang, setLang, t, tn } from "./i18n";
import { ACADEMY_LESSONS } from "../data/academy";
import { ACADEMY_PL } from "./academy.pl";
import { localizeLesson, localizedLessons } from "./academyContent";
import { DATA_NAMES_PL } from "./dataNames.pl";
import { dataLabel } from "./labels";
import { loadAlgGroup } from "../services/algorithmStore";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const PLURAL_SUFFIX = /\.(one|few|many|other)$/;

describe("message catalogs", () => {
  it("Polish defines every English key, non-empty", () => {
    for (const key of Object.keys(en)) expect(`${key}: ${pl[key]?.trim() ? "ok" : "missing"}`).toBe(`${key}: ok`);
  });

  it("Polish has no stray keys (only plural forms of an English key are allowed as extras)", () => {
    for (const key of Object.keys(pl)) {
      if (key in en) continue;
      const base = key.replace(PLURAL_SUFFIX, "");
      expect(`${key}: ${PLURAL_SUFFIX.test(key) && `${base}.other` in en ? "plural form" : "stray"}`).toBe(`${key}: plural form`);
    }
  });

  it("a translation uses the same {placeholders} as its English source", () => {
    for (const [key, text] of Object.entries(en)) expect(`${key}: ${placeholders(pl[key])}`).toBe(`${key}: ${placeholders(text)}`);
  });

  it("every plural base has the Polish one/few/many forms", () => {
    for (const key of Object.keys(en).filter((k) => k.endsWith(".other"))) {
      const base = key.replace(".other", "");
      for (const form of ["one", "few", "many"]) expect(`${base}.${form}: ${pl[`${base}.${form}`] ? "ok" : "missing"}`).toBe(`${base}.${form}: ok`);
    }
  });
});

describe("t / tn / setLang", () => {
  beforeEach(() => {
    localStorage.clear();
    setLang("en");
  });

  it("switching the language changes the text and is persisted", () => {
    expect(t("nav.settings")).toBe("Settings");
    setLang("pl");
    expect(getLang()).toBe("pl");
    expect(t("nav.settings")).toBe("Ustawienia");
    expect(localStorage.getItem("nact_lang")).toBe("pl");
  });

  it("an explicit language argument wins over the current one", () => {
    expect(t("nav.settings", undefined, "pl")).toBe("Ustawienia");
  });

  it("fills {placeholders}, leaving unknown ones intact", () => {
    expect(t("language.switchTo", { name: "Polski" })).toBe("Switch language to Polski");
    expect(t("language.switchTo")).toBe("Switch language to {name}");
  });

  it("an unknown key falls back to the key itself", () => {
    expect(t("no.such.key" as never)).toBe("no.such.key");
  });
});

describe("Academy Polish overlay", () => {
  it("covers every lesson, step and algorithm — text present wherever the English has any — with no stray ids", () => {
    expect(Object.keys(ACADEMY_PL).sort()).toEqual(ACADEMY_LESSONS.map((l) => l.id).sort());
    for (const lesson of ACADEMY_LESSONS) {
      const pl = ACADEMY_PL[lesson.id];
      expect(pl.title.trim()).not.toBe("");
      expect(pl.description.trim()).not.toBe("");
      expect(Object.keys(pl.steps).sort()).toEqual(lesson.steps.map((s) => s.id).sort());
      for (const step of lesson.steps) {
        const ps = pl.steps[step.id];
        expect(`${lesson.id}/${step.id}: ${ps.title && ps.description ? "ok" : "missing"}`).toBe(`${lesson.id}/${step.id}: ok`);
        expect(Object.keys(ps.algs).sort()).toEqual(step.algs.map((a) => a.id).sort());
        for (const alg of step.algs) {
          const pa = ps.algs[alg.id];
          expect(`${lesson.id}/${step.id}/${alg.id} name: ${pa.name ? "ok" : "missing"}`).toBe(`${lesson.id}/${step.id}/${alg.id} name: ok`);
          if (alg.description) expect(`${lesson.id}/${step.id}/${alg.id} description: ${pa.description ? "ok" : "missing"}`).toBe(`${lesson.id}/${step.id}/${alg.id} description: ok`);
        }
      }
    }
  });

  it("localizing changes text only — ids, algorithms, views and required flags are untouched", () => {
    for (const lesson of ACADEMY_LESSONS) {
      const local = localizeLesson(lesson, "pl");
      expect(local.id).toBe(lesson.id);
      expect(local.steps.map((s) => [s.id, s.view, s.algs.map((a) => [a.id, a.alg, a.required])])).toEqual(
        lesson.steps.map((s) => [s.id, s.view, s.algs.map((a) => [a.id, a.alg, a.required])])
      );
      expect(local.title).not.toBe(lesson.title === "Zeta Slotting" || lesson.title === "F2L" ? "" : lesson.title);
    }
    expect(localizedLessons("en")).toBe(localizedLessons("en"));
    expect(localizedLessons("en")[0]).toBe(ACADEMY_LESSONS[0]);
  });
});

describe("Polish names for built-in algorithm data", () => {
  it("every EO4A case has a Polish name", () => {
    const names = loadAlgGroup("eo4a").map((c) => c.name);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(`${name}: ${DATA_NAMES_PL[name] ? "ok" : "missing"}`).toBe(`${name}: ok`);
  });

  it("dataLabel translates in Polish only, and leaves unlisted names (OLL 28, T perm…) alone", () => {
    setLang("en");
    expect(dataLabel("2 Top 2 Bot")).toBe("2 Top 2 Bot");
    setLang("pl");
    expect(dataLabel("2 Top 2 Bot")).toBe("2 górne 2 boczne");
    expect(dataLabel("OLL 28")).toBe("OLL 28");
    setLang("en");
  });
});

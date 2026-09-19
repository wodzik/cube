import { describe, it, expect, beforeEach } from "bun:test";
import "../testSetup";
import { en } from "./en";
import { pl } from "./pl";
import { getLang, setLang, t, tn } from "./i18n";

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

/**
 * i18n core — a tiny typed message lookup, no library.
 *
 *  - `en.ts` is the source of truth: a flat `{ "area.name": "text" }` map
 *    whose keys become the `MessageKey` type. `pl.ts` must define every one
 *    of them (a missing key is a compile error) and may add plural forms.
 *  - The language is module state (persisted under `nact_lang`, default =
 *    the browser's language) so non-React code can call `t()` too; React
 *    components subscribe through `useT` (./useT.ts) and re-render on switch.
 *  - Anything missing at runtime falls back to English, then to the key.
 *
 * Plurals: `tn("solves.count", n)` looks up `solves.count.<category>` where
 * the category comes from Intl.PluralRules (English: one/other, Polish:
 * one/few/many/other), falling back to `.other`. `{name}` in a message is
 * replaced from the params object.
 *
 * Not translated on purpose (the Polish cubing community uses the English
 * terms): move notation, algorithm names (OLL 28, T perm…), method names
 * (CFOP, Roux, F2L), "sexy move", "sledgehammer".
 */

import { en, type MessageKey } from "./en";
import { pl } from "./pl";

export type Lang = "en" | "pl";
export type { MessageKey };

export const LANGS: { id: Lang; short: string; name: string }[] = [
  { id: "en", short: "EN", name: "English" },
  { id: "pl", short: "PL", name: "Polski" },
];

const STORAGE_KEY = "nact_lang";
const CATALOGS: Record<Lang, Record<string, string>> = { en, pl };

function isLang(v: unknown): v is Lang {
  return v === "en" || v === "pl";
}

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // localStorage unavailable — fall through to the browser's language.
  }
  const nav = typeof navigator !== "undefined" ? navigator.language : undefined;
  return nav?.toLowerCase().startsWith("pl") ? "pl" : "en";
}

let current: Lang = detectLang();
const listeners = new Set<() => void>();

function applyToDocument(lang: Lang): void {
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}
applyToDocument(current);

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // preference just won't persist across reloads.
  }
  applyToDocument(lang);
  listeners.forEach((l) => l());
}

export function subscribeLang(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type Params = Record<string, string | number>;

function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

function lookup(lang: Lang, key: string): string | undefined {
  return CATALOGS[lang][key] ?? CATALOGS.en[key];
}

/** Translate `key` into `lang` (default: the current language). */
export function t(key: MessageKey, params?: Params, lang: Lang = current): string {
  return interpolate(lookup(lang, key) ?? key, params);
}

/** Plural-aware: `base` is the message key without its `.one/.few/.many/.other` suffix; `{n}` is filled in with `count`. */
export function tn(base: PluralBase, count: number, params?: Params, lang: Lang = current): string {
  const category = new Intl.PluralRules(lang).select(count);
  const text = lookup(lang, `${base}.${category}`) ?? lookup(lang, `${base}.other`) ?? base;
  return interpolate(text, { n: count, ...params });
}

/** Message keys that end in `.other` are plural bases: "solves.count.other" → "solves.count". */
export type PluralBase = { [K in MessageKey]: K extends `${infer B}.other` ? B : never }[MessageKey];

/** Locale-aware date/time in the app language (not the browser's), e.g. formatDate(ms, { month: "short", day: "numeric" }). */
export function formatDate(epochMs: number, options?: Intl.DateTimeFormatOptions, lang: Lang = current): string {
  return new Date(epochMs).toLocaleDateString(lang, options);
}

export function formatTime(epochMs: number, options?: Intl.DateTimeFormatOptions, lang: Lang = current): string {
  return new Date(epochMs).toLocaleTimeString(lang, options);
}

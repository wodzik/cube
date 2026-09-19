/**
 * React binding for the i18n core: subscribing to the language makes a
 * component re-render when it changes. Use the returned `t` / `tn` in render
 * (not at module scope) — module-level constants should hold message KEYS and
 * be translated where they're displayed.
 */

import { useSyncExternalStore } from "react";
import { getLang, subscribeLang, t as translate, tn as translatePlural, type Lang, type MessageKey, type Params, type PluralBase } from "./i18n";

export interface UseT {
  lang: Lang;
  t: (key: MessageKey, params?: Params) => string;
  tn: (base: PluralBase, count: number, params?: Params) => string;
}

export function useT(): UseT {
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang);
  return {
    lang,
    t: (key, params) => translate(key, params, lang),
    tn: (base, count, params) => translatePlural(base, count, params, lang),
  };
}

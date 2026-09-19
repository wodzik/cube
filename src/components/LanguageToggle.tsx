/**
 * EN / PL switch — lives in the app header next to the theme toggle (the
 * preference is app-wide) and mirrors it: one compact button that shows the
 * language you'd switch TO.
 */

import { LANGS, setLang } from "../i18n/i18n";
import { useT } from "../i18n/useT";

export function LanguageToggle() {
  const { lang, t } = useT();
  const other = LANGS.find((l) => l.id !== lang)!;

  return (
    <button
      onClick={() => setLang(other.id)}
      title={t("language.switchTo", { name: other.name })}
      aria-label={t("language.switchTo", { name: other.name })}
      className="shrink-0 px-2 py-2 rounded-xl text-xs font-bold tracking-wide text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors"
    >
      {other.short}
    </button>
  );
}

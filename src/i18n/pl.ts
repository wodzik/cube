/**
 * Polish messages. Every key of en.ts must appear here (compile error
 * otherwise); plural forms (`base.one/few/many/other`) are extra keys.
 *
 * Glossary (decided with the maintainer — keep it consistent):
 *   - "sexy move", "sledgehammer", algorithm names (OLL 28, T perm…), move
 *     notation, method names (CFOP, Roux, F2L, …): NOT translated.
 *   - headlights → "światła";  daisy → "stokrotka";
 *   - EO4A case names are translated ("2 Top 2 Bot" → "2 górne 2 boczne").
 */

import type { MessageKey } from "./en";

export const pl: Record<MessageKey, string> & Record<string, string> = {
  // ─── Navigation / chrome ───
  "nav.solve": "Układanie",
  "nav.training": "Algorytmy",
  "nav.trainer": "Trenery",
  "nav.attack": "Atak na czas",
  "nav.academy": "Akademia",
  "nav.debug": "Debug",
  "nav.settings": "Ustawienia",
  "theme.toLight": "Przełącz na jasny motyw",
  "theme.toDark": "Przełącz na ciemny motyw",
  "language.label": "Język",
  "language.switchTo": "Zmień język na {name}",

  // ─── Settings ───
  "settings.title": "Ustawienia",
  "settings.subtitle": "Dane są przechowywane wyłącznie lokalnie w tej przeglądarce — bez konta i bez serwera.",
  "settings.section.language": "Język",
  "settings.language.title": "Język interfejsu",
  "settings.language.description": "Dotyczy całej aplikacji. Notacja ruchów i nazwy algorytmów zostają bez zmian.",
  "settings.section.algProgress": "Postępy w algorytmach",
  "settings.algProgress.title": "Zresetuj wszystkie postępy w algorytmach",
  "settings.algProgress.description":
    "Czyści status nauki i zapisane czasy każdej wbudowanej grupy (OLL, PLL, F2L, Advanced F2L, VLS, ZBLL, CMLL, COLL, …) i wczytuje jej przypadki ponownie z domyślnych danych. Własne grupy zostają nietknięte.",
  "settings.algProgress.button": "Resetuj",
  "settings.algProgress.done": "Postępy w algorytmach zresetowane.",
  "settings.section.history": "Historia układań",
  "settings.history.title": "Wyczyść całą historię układań",
  "settings.history.description": "Usuwa każde zapisane ułożenie i każdą sesję. Czasy algorytmów nie są zmieniane.",
  "settings.history.button": "Wyczyść",
  "settings.history.done": "Historia układań wyczyszczona.",
  "settings.section.backup": "Kopia zapasowa",
  "settings.export.title": "Eksportuj dane",
  "settings.export.description": "Pobiera historię układań, sesje i postępy w algorytmach jako plik JSON.",
  "settings.export.button": "Eksportuj",
  "settings.import.title": "Importuj dane",
  "settings.import.description": "Przywraca dane z wcześniej wyeksportowanego pliku JSON. Nadpisuje istniejące dane o tych samych kluczach.",
  "settings.import.button": "Importuj",
  "settings.import.done": "Dane zaimportowane — odśwież stronę, żeby je zobaczyć.",
  "settings.import.failed": "Import nie powiódł się — plik nie był poprawnym JSON-em.",
};

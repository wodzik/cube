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

  // ─── Common ───
  "common.close": "Zamknij",
  "common.cancel": "Anuluj",
  "common.dismiss": "Ukryj",
  "unit.moves.one": "ruch",
  "unit.moves.other": "ruchu",
  "unit.moves.few": "ruchy",
  "unit.moves.many": "ruchów",

  // ─── Notices ───
  "update.title": "Dostępna nowa wersja",
  "update.body": "(ANOTHER) Cube trainer został zaktualizowany — odśwież stronę, żeby pobrać najnowszą wersję. Twoje sesje i ułożenia są zapisane lokalnie i pozostaną nienaruszone.",
  "update.reload": "Odśwież teraz",
  "algUpdate.title": "Zaktualizowano domyślne algorytmy",
  "algUpdate.body": "Niektóre wbudowane zestawy algorytmów zmieniły się w tej aktualizacji. Twoje postępy w nauce i czasy są nietknięte — ale jeśli wolisz zacząć od nowa na nowych domyślnych danych, możesz teraz zresetować wbudowane grupy.",
  "algUpdate.reset": "Wyczyść postępy we wbudowanych grupach i odśwież",
  "algUpdate.keep": "Zachowaj moje postępy",

  // ─── Timer / inspection ───
  "inspection.label": "Inspekcja",
  "inspection.inspect": "INSPEKCJA",
  "inspection.plusTwo": "+2, jeśli zaczniesz teraz",
  "inspection.stopOrDnf": "Zatrzymaj się albo DNF!",
  "inspection.timesUp": "Koniec czasu!",

  // ─── Case view toggles ───
  "caseView.backStickers": "Tylne naklejki",
  "caseView.backStickers.title": "Pokaż półprzezroczyste kopie naklejek ukrytych ścian",
  "caseView.backDistance.title": "Jak daleko od kostki unoszą się tylne naklejki",
  "caseView.backDistance.label": "Odległość tylnych naklejek",
  "caseView.flatView": "Widok płaski",
  "caseView.flatView.title": "Pokaż płaski, rozłożony widok całej kostki pod widokiem 3D",

  // ─── Solve summary / lists ───
  "summary.fluency": "{n}% płynności",
  "recentList.showAll": "Pokaż wszystkie",

  // ─── Devices ───
  "device.cube": "Kostka",
  "device.timer": "Timer",
  "device.connectCube": "Połącz kostkę",
  "device.connectTimer": "Połącz timer",
  "device.disconnect": "Kliknij, aby rozłączyć",

  // ─── Solve controls ───
  "controls.resync": "Zsynchronizuj wizualizację kostki",
  "controls.cancelAttempt": "Anuluj próbę",
  "controls.stopSolve": "Zatrzymaj układanie",
  "controls.discard": "Odrzuć ułożenie",
  "controls.saveDnf": "Zapisz jako DNF",
  "controls.keepSolving": "Układaj dalej",

  // ─── Fluency ───
  "fluency.tooltip": "Jaką część ułożenia faktycznie kręcisz, zamiast się zatrzymywać",

  // ─── Subgroups ───
  "subgroup.settings": "Ustawienia podgrupy",
  "subgroup.cases.one": "{n} przypadek",
  "subgroup.cases.other": "{n} przypadku",
  "subgroup.cases.few": "{n} przypadki",
  "subgroup.cases.many": "{n} przypadków",
  "subgroup.empty": "Brak podgrup — utwórz pierwszą, aby uporządkować tę grupę w foldery.",
  "subgroup.new": "Nowa podgrupa",

  // ─── Playback / Academy cards ───
  "playback.hint": "Naciśnij play albo przechodź po ruchach przyciskami pod kostką. Przeciągnij kostkę, aby zmienić widok.",
  "academyCard.required": "Wymagany",
  "academyCard.niceToKnow": "Warto znać",
  "academyCard.practiceNamed": "{name} — ćwicz teraz",
  "academyCard.show": "Pokaż, jak wykonać ten algorytm",
  "academyCard.practice": "Ćwicz teraz",

  // ─── Move sequence ───
  "sequence.complete": "Gotowe!",
  "sequence.undo": "Cofnij:",
  "sequence.tooManyErrors": "Za dużo błędów!",
  "sequence.reset": "Resetuj",
  "sequence.showLetters": "Pokaż litery",
  "sequence.hideLetters": "Ukryj litery (pokaż kropki)",
  "sequence.refresh": "Odśwież",
  "sequence.errors": "Błędy: {n}",

  // ─── Stages ───
  "stage.corners": "Rogi",
  "stage.edges": "Krawędzie",
  "stage.orientCorners": "Orientacja rogów",
  "stage.orientEdges": "Orientacja krawędzi",
  "stage.orientEither": "Orientacja rogów/krawędzi",
  "stage.permuteCorners": "Permutacja rogów",
  "stage.permuteEdges": "Permutacja krawędzi",

  // ─── Counts ───
  "count.moves.one": "{n} ruch",
  "count.moves.other": "{n} ruchu",
  "count.moves.few": "{n} ruchy",
  "count.moves.many": "{n} ruchów",

  // ─── Stats chart ───
  "stats.mean": "Średnia",
  "stats.noData": "Brak danych",
  "stats.fullscreen": "Otwórz na pełnym ekranie",

  // ─── Timing bar ───
  "timing.totalTime": "Czas całkowity:",
  "timing.recognition": "Rozpoznanie:",
  "timing.execution": "Wykonanie:",
  "timing.tps": "TPS:",
  "timing.turns": "Ruchy:",
  "timing.percentage": "Udział:",
  "timing.totals": "{label} — łącznie",
  "timing.totalRecognition": "Rozpoznanie łącznie:",
  "timing.totalTps": "TPS łącznie:",
  "timing.totalTurns": "Ruchy łącznie:",

  // ─── Trainer summary ───
  "trainerSummary.lastAttempt": "Ostatnia próba",
  "trainerSummary.optimalInline": "optymalnie {n}",
  "trainerSummary.optimal": "Optymalnie!",
  "trainerSummary.hintUsed": "użyto podpowiedzi",
  "trainerSummary.retry": "Powtórz przypadek",
  "trainerSummary.retry.title": "Ćwicz ten sam przypadek jeszcze raz (nowy scramble, ten sam stan docelowy)",
  "trainerSummary.yourSolution": "Twoje rozwiązanie",
  "trainerSummary.wasted": "Nie przybliżył crossa (odległość {from} → {to})",
  "trainerSummary.distance": "Odległość {from} → {to}",
  "trainerSummary.closest": "Najbliższe optymalne",
  "trainerSummary.solutions": "Rozwiązania optymalne ({n})",

  // ─── Trainer summary (plurals) ───
  "trainerSummary.over.one": "+{n} ruch ponad optimum",
  "trainerSummary.over.other": "+{n} ruchu ponad optimum",
  "trainerSummary.over.few": "+{n} ruchy ponad optimum",
  "trainerSummary.over.many": "+{n} ruchów ponad optimum",

  // ─── Trainer summary (plurals) ───
  "trainerSummary.wastedCount.one": "{n} ruch nie zmniejszył odległości do crossa",
  "trainerSummary.wastedCount.other": "{n} ruchu nie zmniejszyło odległości do crossa",
  "trainerSummary.wastedCount.few": "{n} ruchy nie zmniejszyły odległości do crossa",
  "trainerSummary.wastedCount.many": "{n} ruchów nie zmniejszyło odległości do crossa",

  // ─── Trainer summary (plurals) ───
  "trainerSummary.diverged.one": "Najbliższe optymalne — rozeszło się po {n} ruchu",
  "trainerSummary.diverged.other": "Najbliższe optymalne — rozeszło się po {n} ruchu",
  "trainerSummary.diverged.few": "Najbliższe optymalne — rozeszło się po {n} ruchach",
  "trainerSummary.diverged.many": "Najbliższe optymalne — rozeszło się po {n} ruchach",

  // ─── Solve analysis ───
  "analysis.jump": "Przeskocz w odtwarzaczu do tego etapu",
  "analysis.skip": "Pominięty",
  "analysis.recog": "rozp.",
  "analysis.recog.title": "Czas rozpoznania",
  "analysis.exec": "wyk.",
  "analysis.exec.title": "Czas wykonania",
  "analysis.stageTotal": "Łączny czas tego etapu",
  "analysis.useScramble": "Użyj tego scramble'a",
  "analysis.useScramble.title": "Przemieszaj kostkę dokładnie tym scramble'em i spróbuj jeszcze raz",
  "analysis.steps": "{method} — etapy",
  "analysis.solveMoves": "Ruchy ułożenia",
  "analysis.moveToSession": "Przenieś do sesji…",
  "analysis.newSession": "+ Nowa sesja…",
  "analysis.confirmDelete": "Kliknij ponownie, aby usunąć",
  "analysis.delete": "Usuń ułożenie",

  // ─── Dates / relative time ───
  "time.justNow": "przed chwilą",
  "time.minutesAgo": "{n} min temu",

  // ─── Dates / relative time ───
  "time.hoursAgo.one": "{n} godzinę temu",
  "time.hoursAgo.other": "{n} godziny temu",
  "time.hoursAgo.few": "{n} godziny temu",
  "time.hoursAgo.many": "{n} godzin temu",

  // ─── Dates / relative time ───
  "time.daysAgo.one": "{n} dzień temu",
  "time.daysAgo.other": "{n} dnia temu",
  "time.daysAgo.few": "{n} dni temu",
  "time.daysAgo.many": "{n} dni temu",

  // ─── Solve page ───
  "solve.title": "Układanie na czas",
  "solve.hint.scramble": "Wykonaj scramble pokazany powyżej",
  "solve.hint.manualSetup": "Ustaw kostkę ręcznie, potem kliknij Gotowe",
  "solve.hint.release": "Puść, aby zacząć!",
  "solve.hint.holding": "Trzymaj dalej…",
  "solve.hint.makeMove": "wykonaj ruch",
  "solve.hint.pressSpace": "naciśnij spację",
  "solve.hint.startTimer": "uruchom timer",
  "solve.hint.or2": "{a} lub {b}",
  "solve.hint.or3": "{list} lub {last}",
  "solve.hint.toBegin": "{text}, aby zacząć",
  "solve.movesTps": "{moves} · {tps} TPS",
  "solve.generating": "Generowanie scramble'a…",
  "solve.statsLabel": "Sesja: {name}",
  "solve.nextScramble": "Następny scramble",
  "solve.paste.title": "Wklej lub wpisz własny scramble",
  "solve.paste.placeholder": "Wklej lub wpisz scramble, np. R U2 R' F D2…",
  "solve.paste.apply": "Zastosuj",
  "solve.paste.empty": "Wpisz co najmniej jeden ruch.",
  "solve.paste.invalid": "Niepoprawna notacja kostki: {moves}",
  "solve.reset": "Resetuj",
  "solve.reset.title": "Zacznij ten scramble od początku",
  "solve.ready": "Gotowe",
  "solve.readyScratch": "Pomieszane ręcznie — gotowe",
  "solve.ready.titleScratch": "Pomiń dokładne dopasowanie pokazanego scramble'a — użyj tego, co do tej pory ręcznie pomieszano",
  "solve.ready.title": "Zatwierdź ustawienie, które właśnie zrobiłeś ręcznie, jako start tej próby",
  "solve.recent": "Ostatnie ułożenia",
  "solve.mv": "{n} ruchów",
  "solve.perPage": "Na stronę",
  "solve.all": "Wszystkie",
  "solve.clickToSort": "Kliknij kolumnę, aby posortować",
  "solve.col.time": "Czas",
  "solve.col.moves": "Ruchy",
  "solve.col.fluency": "Płynność",
  "solve.col.method": "Metoda",
  "solve.col.date": "Data",
  "solve.col.ended": "Kiedy",
  "solve.moveToOther": "Przenieś do innej sesji",
  "solve.moveToSession": "Przenieś do sesji",
  "solve.newSession": "Nowa sesja…",
  "solve.confirmDelete": "Kliknij ponownie, aby usunąć",
  "solve.delete": "Usuń ułożenie",
  "solve.prevPage": "Poprzednia strona",
  "solve.nextPage": "Następna strona",
  "solve.page": "Strona {n} / {total}",

  // ─── Sessions ───
  "session.stage.scratch": "Od zera",
  "session.stage.cross": "Cross → koniec",
  "session.stage.f2l": "F2L → koniec",
  "session.stage.oll": "OLL → koniec",
  "session.stage.pll": "Ostatnia warstwa",
  "session.switch": "Przełącz lub zarządzaj sesjami",
  "session.settings": "Ustawienia sesji",
  "session.edit": "Edytuj sesję",
  "session.confirmDelete": "Kliknij ponownie, aby usunąć",
  "session.delete": "Usuń sesję",
  "session.new": "Nowa sesja",
  "session.field.name": "Nazwa",
  "session.field.namePlaceholder": "Nazwa sesji",
  "session.field.input": "Start i stop timera",
  "session.input.cube": "Kostka",
  "session.input.cube.desc": "Startuje przy pierwszym ruchu i zatrzymuje się automatycznie po ułożeniu kostki.",
  "session.input.spacebar": "Spacja",
  "session.input.spacebar.desc": "Przytrzymaj spację, aby uzbroić timer, puść, aby wystartować; naciśnij spację ponownie, aby zatrzymać.",
  "session.input.timer": "Timer BT",
  "session.input.timer.desc": "Start i stop za pomocą podłączonego GAN Smart Timer.",
  "session.field.start": "Punkt startowy",
  "session.start.scratch": "Od zera",
  "session.start.scratch.desc": "Pełny losowy scramble, układanie od początku do końca.",
  "session.start.cross": "Cross gotowy",
  "session.start.cross.desc": "Ustaw ręcznie ułożony cross, potem mierz F2L → OLL → PLL.",
  "session.start.f2l": "F2L gotowe",
  "session.start.f2l.desc": "Ustaw ręcznie ułożone F2L, potem mierz OLL → PLL.",
  "session.start.oll": "OLL gotowe",
  "session.start.oll.desc": "Ustaw ręcznie ułożone F2L + OLL, potem mierz PLL.",
  "session.start.pll": "Ostatnia warstwa gotowa",
  "session.start.pll.desc": "Ustaw ręcznie wszystko poza ostatnim AUF.",
  "session.field.method": "Metoda układania",
  "session.method.hint": "Które etapy śledzi pasek postępu na żywo — automatyczne wykrywanie nie jest jeszcze dostępne, więc wybierz metodę, której naprawdę używasz.",
  "session.method.cfop.desc": "Cross, pary F2L (w dowolnej kolejności), OLL, PLL.",
  "session.method.lbl": "Metoda warstwowa",
  "session.method.lbl.desc": "Cross, rogi pierwszej warstwy, krawędzie drugiej warstwy, OLL, PLL.",
  "session.method.roux.desc": "Pierwszy blok, drugi blok, CMLL, ostatnie sześć krawędzi.",
  "session.field.inspection": "Inspekcja",
  "session.inspection.wca": "15 s WCA",
  "session.inspection.custom": "Własna",
  "session.inspection.none": "Brak",
  "session.inspection.seconds": "sekund (1–120)",
  "session.inspection.invalid": "Wpisz 1–120",
  "session.field.display": "Wyświetlanie",
  "session.display.time": "Czas",
  "session.display.moves": "Tylko liczba ruchów",
  "session.display.hint": "Ukrywa czasy ułożeń w całej sesji — timer, wynik ostatniego ułożenia i historia pokazują zamiast nich liczbę ruchów. Czasy nadal są zapisywane, tylko niewidoczne.",
  "common.save": "Zapisz",
};

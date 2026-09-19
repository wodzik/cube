/**
 * Polish text for the Academy lessons (data/academy.ts) — an OVERLAY keyed by
 * lesson / step / algorithm id. Only text is here; algorithms, masks and
 * ordering stay in data/academy.ts so the two languages can't drift on the
 * actual moves. i18n.test.ts checks every English title/name/description has a
 * Polish counterpart. Glossary: see pl.ts (sexy move, sledgehammer, method and
 * algorithm names stay English).
 */

export interface AlgText {
  name?: string;
  description?: string;
}
export interface StepText {
  title: string;
  description: string;
  algs: Record<string, AlgText>;
}
export interface LessonText {
  title: string;
  description: string;
  steps: Record<string, StepText>;
}

export const ACADEMY_PL: Record<string, LessonText> = {
  "two-first-layers": {
    title: "Dwie pierwsze warstwy",
    description:
      "Pierwsze dwa kroki metody „Warstwa po warstwie”: rogi do pierwszej warstwy za pomocą sexy move, potem krawędzie do drugiej. Zobacz poradnik „Warstwa po warstwie”.",
    steps: {
      corners: {
        title: "Rogi",
        description:
          "Róg nad swoim slotem z przodu po prawej. Biały w prawo: R U R' — sexy move bez ostatniego U', które tylko obraca górną warstwę. Biały w górę: trzy sexy move. Biały do przodu: odwrócony sexy move (albo pięć sexy move). Drill pokazuje pierwszą warstwę jako DOLNĄ warstwę w kolorze żółtym — gra rolę białej.",
        algs: {
          "corner-right": { name: "Biały w prawo", description: "Biała naklejka rogu wskazuje w prawo. To sexy move bez ostatniego U' — ten obrót rusza tylko górną warstwę, więc nie jest potrzebny." },
          "corner-up": { name: "Biały w górę · ×3", description: "Biała naklejka rogu wskazuje w górę." },
          "corner-front": { name: "Biały do przodu · odwrócony", description: "Biała naklejka rogu wskazuje na Ciebie. Pięć sexy move też działa." },
          "corner-left-sexy": { name: "Lewa ręka · ×1", description: "Jak „biały w prawo”, w lustrzanym odbiciu: slot z przodu po lewej, biały w lewo." },
          "corner-left-up": { name: "Lewa ręka · ×3", description: "Jak „biały w górę”, w lustrzanym odbiciu: slot z przodu po lewej, biały w górę." },
          "corner-left-front": { name: "Lewa ręka · odwrócony", description: "Jak „biały do przodu”, w lustrzanym odbiciu: slot z przodu po lewej, biały na Ciebie." },
        },
      },
      edges: {
        title: "Krawędzie",
        description:
          "Krawędź na górze z przodu, z przednią naklejką pasującą do przedniego centrum. Górna naklejka mówi, dokąd idzie: w prawo czy w lewo. Obie sekwencje to dwa triggery jeden po drugim. Dwie pierwsze warstwy są tu dwiema dolnymi.",
        algs: {
          "edge-right": { name: "Idzie w prawo", description: "Górna naklejka pasuje do centrum po prawej." },
          "edge-left": { name: "Idzie w lewo", description: "Górna naklejka pasuje do centrum po lewej." },
        },
      },
    },
  },
  "4lll-corners-first": {
    title: "Ostatnia warstwa",
    description:
      "Ostatnia warstwa w czterech krokach, w obu fazach najpierw rogi, potem krawędzie: zorientuj rogi, zorientuj krawędzie (OLL gotowe), potem spermutuj rogi (blokami A/B) i spermutuj krawędzie.",
    steps: {
      co: {
        title: "1 · Orientacja rogów",
        description:
          "Ustaw wszystkie cztery rogi ostatniej warstwy tak, żeby pokazywały kolor góry. Powtarzaj sexy move w środku F … F', aż przypadek się rozwiąże, albo użyj Sun / Antisun. A i B to klocki, które trzeba znać na pamięć — staną się permutacją rogów w kroku 3.",
        algs: {
          sexy1: { name: "Pojedynczy sexy", description: "Jeden sexy move w środku F … F'. Jako pełne OLL to przypadek 45." },
          sexy2: { name: "Podwójny sexy", description: "Dwa sexy move w środku F … F'. Jako pełne OLL to przypadek 48." },
          sexy3: { name: "Potrójny sexy", description: "Trzy sexy move w środku F … F'. Jako pełne OLL to przypadek 21." },
          sun: { name: "Sun", description: "Sune (OLL 27)." },
          antisun: { name: "Antisun", description: "Anti-Sune (OLL 26)." },
          "block-a": { name: "A (OLL 33)", description: "Algorytm A: sexy move, a po nim sledgehammer. Zapamiętaj go — użyjesz go jeszcze później." },
          "block-b": { name: "B (OLL 37)", description: "Algorytm B. Zapamiętaj go — użyjesz go jeszcze później." },
        },
      },
      eo: {
        title: "2 · Orientacja krawędzi",
        description:
          "Rogi są gotowe, więc to zwykły widok OLL — tylko krawędzie mogą być jeszcze odwrócone. OLL 28 obsługuje dwie sąsiednie odwrócone krawędzie, OLL 57 dwie przeciwległe; przy czterech odwróconych wykonaj któryś z nich i dokończ drugim przypadkiem.",
        algs: {
          oll28: { name: "OLL 28" },
          oll57: { name: "OLL 57" },
          oll20: { name: "OLL 20", description: "Wszystkie cztery krawędzie odwrócone — jeden algorytm zamiast łączenia OLL 28 z OLL 57." },
        },
      },
      cp: {
        title: "3 · Permutacja rogów",
        description:
          "Dwa algorytmy, a obie połówki już znasz: to po prostu połączone A i B. W A + B środkowe F' F się skraca, a R R łączy się w R2 — to jest pokazana sekwencja.",
        algs: {
          "a-plus-b": { name: "A + B", description: "A, potem B — zamienia dwa sąsiednie rogi (to permutacja T). F' F w środku się skraca, a R R łączy się w R2, co daje pokazaną sekwencję." },
          "b-plus-a": { name: "B + A", description: "B, potem A — zamienia dwa przekątne rogi (to permutacja Y). Bez skracania." },
        },
      },
      epll: {
        title: "4 · Permutacja krawędzi (EPLL)",
        description:
          "Ostatni krok: przesuń krawędzie na miejsce. Ua i Ub obejmują każdy 3-cykl; H i Z to dwa rzadsze przypadki zamiany — dobrze je znać albo rozwiązać dwiema permutacjami U.",
        algs: { ua: { name: "Ua" }, ub: { name: "Ub" }, h: { name: "H" }, z: { name: "Z" } },
      },
    },
  },
  "zeta-slotting": {
    title: "Zeta Slotting",
    description:
      "Krawędzie do dwóch pierwszych warstw przed jakimikolwiek rogami, potem mały zestaw algorytmów F2L wkłada każdy róg wokół już osadzonej krawędzi. Zobacz poradnik „Zeta Slotting”.",
    steps: {
      "zeta-edges": {
        title: "Krawędzie",
        description:
          "Krawędź nad przednią ścianą. Jeśli jej górna naklejka pasuje do przedniego centrum (zorientowana), jej przednia naklejka pasuje do centrum po prawej lub lewej, a trzyruchowy insert wysyła ją w tę stronę. Jeśli natomiast jej przednia naklejka pasuje do przedniego centrum (niezorientowana), hedgeslammer wkłada ją bezpośrednio.",
        algs: {
          "edge-right": { name: "Zorientowana · w prawo", description: "Górna naklejka pasuje do przedniego centrum, przednia naklejka pasuje do centrum po prawej." },
          "edge-left": { name: "Zorientowana · w lewo", description: "Górna naklejka pasuje do przedniego centrum, przednia naklejka pasuje do centrum po lewej." },
          "edge-unoriented-right": { name: "Niezorientowana · w prawo", description: "Przednia naklejka pasuje do przedniego centrum, górna naklejka pasuje do centrum po prawej. Hedgeslammer." },
          "edge-unoriented-left": { name: "Niezorientowana · w lewo", description: "Przednia naklejka pasuje do przedniego centrum, górna naklejka pasuje do centrum po lewej. Lewy hedgeslammer." },
        },
      },
      "zeta-corners": {
        title: "Rogi",
        description:
          "Róg nad swoim slotem z przodu po prawej, krawędź już poprawnie osadzona pod nim. Biały w górę: sexy move ×3, dokładnie jak w pierwszej warstwie. Biały do przodu lub w prawo: po jednym dłuższym algorytmie — to, że krawędź ma zostać na miejscu, sprawia, że są dłuższe niż zwykłe inserty pierwszej warstwy.",
        algs: {
          up: { name: "Biały w górę · ×3", description: "Biała naklejka rogu wskazuje w górę. Ten sam algorytm co dla rogu pierwszej warstwy z białym w górę w metodzie podstawowej. F2L 32." },
          front: { name: "Biały do przodu", description: "Biała naklejka rogu wskazuje na Ciebie. F2L 33." },
          right: { name: "Biały w prawo", description: "Biała naklejka rogu wskazuje w prawo. F2L 34." },
          "left-up": { name: "Lewa ręka · biały w górę", description: "Jak „biały w górę”, w lustrzanym odbiciu: slot z przodu po lewej." },
          "left-front": { name: "Lewa ręka · biały do przodu", description: "Lustro „białego do przodu”: slot z przodu po lewej, biała naklejka rogu wskazuje na Ciebie." },
          "left-left": { name: "Lewa ręka · biały w lewo", description: "Lustro „białego w prawo”: slot z przodu po lewej, biała naklejka rogu wskazuje w lewo." },
        },
      },
    },
  },
  f2l: {
    title: "F2L",
    description:
      "Intuicyjne F2L: układaj dwie pierwsze warstwy w parach róg–krawędź zamiast po jednym klocku. Pełne uzasadnienie każdego przypadku znajdziesz w poradniku „F2L dla początkujących”.",
    steps: {
      inserts: {
        title: "Podstawowe inserty",
        description:
          "Para w górnej warstwie jest albo dopasowana (połączona, kolory zgodne), albo rozdzielona (róg nad slotem, krawędź po drugiej stronie góry). Jeden insert na każdy kształt, plus jego lustro dla lewej ręki.",
        algs: {
          "matched-right": { name: "Dopasowana", description: "Odwrócony sexy move — biała naklejka rogu patrzy na Ciebie, krawędź połączona po jego prawej." },
          "split-right": { name: "Rozdzielona", description: "Róg nad swoim slotem, biały w prawo; krawędź po drugiej stronie góry, zielony do góry." },
          "matched-left": { name: "Dopasowana · lewa ręka", description: "Lustro inserta dopasowanego." },
          "split-left": { name: "Rozdzielona · lewa ręka", description: "Lustro inserta rozdzielonego." },
        },
      },
      setup: {
        title: "Przygotowanie pary",
        description:
          "Większość par nie jest gotowa do wstawienia. Każdy z tych przypadków to kilka ruchów przygotowawczych i dokładnie jeden z dwóch podstawowych insertów powyżej.",
        algs: {
          "corner-in-slot-right": { name: "Róg w slocie · biały w prawo", description: "Wyciąga róg, potem insert rozdzielony." },
          "corner-in-slot-front": { name: "Róg w slocie · biały do przodu", description: "Wyciąga róg do dopasowanej pary, potem insert dopasowany." },
          "edge-in-slot": { name: "Krawędź w slocie", description: "Wyciąga krawędź do dopasowanej pary, potem insert dopasowany." },
          "both-in-slot": { name: "Obie w slocie, róg skręcony", description: "Wyjmuje parę, łączy ją, potem insert dopasowany." },
          "apart-white-front": { name: "Osobno · biały do przodu", description: "Łączy parę w kształt dopasowany, potem insert dopasowany." },
          "apart-white-right": { name: "Osobno · biały w prawo", description: "Łączy parę, potem insert rozdzielony." },
          "joined-wrong": { name: "Połączone, złe kolory", description: "Łączy parę poprawnie od nowa, potem insert rozdzielony." },
          "white-up-edge-right": { name: "Biały w górę · krawędź po prawej", description: "Obraca róg tak, żeby biały patrzył w bok, potem insert rozdzielony." },
          "white-up-edge-left": { name: "Biały w górę · krawędź po lewej", description: "Łączy parę w kształt dopasowany, potem insert dopasowany." },
        },
      },
    },
  },
};

import type { GuideText } from "../guideText";

export const BEGINNER_F2L_PL: GuideText = {
  title: "F2L dla początkujących",
  tagline: "Układaj dwie pierwsze warstwy w parach róg–krawędź. Cztery inserty i kilka ruchów przygotowawczych pokrywają każdy przypadek — nie ma nic do wykucia.",
  intro: [
    "W metodzie dla początkujących układasz rogi pierwszej warstwy, a potem krawędzie drugiej warstwy — osiem klocków, jeden po drugim. F2L („first two layers”, dwie pierwsze warstwy) układa te same osiem klocków jako cztery **pary**: róg i krawędź, która do niego należy, połączone na górze i wstawione razem. To ta sama kostka i te same sloty, tylko mniej, mądrzejszych ruchów.",
    "Nie ucz się tej strony jako listy algorytmów. Czytaj, co każda sekwencja ruchów **robi** — otwiera slot, usuwa klocek z drogi, zamyka go — a 41 „przypadków” zredukuje się do kilku pomysłów, które możesz wypracować przy kostce.",
  ],
  sections: {
    what: {
      title: "Czym jest F2L?",
      eyebrow: "Pomysł",
      blocks: [
        { kind: "p", text: "Po crossie każdy z czterech rogów pierwszej warstwy ma dokładnie jedną krawędź środkowej warstwy, która należy bezpośrednio nad nim. Razem wypełniają jeden **slot** — slot z przodu po prawej to miejsce między zielonym a pomarańczowym centrum, nad zielono-pomarańczową krawędzią crossa. F2L to: ustaw róg i jego krawędź obok siebie w górnej warstwie, tak by tworzyły parę, a potem wrzuć parę do jej slotu trzema lub czterema ruchami." },
        { kind: "p", text: "Wszystko poniżej jest pokazane na jednej parze — biały/zielony/pomarańczowy, wchodzącej do slotu z przodu po prawej. Pozostałe trzy pary są już ułożone, a ostatnia warstwa jest zszarzona: **gdy robisz F2L, górna warstwa nie ma znaczenia**. Obracaj ją, ile chcesz." },
        { kind: "callout", title: "Każdy przypadek ma swoje lustro", text: ["Wszystko tutaj jest pokazane dla slotu z przodu po prawej prawą ręką. Ta sama sytuacja na slocie z przodu po lewej używa lustra: zamień `R` na `L'`, `R'` na `L`, `U` na `U'` — wersje na lewą rękę dwóch podstawowych insertów są wypisane wprost, żebyś zobaczył wzór."] },
      ],
    },
    inserts: {
      title: "Dwa podstawowe inserty",
      eyebrow: "Krok 1",
      blocks: [
        { kind: "p", text: "Para w górnej warstwie ma jeden z dwóch kształtów. **Dopasowana:** róg i krawędź są obok siebie, a ich kolory się zgadzają — z boku widzisz blok 2×1 jednego koloru, z góry inny. **Rozdzielona:** róg jest nad swoim slotem, a krawędź jest po drugiej stronie górnej warstwy, bez kontaktu." },
        { kind: "cases" },
        { kind: "callout", text: ["Zauważ, że oba inserty różnią się tylko tym, dokąd wskazuje biała naklejka rogu: **do Ciebie** → insert dopasowany (`U R U' R'`), **w bok** → insert rozdzielony (`R U R'`). Krawędź musi tylko być we właściwym miejscu dla tego inserta."] },
        { kind: "practice", label: "Poćwicz oba inserty w Akademii" },
      ],
    },
    setup: {
      title: "Przygotowanie pary",
      eyebrow: "Krok 2",
      blocks: [
        { kind: "p", text: "Przez większość czasu para nie jest gotowa do wstawienia. Wtedy poświęcasz kilka ruchów, by sprowadzić ją do jednego z dwóch kształtów powyżej — i każde przygotowanie poniżej kończy się dokładnie jednym z czterech podstawowych insertów. Przeczytaj notatkę pod każdym przypadkiem: nazywa ruchy przygotowawcze i insert, do którego prowadzą." },
        { kind: "p", text: "**Klocek utknął w slocie.** Wyciągnij go tymi samymi ruchami, których użyłbyś do wstawiania — `R U R'` lub `R U' R'` — wybierając kierunek, który ułoży go obok partnera." },
        { kind: "cases" },
        { kind: "p", text: "**Klocki są osobno na górze.** Najpierw je połącz: unieś róg z drogi slotu, przesuń krawędź obok niego, odłóż róg z powrotem. Potem wstaw." },
        { kind: "cases" },
        { kind: "p", text: "**Biały do góry.** Ten kłopotliwy: gdy biały jest na górze, żaden z podstawowych insertów nie działa bezpośrednio. Najpierw obróć róg — ruch w stylu `R U2 R'` przewraca go na biały z boku — a potem to zwykły przypadek." },
        { kind: "cases" },
        { kind: "callout", title: "Na początku wolniej — to normalne", text: ["Przejście z metody dla początkujących na F2L spowalnia Cię na tydzień czy dwa, gdy uczysz się widzieć pary. Wytrwaj: potem to największe pojedyncze przyspieszenie, jakie kiedykolwiek dostaniesz."] },
        { kind: "practice", label: "Poćwicz przypadki przygotowania w Akademii" },
      ],
    },
    practice: {
      title: "Jak ćwiczyć",
      eyebrow: "Krok 3",
      blocks: [
        { kind: "list", items: ["**Układaj powoli i patrz.** Przed każdą parą znajdź oba klocki i powiedz, do którego podstawowego inserta zmierzasz. Szybkość przyjdzie później.", "**Jeden slot naraz.** Zakładka Trenery ma ćwiczenia F2L, które mieszają pojedynczą parę nad ułożonym crossem, więc możesz powtarzać rozpoznawanie bez układania całej kostki.", "**Pełna lista przypadków** jest w zakładce Algorytmy (F2L, 41 przypadków), gdy zechcesz optymalnych rozwiązań dla każdej sytuacji — ale można być szybkim, nigdy jej nie otwierając."] },
      ],
    },
    next: {
      title: "Co dalej",
      eyebrow: "Dalej",
      blocks: [
        { kind: "p", text: "Gdy F2L jest opanowane, wąskim gardłem staje się ostatnia warstwa. Ostatnia warstwa zaczynająca od rogów to dobre miejsce, żeby zostać na jakiś czas; Akademia ćwiczy każdy z jej czterech etapów." },
        { kind: "guideLink", label: "Ostatnia warstwa, najpierw rogi", text: "Cztery etapy, z ćwiczeniem dla każdego." },
        { kind: "guideLink", label: "Pierwsze kroki", text: "Obroty szerokie, warstwy środkowe i rotacje, na moment gdy algorytmy robią się dłuższe." },
      ],
    },
  },
  cases: {
    "matched-right": { name: "Dopasowana para, prawa ręka", recognise: "Para jest połączona z przodu po prawej w górnej warstwie; biała naklejka rogu patrzy na Ciebie, a krawędź leży po jego prawej stronie z zgodnymi kolorami.", hold: "Slot z przodu po prawej.", note: "Odsuń parę od slotu (`U`), otwórz slot (`R`), przynieś parę nad niego (`U'`), zamknij (`R'`). To odwrócony sexy move." },
    "matched-left": { name: "Dopasowana para, lewa ręka", recognise: "Ten sam kształt, w lustrze: para jest z przodu po lewej, biały do Ciebie, krawędź po jego lewej.", hold: "Slot z przodu po lewej.", note: "Dokładne lustro: `U'`, otwórz `L'`, `U`, zamknij `L`." },
    "split-right": { name: "Rozdzielona para, prawa ręka", recognise: "Róg jest nad swoim slotem z białym w prawo; krawędź jest z tyłu górnej warstwy, zielonym (kolorem przodu) do góry.", hold: "Slot z przodu po prawej.", note: "Otwórz slot (`R`) — róg odjeżdża do tyłu; krawędź przyjeżdża (`U`) i się z nim łączy; zamknij (`R'`), a para wpada." },
    "split-left": { name: "Rozdzielona para, lewa ręka", recognise: "W lustrze: róg nad slotem z przodu po lewej z białym w lewo; krawędź z tyłu, zielonym do góry.", hold: "Slot z przodu po lewej.", note: "Lustro inserta rozdzielonego." },
    "corner-in-slot-right": { name: "Róg w slocie, biały w prawo", recognise: "Róg jest w swoim slocie, ale skręcony (biały z boku, wskazuje w prawo); krawędź jest na górze po prawej, zielonym do góry.", hold: "Slot z przodu po prawej.", note: "`R U R'` wyciąga róg; jedno `U'` ustawia krawędź, a `R U R'` to **insert rozdzielony**." },
    "corner-in-slot-front": { name: "Róg w slocie, biały do Ciebie", recognise: "Róg jest w swoim slocie skręcony w drugą stronę (biały wskazuje na Ciebie); krawędź jest na górze po prawej, zielonym do góry.", hold: "Slot z przodu po prawej.", note: "`R U' R'` wyciąga róg, który ląduje obok krawędzi jako **dopasowana para**; `U R U' R'` ją wstawia." },
    "edge-in-slot": { name: "Krawędź w slocie, róg na górze", recognise: "Krawędź jest już w slocie (nawet właściwą stroną); róg jest nad slotem z białym do Ciebie.", hold: "Slot z przodu po prawej.", note: "`U' R U' R'` wyciąga krawędź, która łączy się z rogiem jako **dopasowana para**; `U2 R U' R'` to insert dopasowany z dodatkowym `U` do wyrównania." },
    "both-in-slot": { name: "Oba w slocie, róg skręcony", recognise: "Para jest w swoim slocie, ale biała naklejka rogu wskazuje w prawo.", hold: "Slot z przodu po prawej.", note: "Trzy części: `R U' R'` wyjmuje parę, `U R U2 R'` łączy oba klocki, `U R U' R'` to **insert dopasowany**." },
    "apart-white-front": { name: "Róg z białym do Ciebie, krawędź z tyłu", recognise: "Róg jest nad swoim slotem z białym do Ciebie; krawędź jest z tyłu górnej warstwy, zielonym do góry.", hold: "Slot z przodu po prawej.", note: "`U' R U R'` łączy je w **dopasowaną parę** (róg zanurza się w slot, gdy krawędź przesuwa się obok); potem `U2 R U' R'` — insert dopasowany plus `U` do wyrównania." },
    "apart-white-right": { name: "Róg z białym w prawo, krawędź po lewej", recognise: "Róg jest nad swoim slotem z białym w prawo; krawędź jest po lewej stronie górnej warstwy, zielonym do góry.", hold: "Slot z przodu po prawej.", note: "`U' R U R'` je łączy; `U R U R'` to `U` do wyrównania, a potem **insert rozdzielony**." },
    "joined-wrong": { name: "Połączone, ale kolory się nie zgadzają", recognise: "Róg i krawędź są obok siebie z przodu po prawej, ale biały róg patrzy w prawo, a kolory się nie zgadzają.", hold: "Slot z przodu po prawej.", note: "`U' R U' R'` rozdziela je i łączy poprawnie od nowa; `U R U R'` wyrównuje i robi **insert rozdzielony**." },
    "white-up-edge-right": { name: "Biały w górę, krawędź po prawej", recognise: "Róg jest nad swoim slotem z białym do góry; krawędź jest po prawej stronie górnej warstwy, zielonym do góry.", hold: "Slot z przodu po prawej.", note: "`R U2 R'` obraca róg tak, że biały patrzy w bok; `U' R U R'` wyrównuje i robi **insert rozdzielony**." },
    "white-up-edge-left": { name: "Biały w górę, krawędź po lewej", recognise: "Róg jest nad swoim slotem z białym do góry; krawędź jest po lewej stronie górnej warstwy, zielonym do góry.", hold: "Slot z przodu po prawej.", note: "`U2 R U R'` łączy oba klocki w **dopasowaną parę**; `U R U' R'` ją wstawia." },
  },
};

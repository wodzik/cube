import type { GuideText } from "../guideText";

export const ZETA_SLOTTING_PL: GuideText = {
  title: "Zeta Slotting",
  tagline: "Wstaw wszystkie krawędzie, zanim dotkniesz choćby jednego rogu — potem mały zestaw algorytmów F2L wkłada każdy róg wokół krawędzi, która już tam jest.",
  heroLabel: "Sexy move ×3 — róg wokół osadzonej krawędzi",
  intro: [
    "„Warstwa po warstwie” układa dwie pierwsze warstwy zaczynając od rogów: najpierw wszystkie cztery białe rogi, potem wszystkie cztery krawędzie środka. Zeta Slotting odwraca tę kolejność — **najpierw wszystkie krawędzie, potem wszystkie rogi** — używając dokładnie tego samego crossa i dokładnie tych samych ruchów wkładania krawędzi, które już znasz.",
    "Po co to robić? Gdy krawędź siedzi poprawnie w slocie, są tylko trzy sposoby, na jakie róg może wymagać wstawienia nad nią (a nie mniej więcej cztery jak przy kolejności zaczynającej od rogów), a te trzy algorytmy to dokładnie przypadki „Edge In Slot” z pełnego F2L — więc ta metoda jest Twoją pierwszą prawdziwą praktyką F2L, tyle że zastosowaną do każdego slotu, a nie tylko wtedy, gdy przypadkiem Ci się poszczęści.",
  ],
  sections: {
    cross: {
      title: "Zacznij od crossa",
      eyebrow: "Zanim zaczniesz",
      blocks: [
        { kind: "p", text: "Ułóż biały cross dokładnie jak w „Warstwie po warstwie” — nic się tu nie zmienia." },
        { kind: "guideLink", label: "Warstwa po warstwie · Krok 1", text: "Biały cross, jeśli potrzebujesz przypomnienia." },
        { kind: "callout", title: "Rogi czekają", text: ["Zostaw cztery białe rogi tam, gdzie zostawił je cross — górna warstwa, dolna warstwa, bez znaczenia. Nie dotkniesz żadnego z nich, dopóki wszystkie krawędzie nie będą na miejscu."] },
      ],
    },
    "insert-edges": {
      title: "Wkładanie krawędzi",
      eyebrow: "Krok 1",
      blocks: [
        { kind: "p", text: "Gdy żadne rogi jeszcze nie przeszkadzają, krawędź wchodzi bardzo krótkim ruchem. Znajdź niezółtą krawędź w górnej warstwie i obracaj `U`, aż znajdzie się nad przednią ścianą. Rogi są w demo zszarzone — po drodze się psują, a zajmiesz się nimi w następnym kroku." },
        { kind: "p", text: "**Proste inserty: górna naklejka pasuje do przedniego centrum.** Przednia naklejka krawędzi pasuje do centrum po prawej albo po lewej — to mówi, w którą stronę ją wysłać." },
        { kind: "cases" },
        { kind: "p", text: "**Krawędzie niezorientowane: przednia naklejka pasuje do przedniego centrum.** Teraz górna naklejka ma kolor boczny, więc krawędź jest odwrócona dla prostych insertów — wstawiłyby ją odwróconą. Hedgeslammer z sekcji Triggery wkłada ją bezpośrednio, właściwą stroną." },
        { kind: "cases" },
        { kind: "callout", title: "Zorientowana czy nie?", text: ["Krawędź jest **zorientowana**, gdy jej górna naklejka ma ten sam kolor co przednie lub tylne centrum. Zorientowaną krawędź zawsze można wstawić samymi ruchami `L`, `U` i `R` — bez `F` ani `B`. **Niezorientowana** krawędź (górna naklejka pasuje do bocznego centrum) wymaga `F` lub `B`, co właśnie robi hedgeslammer."] },
        { kind: "callout", title: "Krawędź już w slocie, ale odwrócona", text: ["Wstaw dowolną inną niezółtą krawędź z górnej warstwy do tego slotu jednym z dwóch powyższych triggerów — wybija złą krawędź z powrotem na górę, tak samo jak w „Warstwie po warstwie”. Skoro nie ma tam jeszcze rogu, działa DOWOLNA zapasowa krawędź, nie tylko żółta."] },
        { kind: "practice", label: "Poćwicz oba inserty w Akademii" },
        { kind: "callout", title: "Punkt kontrolny — cross i cztery krawędzie", text: ["Wszystkie cztery krawędzie środkowej warstwy osadzone i poprawnie zorientowane. Każdy róg jest nadal tam, gdzie był — górna warstwa wygląda na nietkniętą i to dokładnie tak ma być."], demoLabel: "Krawędzie gotowe — rogi jeszcze przed nami" },
      ],
    },
    "insert-corners": {
      title: "Wkładanie rogów",
      eyebrow: "Krok 2",
      blocks: [
        { kind: "p", text: "Teraz slot po slocie. Znajdź biały róg, który należy do slotu z już osadzoną krawędzią, obróć górę, aż róg znajdzie się dokładnie nad tym slotem, i odczytaj, dokąd wskazuje jego biała naklejka." },
        { kind: "p", text: "Tylko jeden z trzech przypadków to powtórzony trigger — pozostałe dwa to naprawdę nowe algorytmy. Obserwuj krawędź w demo: każdy z nich zostawia ją dokładnie tam, gdzie była." },
        { kind: "cases" },
        { kind: "p", text: "**Wersje na lewą rękę.** Te same trzy przypadki dla slotu z przodu po lewej — lustrzane odbicie każdego algorytmu, więc pracuje lewa ręka. Ćwicz obie strony, żeby nigdy nie zmieniać chwytu, by dosięgnąć slotu." },
        { kind: "cases" },
        { kind: "practice", label: "Poćwicz trzy przypadki rogów w Akademii" },
        { kind: "callout", title: "Punkt kontrolny — dwie pierwsze warstwy", text: ["Ta sama meta co w „Warstwie po warstwie”: dwie pełne warstwy ułożone, każda ściana pokazuje dwa rzędy swojego koloru pod pomieszanym górnym rzędem."], demoLabel: "Dwie pierwsze warstwy gotowe" },
      ],
    },
    "last-layer": {
      title: "Ostatnia warstwa",
      eyebrow: "Krok 3",
      blocks: [
        { kind: "p", text: "Od tego miejsca identycznie jak w „Warstwie po warstwie” — ostatnia warstwa nie wie i nie dba o to, w jakiej kolejności zbudowałeś dwie pierwsze." },
        { kind: "guideLink", label: "Ostatnia warstwa, najpierw rogi", text: "Cztery etapy, z ćwiczeniem dla każdego." },
      ],
    },
    next: {
      title: "Co dalej",
      eyebrow: "Dalej",
      blocks: [
        { kind: "p", text: "Przećwiczyłeś już, sam tego nie zauważając, dwie z sześciu rodzin przypadków F2L „jeden klocek już w slocie” (dwa triggery wkładania krawędzi oraz te trzy algorytmy wkładania rogów). Pełne F2L uogólnia ten sam pomysł na pary, które jeszcze w ogóle nie są w slocie." },
        { kind: "guideLink", label: "F2L dla początkujących", text: "Układaj dwie pierwsze warstwy w parach — bez algorytmów do zapamiętania." },
      ],
    },
  },
  cases: {
    "edge-right": { name: "Idzie w prawo", recognise: "Krawędź jest nad przednią ścianą. Jej górna naklejka pasuje do przedniego centrum, a przednia naklejka pasuje do centrum po prawej.", hold: "Slot z przodu po prawej.", note: "Trzy ruchy: `R` odsuwa slot z drogi, `U'` przynosi krawędź, `R'` ją wkłada." },
    "edge-left": { name: "Idzie w lewo", recognise: "Krawędź jest nad przednią ścianą. Jej górna naklejka pasuje do przedniego centrum, a przednia naklejka pasuje do centrum po lewej.", hold: "Slot z przodu po lewej.", note: "Dokładne odbicie lustrzane „idzie w prawo”." },
    "edge-unoriented-right": { name: "Niezorientowana · w prawo", recognise: "Krawędź jest nad przednią ścianą. Jej przednia naklejka pasuje do przedniego centrum, a górna naklejka pasuje do centrum po prawej.", hold: "Slot z przodu po prawej.", note: "Hedgeslammer użyty bezpośrednio — bez wyrównywania `U` poza ustawieniem krawędzi nad przednią ścianą." },
    "edge-unoriented-left": { name: "Niezorientowana · w lewo", recognise: "Krawędź jest nad przednią ścianą. Jej przednia naklejka pasuje do przedniego centrum, a górna naklejka pasuje do centrum po lewej.", hold: "Slot z przodu po lewej.", note: "Lewy hedgeslammer." },
    up: { name: "Biały w górę", recognise: "Róg jest nad swoim slotem, biała naklejka na górze.", hold: "Slot z przodu po prawej.", note: "Sexy move, trzy razy — dokładnie ten sam algorytm co dla rogu pierwszej warstwy z białym w górę w „Warstwie po warstwie”. F2L 32." },
    front: { name: "Biały do przodu", recognise: "Róg jest nad swoim slotem, biała naklejka wskazuje na Ciebie.", hold: "Slot z przodu po prawej.", note: "F2L 33 — nie jest powtórzonym triggerem, warto ćwiczyć osobno." },
    right: { name: "Biały w prawo", recognise: "Róg jest nad swoim slotem, biała naklejka wskazuje w prawo.", hold: "Slot z przodu po prawej.", note: "F2L 34 — lustrzanie ukształtowane rodzeństwo „białego do przodu”." },
    "left-up": { name: "Biały w górę · lewy slot", recognise: "Róg jest nad slotem z przodu po lewej, biała naklejka na górze.", hold: "Slot z przodu po lewej.", note: "Lewy sexy move, trzy razy — lustro przypadku powyżej i rogu pierwszej warstwy na lewą rękę." },
    "left-front": { name: "Biały do przodu · lewy slot", recognise: "Róg jest nad slotem z przodu po lewej, biała naklejka wskazuje na Ciebie.", hold: "Slot z przodu po lewej.", note: "Lustro „białego do przodu”." },
    "left-left": { name: "Biały w lewo · lewy slot", recognise: "Róg jest nad slotem z przodu po lewej, biała naklejka wskazuje w lewo.", hold: "Slot z przodu po lewej.", note: "Lustro „białego w prawo”." },
  },
};

import type { GuideText } from "../guideText";

export const LAST_LAYER_PL: GuideText = {
  title: "Ostatnia warstwa, najpierw rogi",
  tagline: "Cztery etapy — orientacja rogów, orientacja krawędzi, permutacja rogów, permutacja krawędzi — zbudowane z sexy move i dwóch klocków, A i B, które pracują podwójnie.",
  intro: [
    "Gdy dwie warstwy są gotowe, ostatnia warstwa układa się w dwóch fazach — najpierw zrób żółtą górę (**orientacja**), potem ustaw klocki na właściwych miejscach (**permutacja**) — a w każdej fazie robimy **najpierw rogi, potem krawędzie**. To cztery etapy (looki) patrzenia na kostkę, każdy z krótkim algorytmem.",
    "Algorytmów jest mniej, niż się wydaje. Trzy przypadki rogów to ten sam trigger powtórzony; dwa algorytmy permutacji to po prostu dwa klocki, A i B, połączone w dowolnej kolejności. Każda sekcja kończy się przyciskiem, który otwiera odpowiednie ćwiczenia w Akademii.",
  ],
  sections: {
    "four-looks": {
      title: "Cztery etapy",
      eyebrow: "Przegląd",
      blocks: [
        { kind: "list", items: ["**Orientacja rogów** — ustaw żółte naklejki wszystkich czterech rogów do góry.", "**Orientacja krawędzi** — ustaw do góry też żółte naklejki krawędzi; cała góra jest żółta.", "**Permutacja rogów** — przesuń rogi na ich właściwe miejsca.", "**Permutacja krawędzi** — przesuń krawędzie na miejsce; ułożone."] },
        { kind: "p", text: "Sztuczka tej metody: etap 1 uczy Cię dwóch klocków, **A** i **B**. Etap 3 nie potrzebuje niczego nowego — jego dwa algorytmy to dosłownie A, a po nim B, oraz B, a po nim A." },
        { kind: "callout", title: "Światła", text: ["Dwa sąsiednie rogi, których żółte naklejki wskazują na **tę samą** stronę, wyglądają jak para świateł samochodu. Kilka przypadków rozpoznaje się po tym, gdzie są światła — a „trzymaj światła po lewej” oznacza obrócenie całej kostki (nie tylko góry) tak, żeby ta strona była po Twojej lewej."] },
      ],
    },
    "orient-corners": {
      title: "Orientacja rogów",
      eyebrow: "Etap 1",
      blocks: [
        { kind: "p", text: "Na razie zupełnie zignoruj krawędzie — demo je ukrywają. Patrz tylko na cztery rogi górnej warstwy i policz, ile z nich ma już żółty na górze, potem znajdź przypadek poniżej; każdy mówi, jak trzymać kostkę." },
        { kind: "p", text: "Trzy przypadki to ten sam pomysł: `F`, potem sexy move raz, dwa lub trzy razy, potem `F'`. Dwa to klocki **A** (sexy move + sledgehammer) i **B** — te, których używa etap 3, więc naucz się ich na blachę. Ostatnie dwa to dobrze znane Sune i Antisune." },
        { kind: "cases" },
        { kind: "practice", label: "Poćwicz te siedem w Akademii" },
        { kind: "callout", title: "Punkt kontrolny — rogi zorientowane", text: ["Wszystkie cztery rogi pokazują żółty na górze. Krawędzie mogą być dowolne — celowo ich nie ruszaliśmy."], demoLabel: "Cztery żółte rogi" },
      ],
    },
    "orient-edges": {
      title: "Orientacja krawędzi",
      eyebrow: "Etap 2",
      blocks: [
        { kind: "p", text: "Teraz krawędzie. Gdy rogi są gotowe, zero, dwie albo wszystkie cztery górne krawędzie mają jeszcze żółtą naklejkę z boku. Oba przypadki z dwiema krawędziami mają po jednym algorytmie; zawierają obrót szeroki `r` i warstwę środkową `M` — zajrzyj do „Pierwszych kroków”, jeśli są dla Ciebie nowe." },
        { kind: "cases" },
        { kind: "practice", label: "Poćwicz przypadki krawędzi w Akademii" },
        { kind: "callout", title: "Punkt kontrolny — żółta góra", text: ["Cała górna ściana jest żółta. Boki górnej warstwy są jeszcze pomieszane — to kolejne dwa etapy."], demoLabel: "Górna ściana gotowa" },
      ],
    },
    "permute-corners": {
      title: "Permutacja rogów",
      eyebrow: "Etap 3",
      blocks: [
        { kind: "p", text: "Góra jest żółta; teraz rogi muszą trafić na właściwe miejsca. Róg jest **poprawny**, gdy jego dwie boczne naklejki pasują do dwóch centrów obok. Obracaj górną warstwę (tylko `U`) i szukaj poprawnych rogów — znajdziesz albo dwa sąsiednie, albo dwa po przekątnej, albo wszystkie cztery." },
        { kind: "p", text: "Dwa sąsiednie rogi, które są poprawne, pokazują ten sam kolor na wspólnym boku: znów **światła**. To najszybszy sposób, żeby je zauważyć." },
        { kind: "cases" },
        { kind: "callout", text: ["Nie możesz znaleźć żadnych poprawnych rogów? Obracaj górę dalej — jedna z czterech pozycji zawsze ma co najmniej dwa. Wszystkie cztery poprawne: przejdź do etapu 4."] },
        { kind: "practice", label: "Poćwicz A + B i B + A w Akademii" },
        { kind: "callout", title: "Punkt kontrolny — rogi na miejscu", text: ["Obracaj górę, aż każdy róg będzie pasował do centrów. Wszystkie cztery rogi są teraz ułożone; zostały tylko cztery górne krawędzie."], demoLabel: "Rogi ułożone" },
      ],
    },
    "permute-edges": {
      title: "Permutacja krawędzi",
      eyebrow: "Etap 4",
      blocks: [
        { kind: "p", text: "Ostatni etap. Gdy rogi są na miejscu, policz, ile górnych krawędzi już pasuje do swoich centrów. Albo jedna (pozostałe trzy krążą w cyklu), albo żadna (dwie pary się zamieniają)." },
        { kind: "cases" },
        { kind: "practice", label: "Poćwicz permutacje krawędzi w Akademii" },
        { kind: "callout", title: "Ułożone!", text: ["Obróć górę, żeby wszystko się wyrównało. To cała kostka."], demoLabel: "Gotowe" },
      ],
    },
    next: {
      title: "Co dalej",
      eyebrow: "Dalej",
      blocks: [
        { kind: "p", text: "Ułóż ją jeszcze dziesięć razy. Dwie pierwsze warstwy przyspieszą same; ostatnia warstwa przyspiesza, gdy ćwiczysz algorytmy, aż ręce wykonują je bez zastanowienia." },
        { kind: "list", items: ["**Mierz swój czas** w zakładce Układanie — z kostką Bluetooth wykrywa ułożenie automatycznie.", "**Ćwicz ostatnią warstwę** w Akademii: każdy etap powyżej ma własny tryb ćwiczeń.", "**Naucz się F2L**, żeby układać dwie pierwsze warstwy w parach — największe pojedyncze przyspieszenie po tej metodzie."] },
        { kind: "guideLink", label: "F2L dla początkujących", text: "Układaj dwie pierwsze warstwy w parach — bez algorytmów do zapamiętania." },
      ],
    },
  },
  cases: {
    "co-headlights": { name: "Dwa gotowe · światła", recognise: "Dwa rogi mają żółty na górze. Pozostałe dwa są obok siebie, a ich żółte naklejki wskazują na tę samą stronę.", hold: "Światła po lewej.", note: "Jeden sexy move w środku F … F'." },
    "co-pi": { name: "Żadnego gotowego · jedna para świateł", recognise: "Żaden róg nie ma żółtego na górze. Z jednej strony widać światła; pozostałe dwie żółte naklejki wskazują przód i tył.", hold: "Światła po lewej.", note: "Dwa sexy move w środku F … F'." },
    "co-h": { name: "Żadnego gotowego · dwie pary świateł", recognise: "Żaden róg nie ma żółtego na górze. Światła z przodu i z tyłu; nic po lewej ani po prawej.", hold: "Światła do Ciebie i od Ciebie.", note: "Trzy sexy move w środku F … F'." },
    "co-a": { name: "Dwa gotowe · w przeciwne strony", recognise: "Dwa rogi mają żółty na górze. Pozostałe dwa są obok siebie, ale jedna żółta naklejka wskazuje na Ciebie, a druga od Ciebie.", hold: "Te dwa rogi po lewej, ten wskazujący na Ciebie z przodu.", note: "Algorytm A — sexy move, a po nim sledgehammer. Zapamiętaj go: użyjesz go jeszcze później." },
    "co-b": { name: "Dwa gotowe · po przekątnej", recognise: "Dwa rogi mają żółty na górze i są po przekątnej względem siebie.", hold: "Skręcony róg z przodu po lewej z żółtym skierowanym do Ciebie; drugi skręcony róg jest wtedy z tyłu po prawej z żółtym skierowanym w prawo.", note: "Algorytm B. Zapamiętaj go też: użyjesz go jeszcze później." },
    "co-sune": { name: "Jeden gotowy · Sune", recognise: "Jeden róg ma żółty na górze, a żółta naklejka rogu z przodu po prawej patrzy na Ciebie, gdy gotowy róg jest z przodu po lewej.", hold: "Gotowy róg z przodu po lewej, róg z przodu po prawej pokazuje żółty do przodu." },
    "co-antisune": { name: "Jeden gotowy · Antisune", recognise: "Jeden róg ma żółty na górze, a żółta naklejka rogu z przodu po prawej patrzy w prawo, gdy gotowy róg jest z tyłu po prawej.", hold: "Gotowy róg z tyłu po prawej, róg z przodu po prawej pokazuje żółty w prawo.", note: "Jeśli widzisz tylko jeden gotowy róg, ale żółty z przodu po prawej patrzy w drugą stronę, trzymasz kostkę pod Sune — obróć kostkę o ćwierć obrotu i sprawdź jeszcze raz." },
    "eo-adjacent": { name: "Dwie odwrócone, obok siebie", recognise: "Dwie sąsiednie krawędzie pokazują żółty z boku.", hold: "Odwrócone krawędzie z przodu i po prawej.", note: "OLL 28." },
    "eo-opposite": { name: "Dwie odwrócone, naprzeciw siebie", recognise: "Dwie przeciwległe krawędzie pokazują żółty z boku.", hold: "Odwrócone krawędzie z przodu i z tyłu.", note: "OLL 57." },
    "eo-all": { name: "Wszystkie cztery odwrócone", recognise: "Żadna krawędź nie ma żółtego na górze.", hold: "Dowolnie.", note: "OLL 20 — albo wykonaj algorytm dla sąsiednich z dowolnego kąta, a potem dokończ tym przypadkiem, który zostanie." },
    "cp-adjacent": { name: "Dwa poprawne, obok siebie", recognise: "Z jednej strony widać światła; pozostałe dwa rogi trzeba zamienić.", hold: "Światła po lewej.", note: "A, potem B. Zamienia dwa rogi po prawej. (Speedcuberzy znają to jako permutację T.)" },
    "cp-diagonal": { name: "Dwa poprawne, po przekątnej", recognise: "Żadnych świateł z żadnej strony; dwa błędne rogi są po przekątnej.", hold: "Poprawne rogi z przodu po lewej i z tyłu po prawej.", note: "B, potem A. Zamienia rogi z przodu po prawej i z tyłu po lewej. (Permutacja Y.)" },
    "ep-ua": { name: "Jedna poprawna · przednia krawędź idzie w prawo", recognise: "Jedna krawędź pasuje; z pozostałych trzech ta z przodu należy w prawo.", hold: "Poprawna krawędź z tyłu.", note: "Permutacja Ua." },
    "ep-ub": { name: "Jedna poprawna · przednia krawędź idzie w lewo", recognise: "Jedna krawędź pasuje; ta z przodu należy w lewo.", hold: "Poprawna krawędź z tyłu.", note: "Permutacja Ub." },
    "ep-h": { name: "Żadna poprawna · zamiany przeciwległych", recognise: "Przód i tył trzeba zamienić, a lewą i prawą też trzeba zamienić.", hold: "Dowolnie.", note: "Permutacja H." },
    "ep-z": { name: "Żadna poprawna · zamiany sąsiadów", recognise: "Dwie pary sąsiednich krawędzi trzeba zamienić.", hold: "Tak, żeby zamianami były przód↔lewa i tył↔prawa.", note: "Permutacja Z. Nie wiesz, jak ją trzymać? Wykonaj ją raz, a potem to przypadek Ua/Ub." },
  },
};

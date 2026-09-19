import type { GuideText } from "../guideText";

export const GETTING_STARTED_PL: GuideText = {
  title: "Pierwsze kroki",
  tagline: "Klocki kostki, jak ją trzymać, jak zapisuje się ruchy i czteroruchowe triggery, z których zbudowany jest każdy algorytm w tej aplikacji.",
  heroLabel: "R U R' U' — sexy move",
  intro: [
    "Dziesięć minut tutaj oszczędza godzinę później. Ten poradnik opisuje, czym naprawdę jest kostka (ma mniej ruchomych części, niż się wydaje), jedyny sposób trzymania jej, który zakładają wszystkie pozostałe poradniki, oraz malutki alfabet, którym zapisuje się algorytmy.",
    "Nie musisz uczyć się notacji na pamięć od razu — wracaj tu, ilekroć poradnik użyje symbolu, którego jeszcze nie znasz.",
  ],
  sections: {
    "before-you-start": {
      title: "Zanim zaczniesz",
      eyebrow: "Podstawy",
      blocks: [
        { kind: "p", text: "Kostka 3×3 ma trzy rodzaje klocków i nigdy nie zmieniają one typu: **centra** (6, jeden kolor — nie ruszają się względem siebie, więc centrum określa kolor danej ściany), **krawędzie** (12, dwa kolory) i **rogi** (8, trzy kolory). Naklejka nigdy nie opuszcza swojego klocka: żeby przenieść parę naklejek zielono-białą, przenosisz całą zielono-białą krawędź." },
        { kind: "callout", title: "Centra decydują o wszystkim", text: ["Biały jest zawsze naprzeciw żółtego, zielony naprzeciw niebieskiego, czerwony naprzeciw pomarańczowego. Kiedy poradnik mówi „zielona ściana”, ma na myśli ścianę, której centrum jest zielone — gdziekolwiek ona aktualnie jest."] },
        { kind: "p", text: "Układanie nigdy więc nie dotyczy naklejek — chodzi o to, żeby umieścić 20 klocków (12 krawędzi + 8 rogów) między właściwymi centrami, właściwą stroną. Każdy krok w poradnikach robi to dla kilku klocków naraz, nie psując tych już ustawionych." },
      ],
    },
    holding: {
      title: "Trzymanie kostki",
      eyebrow: "Podstawy",
      blocks: [
        { kind: "p", text: "Trzymaj kostkę opuszkami palców, nie dłońmi. Kciuki i palce wskazujące wykonują prawie wszystkie obroty; pozostałe palce tylko pilnują, żeby kostka nie wypadła. Luźne palce kręcą szybciej niż mocny chwyt." },
        { kind: "p", text: "Wybierz jedną orientację i trzymaj się jej podczas nauki. Poradniki układania zawsze zakładają tę samą: **biały cross na dole, żółty na górze, zielony do Ciebie.** Każda litera ruchu poniżej odnosi się do tego, jak trzymasz kostkę w tej chwili, a nie do koloru." },
        { kind: "callout", text: ["Podczas układania będziesz ciągle zmieniać chwyt — to normalne. Celem nie jest trzymanie kostki idealnie nieruchomo, tylko utrzymanie palców na tyle swobodnych, żeby kręcić szybko."] },
      ],
    },
    faces: {
      title: "Sześć obrotów ścian",
      eyebrow: "Notacja",
      blocks: [
        { kind: "p", text: "Każda ściana ma swoją literę: `U` (Up, góra), `D` (Down, dół), `L` (Left, lewa), `R` (Right, prawa), `F` (Front, przód), `B` (Back, tył). Sama litera oznacza: obróć tę ścianę o ćwierć obrotu (90°) **zgodnie z ruchem wskazówek zegara, patrząc prosto na tę ścianę.**" },
        { kind: "demoGrid" },
        { kind: "callout", title: "Zgodnie z zegarem — patrząc skąd?", text: ["„Zgodnie z zegarem” ocenia się, patrząc na ścianę, którą obracasz. Z Twojego punktu widzenia `R` i `L` idą więc w przeciwne strony: `R` obraca prawą ścianę od Ciebie (w górę z przodu), a `L` obraca lewą ścianę do Ciebie. Zobacz `L` i `R` powyżej obok siebie."] },
      ],
    },
    prime: {
      title: "Obroty z prim ( ' )",
      eyebrow: "Notacja",
      blocks: [
        { kind: "p", text: "Litera z apostrofem — `R'`, czytane „R prim” — oznacza tę samą ścianę, ćwierć obrotu **przeciwnie do ruchu wskazówek zegara**. To dokładne cofnięcie zwykłej litery: `R`, a potem `R'` zostawia kostkę bez zmian." },
        { kind: "demoGrid" },
      ],
    },
    double: {
      title: "Obroty podwójne (2)",
      eyebrow: "Notacja",
      blocks: [
        { kind: "p", text: "Litera z cyfrą 2 — `R2` — oznacza pół obrotu (180°). Zgodnie z zegarem czy przeciwnie kończy się w tym samym miejscu, więc nie ma osobnego „R2 prim”." },
        { kind: "p", text: "To cały alfabet metody dla początkujących: zwykła litera, prim albo 2, dla każdej z sześciu ścian." },
        { kind: "demoGrid" },
      ],
    },
    slices: {
      title: "Obroty warstw środkowych — M, E, S",
      eyebrow: "Ponad podstawy",
      blocks: [
        { kind: "p", text: "Trzy kolejne litery obracają **warstwę środkową** między dwiema przeciwległymi ścianami. `M` leży między L a R i podąża za kierunkiem L; `E` leży między U a D i podąża za D; `S` leży między F a B i podąża za F. Przyjmują ' i 2 jak każdy inny ruch." },
        { kind: "p", text: "Spotkasz `M` w algorytmach krawędzi ostatniej warstwy (OLL 28, OLL 57, permutacje H i Z)." },
        { kind: "demoGrid" },
      ],
    },
    wide: {
      title: "Obroty szerokie — r, l, u, d, f, b",
      eyebrow: "Ponad podstawy",
      blocks: [
        { kind: "p", text: "Mała litera obraca **dwie warstwy naraz**: ścianę i sąsiadującą z nią warstwę środkową. `r` to R plus warstwa środkowa, w kierunku R — to samo co `R M'`. Obroty szerokie sprawiają, że algorytmy krawędzi OLL 28 / OLL 57 wykonuje się wygodnie." },
        { kind: "p", text: "Zobaczysz też obroty szerokie zapisane z **w** po wielkiej literze: `Rw`, `Lw`, `Uw`, `Dw`, `Fw`, `Bw` („right wide”, „left wide” i tak dalej). To tylko inny zapis — `Rw` to dokładnie `r`, a `Rw'` to `r'`. Ta aplikacja używa małych liter." },
        { kind: "demoGrid" },
      ],
    },
    rotations: {
      title: "Obracanie całej kostki — x, y, z",
      eyebrow: "Ponad podstawy",
      blocks: [
        { kind: "p", text: "`x`, `y` i `z` obracają **całą kostkę** w dłoniach: nic nie rusza się względem niczego innego, zmienia się tylko Twój punkt widzenia. `x` obraca jak `R` (wokół osi lewo–prawo), `y` jak `U` (wokół osi góra–dół), `z` jak `F` (wokół osi przód–tył)." },
        { kind: "p", text: "Algorytmy używają ich, kiedy łatwiej jest obrócić kostkę, niż dalej używać niewygodnych liter ścian. W poradnikach układania w tej aplikacji zobaczysz głównie `y` — „obróć kostkę tak, żeby następny slot był przed Tobą”." },
        { kind: "demoGrid" },
      ],
    },
    triggers: {
      title: "Triggery",
      eyebrow: "Klocki",
      blocks: [
        { kind: "p", text: "Trigger to krótka kombinacja ruchów, której ręce uczą się jako jednej całości. Większość algorytmów to po prostu kilka triggerów sklejonych razem — kiedy je znasz, 10-ruchowy algorytm czyta się jako „sexy move, sledgehammer” zamiast dziesięciu osobnych liter." },
        { kind: "p", text: "Każdy trigger poniżej przywraca kostkę dokładnie do stanu początkowego, jeśli wykonasz go 6 razy z rzędu — zobacz, jak demo odtwarza wszystkie sześć. To czyni je idealnymi do ćwiczeń: powtórz jeden sześć razy, a kostka wraca do tego samego stanu, gotowa na następną rundę. Kliknij **Spróbuj** i podłącz swoją kostkę Bluetooth, żeby to poćwiczyć." },
        { kind: "cases" },
        { kind: "guideLink", label: "Dalej: Warstwa po warstwie", text: "Cross, rogi pierwszej warstwy i krawędzie drugiej warstwy." },
      ],
    },
  },
  cases: {
    sexy: { name: "Sexy move", recognise: "Najczęstsze cztery ruchy w speedcubingu — siedzą w dziesiątkach algorytmów. Cała ostatnia warstwa dla początkujących w tej aplikacji jest z nich zbudowana.", note: "Prawa ręka: palec wskazujący pstryka U i U', kciuk i pozostałe palce robią R i R'." },
    "left-sexy": { name: "Lewy sexy move", recognise: "Ten sam trigger odbity na lewą rękę, gdy potrzebny klocek jest po tej stronie. Warto ćwiczyć go lewą ręką, żeby nigdy nie zmieniać chwytu tylko po to, by sięgnąć do triggera po prawej stronie." },
    "reverse-sexy": { name: "Odwrócony sexy move", recognise: "Te same dwie ściany co w sexy move, ale z odwróconymi obrotami U — to osobny trigger, a nie sexy move zagrany od tyłu. Wkłada dopasowaną parę F2L i jest jednoruchowym rozwiązaniem dla rogu pierwszej warstwy z białym skierowanym do przodu." },
    "left-reverse-sexy": { name: "Lewy odwrócony sexy move", recognise: "Lustro odwróconego sexy move — wkłada parę po lewej." },
    sledge: { name: "Sledgehammer", recognise: "Bliski kuzyn sexy move na ścianach R i F. Sexy move, a po nim sledgehammer to kombinacja, którą jeszcze spotkasz w ostatniej warstwie." },
    "left-sledge": { name: "Lewy sledgehammer", recognise: "Sledgehammer na lewą rękę." },
    hedge: { name: "Hedgeslammer", recognise: "Sledgehammer od tyłu — te same cztery ruchy, w odwrotnej kolejności." },
    "left-hedge": { name: "Lewy hedgeslammer", recognise: "Hedgeslammer na lewą rękę." },
  },
};

# Opstart: visuel oprydning af "Overblik: hvem ligger hvor?" og siden omkring

Kun visning. Ingen beregninger, data, rettigheder eller grupperinger ændres.

## Hvad en designer ville se på skærmbilledet

1. **Diagrammet er lille i et stort kort.** Det fylder ca. halvdelen af kortet, og teksterne (akser, hold-mærker, labels) er 9–10 px og svære at læse.
2. **Der er ingen klar hovedbesked.** Øjet ved ikke, hvor det skal starte. Det røde område og de røde prikker drukner i det grå bånd.
3. **Prikker uden for rammen.** De grønne prikker over 1,5x står uden for det tegnede felt, og skalaen er ikke skrevet tydeligt (1,5 / 1 / 0,5 / 0).
4. **Navne støder sammen.** "Caspar P." og "Anton T." ligger oven i hinanden, og "Hold · dag 39 (6" bliver klippet i højre kant.
5. **Teksten på x-aksen kolliderer.** "Arbejdsdag" ligger oven i hold-mærkerne.
6. **Signaturforklaringen er rodet.** Den fylder tre linjer med lille tekst og gentager det, kasserne til højre allerede siger.
7. **Kasserne til højre konkurrerer med diagrammet.** Den fuldt røde kasse er det mest dominerende på hele siden, mere end selve sælgerne.
8. **Fejl i toppen af siden:** knappen "Diskret visning" ligger oven i undertitlen, og tallene i filterknapperne ("Alle nye · 27") brydes ned på en ny linje. Det samme sker for "Sorteret efter … nu" og mærket "Skal ikke have feedback" på sælgerkortet.

## Forbedringer

**A. Ret fejlene først (hurtig gevinst)**
- Header: titel og mærker på én linje, "Diskret visning" flyttes til højre side af headeren. Undertitlen får sin egen linje uden noget oven i den.
- Filterknapper: tal og tekst på én linje ("Ekstra støtte 14"), og tallet vises som en lille badge.
- Teksten i afsnitsoverskrifter og mærker må ikke brydes midt i ord eller efterlade ét ord alene på en linje.

**B. Diagrammet**
- Diagrammet fylder hele kortbredden til venstre. Kasserne bliver en smal kolonne (ca. 280 px).
- Rammen rummer alle prikker. Skalaen går fra 0 til den højeste værdi og er rundet op. Tydelige værdier står på y-aksen: "0", "0,5x", "Normal", "1,5x", "2x+".
- Rolig baggrund: hvid flade, svagt gråt bånd for typisk spænd og kun en meget lys rød tone i "Start her"-zonen. Det røde forbeholdes prikkerne, så de springer i øjnene.
- Navne til røde prikker placeres i en kolonne med tynde streger ud til prikkerne, så de aldrig overlapper. Navnene står med 12 px tekst.
- Hold-mærkerne står som små piller under aksen ("Dag 9 · 11 nye") og må ikke klippes i kanten. "Arbejdsdag" flyttes under pillerne.
- Hover/fokus viser et rigtigt lille kort med navn, dag, niveau og trend i stedet for browserens standard-tooltip.

**C. Kasserne "Hvor starter du?"**
- Kasserne gøres lyse med en farvet venstrekant og et stort tal, i stedet for fuld farvefyld. Den valgte kasse får fyld, så man kan se, at filteret er slået til.
- Kasserne erstatter signaturforklaringen. Hver kasse viser sit eget prik-symbol (fyldt, ring eller lys med kant). Den separate forklaring under diagrammet bliver én kort linje: "Normal-streg", "Typisk spænd" og "Over 2x vises øverst".

**D. Rytme på siden**
- Fast afstand mellem sektionerne (24 px) og ens hjørner og skygger på alle kort.
- KPI-kortene placeres direkte under overblikket i samme bredde, så de flugter.
- Overskrifterne får samme typografi overalt: små versaler til etiketter og fed tekst til titler.

## Afgrænsning
- Kun visning i Opstart-siden og overbliksdiagrammet.
- Farvelogikken (rød, gul og grøn) og grupperne er uændrede.
- Diskret visning og mobilvisning bevares.

## Tekniske detaljer
- Filer: `src/pages/onboarding/RampOverviewMatrix.tsx` (diagram, labels, kasser, forklaring) og `src/pages/onboarding/RampTeam.tsx` (header, filterknapper, afstande, mærker på kortet).
- Labels lægges i en kolonne med forbindelsesstreger (simpel lodret fordeling med en minimumsafstand).
- y-max = afrundet op fra den højeste værdi, maks. 2x. Prikker inden for en indre margin.
- Eget tooltip med `role="tooltip"`, også ved tastaturfokus.
- Kontrol: skærmbilleder med Playwright i 1280 px og 390 px bredde, med og uden Diskret visning.

# Indeks-afrunding og synligt indeks pr. sælger

Farverne på tavlen er korrekte i dag — ingen sælgere ligger i det gule bånd (indeks 95-104). Mathias Victor Andersen er tættest med indeks 84,6, hvilket er 0,4 point under orange-grænsen på 85. To justeringer gør tavlen mere gennemskuelig.

## 1. Afrund indeks før status

I dag sammenlignes det rå decimaltal (84,6) med tærsklerne, mens tallet vises afrundet (85%). Det giver en tavle der viser "85%" i rød. Statusberegningen skal bruge samme afrundede heltal som vises.

`src/lib/boardProgress.ts`
- `indeks` beregnes uændret (decimaltal, bruges til visning/afrunding).
- Status udledes af `Math.round(indeks)` i stedet for det rå tal.
- Effekt: Mathias Victor rykker fra rød til orange. Ingen andre skifter farve.
- Test tilføjes i `src/lib/boardProgress.test.ts` for grænsetilfældet 84,6 -> orange.

## 2. Vis indeks på sælgerrækkerne

I dag vises "opnået i procent" (fx 8%) ved sælgerne, mens baren farves efter indeks. To forskellige tal, og farven kan ikke verificeres af den der ser tavlen.

`src/pages/dashboards/TdcMonthlyGoalBoard.tsx`
- Efter `10 / 130` vises indekset i statusfarven, fx `indeks 85`, i stedet for de nuværende `8%`.
- Sælgere uden mål (mål 0) er uændrede — ingen bar, intet indeks.
- Ingen ændring i layout, kolonner eller fælles mål-boksen.

Hvis du vil beholde "% opnået" og have indekset som ekstra tal, siger du til — så vises begge.

## Zone

Grøn zone: kun board-beregning og præsentation. Ingen ændringer i hooks, data, pricing eller lønlogik.

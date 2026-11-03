# Aftalt pris skal med i Økonomi (Rosengårdcentret uge 42)

## Fund
- Bookingen (Eesy FM, 12.–16/10, 5 dage) har aftalt pris 14.375 kr. Den er gemt som samlet pris for bookingen. Der er ingen dagspris på bookingen, placeringen eller lokationen.
- Økonomi-fanen (`LocationProfitabilityContent.tsx`) beregner lokationsomkostningen som dagspris × dage. Der er ingen dagspris, så resultatet bliver 0 kr. Det gælder også DB og dag-for-dag-visningen.
- Siden henter faktisk den rigtige pris via den fælles beregning `bookingGross`, som bruger den samlede pris. Men den bruges kun til netto/brutto-teksten og ikke til selve omkostningen og DB.
- Kunde-DB'en under Fieldmarketing (`useClientDbData.ts`) bruger samme dagspris-logik og læser slet ikke den samlede pris. Her bliver lokationsomkostningen derfor også 0 kr.

## Rettelse (kun visning og beregning i klienten, ingen data ændres)
1. Økonomi-fanen: lokationsomkostningen og DB tager beløbet fra `bookingGross`. Ved aftalt pris bliver det 14.375 kr. Dagsprisen, der vises, og dag-for-dag-tallene bliver samlet pris ÷ bookede dage, her 2.875 kr./dag. Bookinger med almindelig dagspris giver præcis samme tal som i dag.
2. Kunde-DB: henter også `total_price` og bruger `bookingGross`, så aftalte priser fordeles på de bookede dage.
3. Prøve i `src/utils/bookingGross.test.ts`: samlet pris 14.375 kr. på 5 dage giver 14.375 kr. i alt og 2.875 kr./dag. Negativ prøve: ingen samlet pris giver dagspris × dage.

## Påvirker
Kun visning af omkostning og DB på Økonomi og kunde-DB. Ingen løn, provision, faktura eller bookingdata ændres. Andre bookinger med aftalt pris vil også få den korrekte omkostning i stedet for 0 kr.

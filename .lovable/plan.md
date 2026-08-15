# TDC Erhverv – ret salg: antal og produktnavn i separate kolonner

## Mål
Antal og produktnavn skal stå i hver sin kolonne, som på det vedhæftede eksempel.

## Sådan gøres det
- Kolonnerne bliver: OPP nr. · Sælgernavn · Antal · Produktnavn · Handlinger.
- "Antal" er en smal, højrestillet kolonne med grøn, fremhævet værdi (`text-primary`-token, ingen hardkodet farve).
- Produktnavn står i egen kolonne, én linje pr. produkt, lodret som i dag.
- Antal og produktnavn holdes linje-for-linje synkroniseret, så række 1 i antal matcher række 1 i produktnavn (samme `flex flex-col gap-1`-struktur i begge celler).
- OPP nr., sælgernavn og Rediger/Slet forbliver top-justeret på gruppens række; linjeadskillelse mellem OPP-numre bevares.

## Teknisk
Kun `src/pages/reports/TdcErhvervEditSales.tsx` (præsentation). Ingen ændringer i `useTdcErhvervSales.ts`, data eller slette-flow.

# TDC Erhverv – ret salg: produkter vertikalt

## Mål
Produkterne under hvert OPP skal stå lodret (én produktlinje pr. række) i stedet for som en kommasepareret tekst på én linje.

## Sådan gøres det
- Grupperingen ændres ikke: salg samles fortsat pr. OPP-nummer, sekundært pr. sælger (samme OPP slået ud af to sælgere samme dag giver stadig to grupper).
- I produktkolonnen erstattes `products.map(...).join(", ")` med en lodret liste (`flex flex-col`), hvor hvert produkt vises som `Navn x antal` på sin egen linje.
- OPP-nr., sælgernavn og Rediger/Slet forbliver på gruppens egen række, top-justeret så de flugter med første produktlinje.
- Linjeadskillelsen mellem forskellige OPP-numre bevares (tabellens rækkeborder pr. gruppe, ingen border mellem produktlinjer).

## Teknisk
Kun `src/pages/reports/TdcErhvervEditSales.tsx` ændres (præsentation). Ingen ændringer i `useTdcErhvervSales.ts`, data eller sletteflow.

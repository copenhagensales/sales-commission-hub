# Fibertælleren på TDC Erhverv-boardet

## Resultat af kontrollen
- Pointene stemmer stadig: Fuldt salg = 1, Lukket salg = 0,5, Lead Provi = 0,5, for både HAP og VOK, med og uden Mobilevoice (12 produkter).
- Manuelt tastede salg bruger præcis de samme 12 produkter som boardet tæller. Hver valgmulighed (type, HAP/VOK, Mobilevoice) gemmes som det tilsvarende produkt med antal 1.
- Lukket salg giver 0,5 til lukkeren og 0,5 til leadgiveren, ligesom før. »(+N fiber)« på salgskortene tæller kun Fuldt og Lukket, ikke Lead.
- Salg, som en admin har afvist (fx lead-delen, når et salg rettes til Fuldt), tæller ikke med.
- Sælgerne kobles til deres navn via arbejdsmailen. Alle 33 aktive sælgere på TDC Erhverv og Relatel har en matchende kobling, så ingen kommer til at stå to gange.
- Boardet henter nye tal hvert 2. minut, så tastede salg dukker op af sig selv inden for få minutter.

Der skal altså ikke rettes noget.

## Forslag: en prøve, så det bliver ved med at stemme
Pointlisten står i dag to steder i koden (på siden og på serveren), og produktkoblingen står et tredje sted. Jeg tilføjer en lille automatisk prøve, der fejler, hvis:
- de to pointlister ikke længere er ens, eller
- et produkt, som fibersiden kan oprette, mangler i pointlisten eller har den forkerte værdi (Fuldt 1, Lukket 0,5, Lead 0,5).

Ingen ændringer i boardet, databasen, provision eller rettigheder.

## Teknisk
- Ny test ved siden af `src/config/fiberBoardPoints.ts`. Den læser `FIBER_BOARD_POINTS_EF` i `supabase/functions/tv-dashboard-data/index.ts` og `tdc_fiber_produkt` i `drizzle/migrations/0075_tdc_fiber_tastning.sql` som tekst og sammenligner.

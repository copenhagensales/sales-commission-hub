## Hvad
Genberig den eksisterende Excel (`relatel-loenperiode-15maj-14jun-2026-pr-saelger-med-cvr.xlsx`) — denne gang ved at hente CVR direkte fra Stork-databasen i stedet for cvrapi.dk. Resten af filen holdes 1:1.

## Hvor data ligger
- Tabel: `public.sales`
- Felt: `raw_payload->'masterDataFields'->>'Cvr nummer'` (CVR som tekst)
- Felt: `raw_payload->'masterDataFields'->>'Firmanavn'` (virksomhedsnavn)
- Match-nøgle: `sales.customer_phone` (samme felt vi allerede har i Excel-arket pr. sælger)
- Filter: kun Relatel-kilde (`source ILIKE '%relatel%'`) for at undgå støj fra andre integrationer

## Fremgangsmåde
1. Læs alle unikke `customer_phone` fra de 34 sælger-faner i den uploadede Excel.
2. Normalisér numre (strip mellemrum, `+45`, ledende nuller) på begge sider af matchet, så `+45 12345678` matcher `12345678` i Stork.
3. Én SQL-forespørgsel mod `sales` der returnerer pr. telefon: nyeste ikke-tomme CVR + Firmanavn (`ORDER BY sale_datetime DESC` så vi tager seneste registrering).
4. For numre uden hit i Stork: lad cellen være tom (ingen internet-fallback — brugeren har sagt det skal komme fra Stork).
5. Skriv ny fil til `/mnt/documents/relatel-loenperiode-15maj-14jun-2026-pr-saelger-med-cvr.xlsx` (overskriv).

## Forventet dækning
Sandsynligvis højere end de 33/34 fra cvrapi-opslaget, fordi Stork har CVR fra det faktiske salgsmoment (uafhængigt af om virksomhedens telefonnummer er offentligt registreret hos Erhvervsstyrelsen). Tomme felter vil typisk være privatkunder eller fejlregistreringer hvor `masterDataFields` ikke blev udfyldt i Adversus.

## Uden for scope
- Ingen ændringer i Stork-kode, DB-skema eller edge functions.
- Ingen ændring af eksisterende kolonner/faner i Excel-filen — kun `cvr` og `virksomhed` opdateres.
- Ingen fallback til cvrapi.dk.

Godkender du, kører jeg det.
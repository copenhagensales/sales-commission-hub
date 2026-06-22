## Hvad
Genberig Excel'en — denne gang ved at matche på **`internal_reference` (MG-…)** i stedet for telefonnummer. Hver Relatel-salg har en unik reference, og 564/564 Relatel-salg har CVR + Firmanavn i `masterDataFields`. Tidligere match på telefon ramte kun 17/34 fordi numrene normaliseres forskelligt og ikke alle salg har samme telefonværdi i `sales.customer_phone`.

## Hvor data ligger
- Match-nøgle: kolonne R `internal_reference` i Excel ↔ `sales.internal_reference` i Stork
- CVR: `sales.raw_payload->'masterDataFields'->>'Cvr nummer'`
- Firma: `sales.raw_payload->'masterDataFields'->>'Firmanavn'`

## Fremgangsmåde
1. Læs alle unikke `internal_reference` fra de 34 sælger-faner i `relatel-loenperiode-15maj-14jun-2026-pr-saelger-med-cvr-v2.xlsx`.
2. Én SQL-forespørgsel: `SELECT internal_reference, cvr, firma FROM sales WHERE internal_reference = ANY($1)`.
3. Skriv kolonne S (`cvr`) og T (`virksomhed`) i hver fane fra mappingen.
4. Hvis et `internal_reference` ikke har CVR i `masterDataFields` (sjælden case som MG-202605-03457): lad cellen være tom.
5. Output: `/mnt/documents/relatel-loenperiode-15maj-14jun-2026-pr-saelger-med-cvr-v3.xlsx`. Alt andet 1:1 fra v2.

## Forventet dækning
Tæt på 100%. Kun salg uden `masterDataFields` (få stk., typisk ældre eller fejlregistrerede) vil mangle.

## Uden for scope
Ingen kode-ændringer, ingen DB-ændringer, ingen ændring af andre kolonner.

Godkender du, kører jeg det.
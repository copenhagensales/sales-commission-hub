# Chanell mappes i Bulk Salg (Leder)

## Årsag (verificeret)

- I `employee_master_data` står hun som `Chanell Gorell` (dobbelt-l), aktiv, `chgo@copenhagensales.dk`. Hendes private mail er `chanellvighgorell@gmail.com` — dobbelt-l er den rigtige stavning.
- Adversus-filen skriver `Chanell Gorel` (enkelt-l).
- Bulk-importen matcher navnet eksakt efter normalisering (`supabase/functions/manual-sales/index.ts`, `byName.get(norm(seller))`). Normaliseringen fjerner kun specialtegn og dobbelte mellemrum og fanger derfor ikke et manglende bogstav. Rækkerne fejler med "Sælger findes ikke eller er inaktiv".

## Løsning

Ingen generel fuzzy-matching. Kun én eksplicit alias-mapping i bulk-importen:

- Navnet `Chanell Gorel` fra filen mappes til den aktive medarbejder `Chanell Gorell` (`chgo@copenhagensales.dk`).

Aliaset lægges i en lille, navngivet liste i `bulk_import`-handleren, så fremtidige tilfælde kan tilføjes med én linje. Aliaset slår kun til, når det almindelige navneopslag ikke finder et match, og det peger på den aktive arbejdsmail — så en fratrådt medarbejder kan ikke få registreret salg. Navnet i Stork rettes ikke (det er korrekt).

## Afgrænsning

- Kun `supabase/functions/manual-sales/index.ts` (bulk_import-handleren) ændres.
- Ingen medarbejderdata, intet skema, ingen ændring i dublet-, status- eller mobilvalidering.
- Ingen effekt på "Tast selv"-enkeltregistrering, løn, pricing eller rapporter.
- Fejlteksten for ukendte sælgere er uændret.

## Verifikation

- Edge-funktionen deployes, og filen køres som forhåndsvisning (dry-run): Chanells rækker skal gå fra fejl til "klar" med `chgo@copenhagensales.dk`.
- Balder- og Flora-scenarierne kontrolleres fortsat klar, og en ukendt sælger afvises fortsat.

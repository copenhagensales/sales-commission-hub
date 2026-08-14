# Chanell afvises i Bulk Salg (Leder): stavefejl på ét bogstav

## Årsag (verificeret)

- I `employee_master_data` står hun som `Chanell Gorell` (dobbelt-l), aktiv, `chgo@copenhagensales.dk`. Hendes private mail er `chanellvighgorell@gmail.com` — dobbelt-l er altså den rigtige stavning.
- Adversus-filen indeholder `Chanell Gorel` (enkelt-l).
- Bulk-importen matcher navnet eksakt efter normalisering (`supabase/functions/manual-sales/index.ts`, `byName.get(norm(seller))`). Normaliseringen fjerner kun specialtegn og dobbelte mellemrum — den fanger ikke et manglende bogstav. Derfor fejler hendes rækker med "Sælger findes ikke eller er inaktiv".

Dette er ikke samme situation som Balder (bindestreg som efternavn) eller Flora (historisk langt navn) — begge de mekanismer virker allerede. Her er der en ren stavefejl i kildefilen.

## Løsning

Navnet i Stork rettes ikke (det er korrekt). I stedet udvides bulk-importens navneopslag med et sidste fallback-trin, som også dækker fremtidige stavefejl:

1. Eksakt normaliseret match (som i dag).
2. Match på historisk navn med aktiv arbejdsmail (som i dag).
3. **Nyt:** hvis intet match, sammenlignes filnavnet med de kendte navne og accepteres, hvis der er præcis ét navn med maks. én bogstavforskel (tilføjet, manglende eller ombyttet bogstav).

Trin 3 accepterer aldrig et match hvis to eller flere medarbejdere ligger lige tæt — så registreres rækken fortsat som fejl. Kontrol af de 101 aktive navne viser i dag ingen to navne, der ligger inden for én bogstavforskel af hinanden, så risikoen for forkert tilskrivning er reelt nul, og en fejlagtig match kan kun opstå ved at et helt nyt navn ligger et bogstav fra et eksisterende — hvor det så bliver afvist som tvetydigt.

## Afgrænsning

- Kun `supabase/functions/manual-sales/index.ts` (bulk_import-handleren) ændres.
- Ingen medarbejderdata rettes, intet skema ændres.
- Ingen effekt på enkeltregistrering ("Tast selv"), løn, pricing, rapporter eller andre navneopslag.

## Teknisk

- Lokal `levenshtein(a, b)` med early-exit ved afstand > 1 tilføjes i bulk_import-scope.
- Fallback kører kun når `byName.get(norm(seller))` er tom, og kun over navne hvis tegnlængde ligger inden for ±1 af søgenavnet (billig forfiltrering).
- Kræver unikt match; ellers uændret fejltekst "Sælger findes ikke eller er inaktiv".
- Dublet-, status- og mobilvalidering er urørt — matching sker som i dag efter disse tjek.

## Verifikation

- Edge-funktionen deployes, og filen køres som forhåndsvisning (dry-run): Chanells rækker skal gå fra fejl til "klar" med `chgo@copenhagensales.dk`.
- Et konstrueret navn med to bogstavforskelle skal fortsat afvises.
- Balder- og Flora-scenarierne kontrolleres uændret klar.

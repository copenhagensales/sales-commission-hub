# Operator-afvigelse i "Afvigelser — oversigt"

## Regel
Sammenligning mellem det interne Tastselv-produktnavn og "PB Operator":

- Produktnavn indeholder "(IKKE Nuuday)" → operatoren må IKKE være på Nuuday-listen (eesy, Telmore, Yousee). Er den det: afvigelse.
- Produktnavn indeholder "(Nuuday)" → operatoren må IKKE være på ikke-Nuuday-listen. Er den det: afvigelse.
- Ukendt operator (ikke på nogen af listerne) behandles som "ikke Nuuday".
- Produktet "5G Internet": ingen operator-tjek.
- Produktnavne uden hverken "(Nuuday)" eller "(IKKE Nuuday)": ingen regel at måle på.

Afvigelsestypen i kolonnen "Afvigelse" hedder "Operator".

## Sammenspil med kampagne-afvigelsen
En række kan bryde begge regler. Kolonnen "Afvigelse" viser da "Kampagne + Operator". En række er kun konform (og havner i "Salg uden afvigelser") hvis både kampagne- og operator-reglen holder.

## Teknisk
- Operator-listerne flyttes til `src/hooks/useEesyFmDeviations.ts` som `OPERATORS_NUUDAY` / `OPERATORS_NON_NUUDAY` og eksporteres; `EesyFmDeviations.tsx` importerer dem i stedet for egne konstanter (én sandhed, ingen visuel ændring i Mapping-fanen).
- Nye hjælpere i hooket:
  - `nuudayMode(product)` → `"nuuday" | "non_nuuday" | null` via normaliseret søgning på "ikke nuuday" før "nuuday" (rækkefølgen er vigtig).
  - `isNuudayOperator(operator)` → true kun ved match i Nuuday-sættet (normaliseret); alt andet, inkl. ukendt/tom, tælles som ikke-Nuuday.
  - `operatorMatchesProduct(product, operator)` → true når kombinationen er i orden.
- Matchevaluering pr. Stork-salg: en PowerBI-række er konform hvis både `campaignMatchesProduct` og `operatorMatchesProduct` er sande. Findes en konform række → `okRows` (samme "anyEqual"-princip som i dag). Ellers bygges afvigelsesteksten ud fra den første match: bryder kampagnen → "Kampagne", bryder operatoren → "Operator", begge → "Kampagne + Operator".
- 5G Internet springer begge tjek over (som i dag).
- Kun `src/hooks/useEesyFmDeviations.ts` får logikændringer; `EesyFmDeviations.tsx` ændres kun til import af konstanterne. Ingen DB-ændringer.

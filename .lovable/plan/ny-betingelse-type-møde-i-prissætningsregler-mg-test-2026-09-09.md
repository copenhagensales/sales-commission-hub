# Ny betingelse: "Type møde" i prissætningsregler (MG test)

## Formål
Provisionssatser skal kunne differentieres på mødeform (fx Tryg-produkter), så en regel kan gælde kun for Telefonmøde eller kun for Onlinemøde.

## Fund (verificeret i data)
Adversus sender allerede feltet `Hvilket type møde` i `leadResultData`. Over de sidste 90 dage:
- `Telefonmøde`: 1.455 salg
- `Onlinemøde`: 479 salg

Matchningen i pricing-motoren er generisk: den slår betingelsens nøgle op mod `label` i `leadResultData` (Adversus) og mod nøgler i `raw_payload.data` (Enreach/HeroBase). Der kræves derfor ingen ændring i matchlogikken — kun at nøglen er den rigtige.

## Løsning
1. Tilføj betingelsen med den tekniske nøgle `Hvilket type møde` og de to valgmuligheder `Telefonmøde` og `Onlinemøde`.
2. Vis den i brugerfladen som **Type møde** via en ny visningsnavn-oversættelse, så listen er letlæselig, mens den gemte nøgle fortsat matcher Adversus-feltet præcist.
3. Betingelsen bliver tilgængelig for alle produkter (samme som de øvrige Adversus-betingelser), ikke kun Tryg.

Fordi nøglen matcher det eksisterende felt, virker nye regler også ved efterfølgende genberegning af historiske salg — hvis den kører med en dato-afgrænsning man selv vælger.

## Teknisk
Fil: `src/components/mg-test/PricingRuleEditor.tsx`
- `CONDITION_OPTIONS`: ny post `"Hvilket type møde": ["Telefonmøde", "Onlinemøde"]`.
- Ny konstant `CONDITION_DISPLAY_LABELS: Record<string, string>` med `"Hvilket type møde" → "Type møde"`, plus en lille helper `displayConditionKey(key)` der falder tilbage til nøglen selv.
- Brug helperen i:
  - dropdownen "Tilføj betingelse" (listen over ledige nøgler)
  - overskriften på hver tilføjet betingelsesrække
- Ingen ændring i hvordan `conditions` gemmes i databasen (nøglen forbliver `Hvilket type møde`).

Ikke berørt: `matchPricingRule` i `supabase/functions/integration-engine/core/sales.ts`, `rematch-pricing-rules`, `_shared/pricing-service.ts`, provisions-/løn-logik, RLS, migrationer. Ingen databaseændring.

## Verifikation
- Typecheck.
- Opret en testregel i UI'et med betingelsen `Type møde = Onlinemøde`, og bekræft via en læse-query at rækken i `product_pricing_rules.conditions` gemmes som `{"Hvilket type møde": "Onlinemøde"}`.
- Kontroller mod et eksisterende salg med `Onlinemøde` at nøglen matcher feltet 1:1 (læse-query, ingen ændring af salgsdata).

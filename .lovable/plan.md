# "Inaktiv"-knap på produkter i MG Test

## Svar først: knappen findes ikke i dag

Der er ingen knap i MG Test til at sætte et produkt inaktivt.

- Øje-ikonet i kolonnen **Synlig** (`src/pages/MgTest.tsx:2632`) sætter `is_hidden` — det skjuler kun produktet i MG Test-listen. Det påvirker ikke sælgerne.
- `is_active = false` sættes i dag udelukkende automatisk, når et produkt flettes ind i et andet (`ProductMergeDialog.tsx:637`). Feltet vises kun som badge "Inaktiv" inde i flette-dialogen.

Da FM-salgsregistreringen nu filtrerer på `is_active` (ændringen fra sidste opgave), mangler der en knap til at styre det manuelt.

## Det der skal bygges

### 1. Aktiv/Inaktiv-kontrol i produktdialogen

`src/components/mg-test/ProductPricingRulesDialog.tsx`, fanen **Hovedside** (blokken "Basis-indstillinger", linje 448-494):

- Visningstilstand: vis status "Aktiv" / "Inaktiv" ved siden af "Tæl som salg" / "Tæl som bisalg", med tydelig markering når produktet er inaktivt.
- Redigeringstilstand (linje 529-553): tilføj et checkbox-felt **"Aktiv (kan vælges af sælgere)"** ved siden af de to eksisterende felter, som skriver `is_active` på produktet sammen med de øvrige basis-indstillinger.
- Hjælpetekst: "Inaktive produkter kan ikke længere registreres af sælgere. Historiske salg og satser bevares."
- `is_active` skal med i produkt-select og i mutationen der opdaterer `counts_as_sale`/`counts_as_cross_sale` (linje 212-220), så alt gemmes i én handling.

### 2. Synlig markering i produkttabellen

`src/pages/MgTest.tsx` (produktrækkerne, ca. linje 2484-2660):

- Vis badge **"Inaktiv"** på rækken når `is_active = false`, samme mønster som i flette-dialogen.
- `is_active` skal med i den eksisterende produkt-forespørgsel (linje 439-ff) og i `AggregatedProduct`-typen, så badgen kan vises.

### 3. Cache

Efter opdatering invalidieres `["mg-aggregated-products"]`, `["mg-manual-products"]`, `["products"]` og `["campaign-products"]`, så sælgernes produktliste opdateres med det samme.

## Arbejdsgang bagefter

1. MG Test → klik tandhjulet på produktet → fanen **Hovedside** → **Rediger** → fjern fluebenet i "Aktiv" → Gem.
2. Produktet forsvinder fra sælgernes FM-salgsregistrering.
3. Alle tidligere salg beholder navn, provision og omsætning — intet genberegnes.

## Omfang

Gul zone: MG Test-produktadministration. Ingen ændringer i pricing-motoren, ingen migration, ingen data slettes.

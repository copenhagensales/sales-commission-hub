

## Problem: Værdier gemmes som sammenkædede strenge

Databasen indeholder:
```text
5G Internet produkt:
  Subscription Name IN {"5G Internet Ubegrænset data"}   ← 1 element

Eesy produkter:
  Subscription Name NOT_IN {"5G Internet Ubegrænset data", "Fri tale + 20 GB data (5G) (6 mdr. binding)"}
```

Det burde være:
```text
5G Internet produkt:
  Subscription Name IN {"5G Internet", "Ubegrænset data"}   ← 2 elementer

Eesy produkter:
  Subscription Name NOT_IN {"5G Internet", "Ubegrænset data", "Fri tale + 20 GB data (5G) (6 mdr. binding)"}
```

Når brugeren vælger flere checkboxes i UI'et, gemmes de korrekt som separate værdier. Men "5G Internet Ubegrænset data" blev sandsynligvis indtastet som en enkelt custom-værdi eller migreret forkert.

## Plan

### 1. Fix data i databasen (migration)
- Split `"5G Internet Ubegrænset data"` til `["5G Internet", "Ubegrænset data"]` i alle rækker der indeholder denne sammenkædede streng
- Gælder alle `cancellation_product_conditions` rækker for dette client_id

### 2. Tilføj validering ved gem (SellerMappingTab.tsx)
- I save-logikken: tjek om en valgt værdi matcher en kendt kolonne-værdi fra Excel-data
- Hvis ikke, forsøg at splitte den mod de kendte værdier for at undgå sammenkædning fremover

### 3. Tilføj robusthed i matcher (productConditionMatcher.ts)  
- I `normalizeConditionValues`: Hvis en enkelt array-værdi ikke matcher nogen cellværdi, forsøg at splitte den mod kendte delimiter-mønstre
- Backup-sikkerhed så gamle/fejlagtige data stadig evalueres korrekt

### 4. Re-klassificér kø-rækker (migration)
- Genberegn `upload_type` for pending rækker i den aktive import, nu med korrekte array-værdier
- Rul den tidligere migration tilbage der fejlagtigt satte alle 5G-rækker til `basket_difference`

### Berørte filer
- `src/utils/productConditionMatcher.ts` — robustere value-normalisering
- `src/components/cancellations/SellerMappingTab.tsx` — validering ved gem
- Ny migration — data-fix + re-klassificering


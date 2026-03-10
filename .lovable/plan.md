

# Fortrolig-toggle på Skabeloner-fanen

## Problem
Skabeloner kan i dag ikke markeres som fortrolige. Kun kontrakter har `is_confidential`. Brugeren ønsker at kunne låse skabeloner, så fortrolige skabeloner kun er synlige for km@ og mg@, og ikke dukker op som valg i SendContractDialog for andre.

## Ændringer

### 1. Database-migration
- Tilføj `is_confidential BOOLEAN DEFAULT false` til `contract_templates`.
- Opret `can_access_confidential_contract`-check i RLS for templates (genbruger den eksisterende funktion).
- Opdater RLS-policies på `contract_templates`, så templates med `is_confidential = true` kun kan ses af brugere med adgang via `can_access_confidential_contract(auth.uid())`.

### 2. `src/pages/Contracts.tsx` — Skabeloner-fanen
- Tilføj lås-toggle-knap på hvert skabelon-kort (ved siden af Edit/Trash), kun synlig for `canMarkConfidential`-brugere.
- Opret mutation til at toggle `is_confidential` på `contract_templates`.
- Vis lås-ikon på skabelonens titel når `is_confidential = true`.

### 3. `src/components/contracts/SendContractDialog.tsx`
- Fortrolige skabeloner filtreres allerede fra via RLS for uautoriserede brugere — ingen kodeændring nødvendig.

### Filer der ændres
- Database: ny migration (tilføj kolonne + RLS-opdatering)
- `src/pages/Contracts.tsx` — lås-knap og mutation på skabelon-kort


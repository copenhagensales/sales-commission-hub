

# Kundespecifik opsætning til annullerings-upload

## Problem
Hver gang der uploades en fil, skal brugeren manuelt vælge hvilke kolonner der er telefon, OPP, produkt, omsætning osv. TDC Erhverv har 3-4 faste opsætninger, og det er spild af tid at mappe dem hver gang. Derudover bruger `computeDiff()` stadig heuristisk gætteri i stedet for at bruge eksplicitte kolonne-mappings.

## Løsning
Opret en `cancellation_upload_configs`-tabel der gemmer kundespecifikke opsætninger. Når en kunde vælges ved upload, indlæses den gemte config automatisk. Admin kan oprette/redigere configs.

## Ændringer

### 1. Database: Ny tabel `cancellation_upload_configs`

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | |
| client_id | uuid FK → clients | Hvilken kunde |
| name | text | Navn på opsætningen (f.eks. "TDC Standard", "TDC Fiber") |
| phone_column | text | Kolonne for telefonnummer |
| company_column | text | Kolonne for virksomhedsnavn |
| opp_column | text | Kolonne for OPP-nummer |
| product_columns | text[] | Liste af kolonnenavne der indeholder produkter (TDC har mange) |
| revenue_column | text | Kolonne for omsætning |
| commission_column | text | Kolonne for provision |
| product_match_mode | text | `'exact'` / `'strip_percent_suffix'` / `'contains'` — hvordan produktnavne matches |
| is_default | boolean | Om denne config er standard for kunden |
| created_at | timestamptz | |

- Gem også `config_id` på `cancellation_imports` så godkendelseskøen ved hvilken config der blev brugt.

### 2. `UploadCancellationsTab.tsx`

**Auto-load config ved kundevalg:**
- Når `selectedClientId` ændres, hent configs fra `cancellation_upload_configs`
- Hvis der er en default config → auto-udfyld alle kolonne-selectors
- Hvis der er flere configs → vis en dropdown "Vælg opsætning"
- Brugeren kan stadig manuelt override

**Gem ny config:**
- Tilføj "Gem som opsætning" knap der gemmer den aktuelle kolonne-mapping som en config for den valgte kunde

**Ved upload:** Gem `config_id` på `cancellation_imports`

### 3. `ApprovalQueueTab.tsx`

**Brug gemt config i `computeDiff()`:**
- Hent `config_id` fra `cancellation_imports` → hent config fra `cancellation_upload_configs`
- Erstat al heuristisk kolonne-detektion med eksplicit mapping fra config:
  - `config.product_columns` → sammenlign disse kolonner med `sale_items`
  - `config.revenue_column` → sammenlign med systemets omsætning
  - `config.commission_column` → sammenlign med systemets provision
- Brug `product_match_mode` til at bestemme normaliseringslogik (f.eks. strip "0%/50%/100%" for TDC)
- Hvis ingen config → vis ingen diff (i stedet for at gætte)

### 4. Opsætnings-UI (simpelt)
- Tilføj en lille sektion i upload-fanen eller en separat "Konfiguration" knap
- Vis eksisterende configs for den valgte kunde
- Mulighed for at oprette/redigere/slette configs

| Fil | Ændring |
|-----|---------|
| Migration | Opret `cancellation_upload_configs` + tilføj `config_id` til `cancellation_imports` |
| `UploadCancellationsTab.tsx` | Auto-load config ved kundevalg, "Gem som opsætning" knap |
| `ApprovalQueueTab.tsx` | Brug eksplicit config i `computeDiff()` i stedet for heuristik |


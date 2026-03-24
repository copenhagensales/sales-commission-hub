

# Opret Eesy TM config + bloker upload uden opsætning

## Problem
1. Eesy TM har ingen gemt upload-config i databasen — den skal oprettes direkte
2. Config-oprettelsesformularen vises stadig i upload-trinnet. Brugeren vil have at upload er **helt blokeret** uden config (den originale adfærd vi lavede før).

## Ændringer

### 1. Database: Indsæt Eesy TM config
Opret en migration der inserter:
```sql
INSERT INTO cancellation_upload_configs (
  client_id, name, phone_column, opp_column, member_number_column,
  company_column, product_columns, product_match_mode,
  is_default, filter_column, filter_value
) VALUES (
  '81993a7b-ff24-46b8-8ffb-37a83138ddba',
  'Eesy TM Standard',
  'Phone Number', NULL, NULL, NULL,
  '{}', 'strip_percent_suffix',
  true, 'Annulled Sales', '1'
);
```

### 2. UploadCancellationsTab.tsx — Fjern inline config-oprettelse
Erstat `ConfigCreationForm`-visningen med den **originale blokerings-besked** (AlertCircle + "Ingen opsætning fundet. Kontakt en administrator."). Behold `ConfigCreationForm` komponenten og `EditConfigDialog` til redigering af eksisterende configs, men fjern den fra upload-trinnet.

Konkret: Linje ~1026-1034 ændres fra `ConfigCreationForm` tilbage til en simpel blokerings-besked med `AlertCircle`.

### Resultat
- Eesy TM får sin config → upload → auto-filter (Annulled Sales = 1) → match → preview
- Kunder uden config → blokeret med besked, ingen mulighed for at uploade


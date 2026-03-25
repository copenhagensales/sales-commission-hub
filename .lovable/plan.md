

# Opsætning af annulleringskonfiguration for Eesy FM

## Problem
Eesy FM mangler en `cancellation_upload_configs` post, hvilket blokerer upload af annulleringsfiler (som vist i screenshottet: "Ingen opsætning fundet").

## Løsning
Indsæt en konfiguration i `cancellation_upload_configs` via en database-migration. Strukturen er næsten identisk med Eesy TM, men simplere — FM-salg matcher direkte på `customer_phone` (standard matching), så `product_phone_mappings` er ikke nødvendig.

### Konfigurationsdetaljer

| Felt | Værdi | Bemærkning |
|------|-------|------------|
| client_id | `9a92ea4c-...` | Eesy FM |
| name | "Eesy FM Standard" | |
| date_column | "Date Creation" | Dato fra Excel |
| phone_column | "Phone Number" | Matches mod `customer_phone` |
| seller_column | "Employee Name" | Sælgernavn + lokation via "Sales Department" |
| filter_column | "Annulled Sales" | Kun annullerede rækker |
| filter_value | "1" | |
| is_default | true | Auto-valgt |
| product_match_mode | "phone" | Standard phone-matching |
| fallback_product_mappings | `[{"excelProductPattern":"5G Internet","saleItemTitle":"5G Internet"}]` | For 5G-produkter uden telefonmatch |

### Matching-logik
- **Standard abonnementer**: Matcher via telefonnummer (Excel `Phone Number` → DB `customer_phone`)
- **5G Internet**: Fallback Pass 2 — matcher via sælgernavn + dato + produkttitel (da 5G-salg ofte deler telefonnummer med abonnementssalget)
- **Lokation**: "Sales Department" (f.eks. "CPH-Sales", "CPH-Sales market") gemmes automatisk i `uploaded_data` JSONB-feltet i `cancellation_queue`, og er synlig i godkendelseskøen

### Teknisk plan

| Fil | Ændring |
|-----|---------|
| Migration (SQL) | INSERT i `cancellation_upload_configs` for Eesy FM |

Ingen kodeændringer — den eksisterende matching-logik håndterer allerede standard phone-matching og fallback-produkter.


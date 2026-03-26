

## Genopret ASE upload-konfiguration

ASE-konfigurationen mangler i `cancellation_upload_configs`. Den skal genoprettes med de korrekte kolonne-mappings baseret på den uploadede Excel-fil.

### Excel-kolonne-struktur (ASE)
| Kolonne | Mapping |
|---|---|
| Sælger | `seller_column` |
| Indmeldelsesdato | `date_column` |
| Medlemsnummer | `member_number_column` |
| A-kasse + Lønsikring forsikringssum | `product_columns` |
| Type | (ingen direkte mapping — bruges evt. til filter) |

### Ændringer

**1. Indsæt ASE upload-konfiguration i databasen**
- Brug insert-tool til at oprette en ny række i `cancellation_upload_configs`:
  - `client_id`: `53eb9c4a-91b0-44a9-9ee7-a87d87cc3e0f` (Ase)
  - `name`: "Ase Standard"
  - `seller_column`: "Sælger"
  - `date_column`: "Indmeldelsesdato"
  - `member_number_column`: "Medlemsnummer"
  - `product_columns`: ["A-kasse"] (primær produktkolonne)
  - `phone_column`: null (ingen telefonkolonne)
  - `opp_column`: null
  - `company_column`: null
  - `is_default`: true
  - `product_match_mode`: "strip_percent_suffix"

Ingen kodeændringer nødvendige — systemet understøtter allerede `member_number_column` i upload-wizarden og matching-logikken.


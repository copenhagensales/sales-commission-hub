

## Plan: Map 5 Eesy TM-kampagner og backfill umappede salg

### Hvad der sker

5 kampagner i `adversus_campaign_mappings` har `client_campaign_id = NULL` men hører til Eesy TM. De opdateres på præcis samme måde som de 20+ eksisterende Eesy TM-kampagner.

### Trin 1: Opdater kampagne-mappings

Sæt `client_campaign_id = 'd031126c-aec0-4b80-bbe2-bbc31c4f04ba'` (Eesy TM Products) på:

| Kampagne | Navn |
|----------|------|
| CAMP8252C81 | Pricebook DNB |
| CAMP8291C81 | Mobilpriser |
| CAMP8438C81 | Admill - Valino |
| CAMP7371C81 | (ukendt) |
| CAMP7526C81 | (ukendt) |

### Trin 2: Backfill salg

Opdater `sales.client_campaign_id` via join mod `adversus_campaign_mappings` for alle salg hvor:
- `dialer_campaign_id` matcher en af de 5 kampagner
- `client_campaign_id IS NULL`

Også backfill de 8 salg fra kategori 2 (kampagner 108547, 108541, 108543, 108545) der allerede har korrekt mapping men mangler det på salget.

### Trin 3: Rematch prisregler

Kald `rematch-pricing-rules` for de berørte salg så provision/omsætning beregnes.

### Teknisk

- Data-opdateringer via insert-tool (UPDATE statements)
- Ingen kodeændringer — bruger eksisterende infrastruktur
- Samme mønster som alle andre Eesy TM-kampagner


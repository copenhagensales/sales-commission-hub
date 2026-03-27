

## Opret annullerings-opsætning for Tryg

### Problem
Tryg (client_id: `516a3f67-ea6d-4ef0-929d-e3224cc16e22`) har ingen record i `cancellation_upload_configs`, hvilket forhindrer upload af annulleringsfiler.

### Excel-struktur (data_2.xlsx)
Kolonner: `Kilde`, `Booker_id`, `Årsagsangivelse`, `Indtastet telefonnummer`, `Bookede møder`, `Afholdelse %`

### Løsning
Indsæt en standard-konfiguration for Tryg:

```sql
INSERT INTO cancellation_upload_configs (
  client_id,
  name,
  phone_column,
  seller_column,
  date_column,
  product_columns,
  product_match_mode,
  is_default
) VALUES (
  '516a3f67-ea6d-4ef0-929d-e3224cc16e22',
  'Tryg Standard',
  'Indtastet telefonnummer',
  'Booker_id',
  NULL,
  '{}',
  'phone',
  true
);
```

### Konfigurationsvalg
- **phone_column** = `Indtastet telefonnummer` — matcher mod salgsdata via telefonnummer (normalisering håndteres automatisk)
- **seller_column** = `Booker_id` — e-mail-adressen bruges til at identificere sælgeren via `cancellation_seller_mappings`
- **product_match_mode** = `phone` — Tryg matcher per telefonnummer (ét produkt per salg)
- **date_column** = `NULL` — Excel-filen har ingen salgsdato-kolonne, kun telefonnumre og mødetal
- **product_columns** = `{}` (tom) — ingen produktkolonne i dette format
- **filter_column/filter_value** = ikke sat — alle rækker er relevante

### Ingen kodeændringer
Systemet håndterer allerede phone-baseret matching og sælger-mapping. Den manglende config var det eneste problem.

### Risiko
Meget lav — standard config-indsættelse som de øvrige klienter allerede har.


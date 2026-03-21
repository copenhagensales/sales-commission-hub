

# Backfill telefonnumre for eksisterende ASE-salg

## Problem
~503 ASE-salg har telefonnummer i `raw_payload->'data'->>'Telefon'` men ikke i `customer_phone`. Yderligere ~938 mangler helt telefonnummer i rå-dataen.

## Løsning
Én SQL data-opdatering der udfylder `customer_phone` fra `raw_payload` for ASE-salg:

```sql
UPDATE sales
SET customer_phone = NULLIF(raw_payload->'data'->>'Telefon', '')
WHERE source = 'ASE'
  AND (customer_phone IS NULL OR customer_phone = '')
  AND raw_payload->'data'->>'Telefon' IS NOT NULL
  AND raw_payload->'data'->>'Telefon' != '';
```

Ingen kodeændringer — kun én data-opdatering via insert-tool.

## Resultat
- ~503 ASE-salg får telefonnummer udfyldt
- De resterende ~938 uden telefon i rå-data forbliver uændrede (data eksisterer simpelthen ikke)
- Fremtidige ASE-salg er allerede dækket af Enreach-adapter fixet

| Handling | Detalje |
|----------|---------|
| SQL UPDATE via insert-tool | Udfyld `customer_phone` fra `raw_payload` for ASE |


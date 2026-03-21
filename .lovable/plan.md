

# Backfill telefonnumre for eksisterende Eesy TM-salg

## Status
- **Eesy FM**: ✅ Alle 4.231 har telefonnummer — ingen aktion nødvendig
- **Eesy TM**: ❌ 2.529 salg mangler telefonnummer (importeret før fix)
- **Fremtidige Eesy TM**: ✅ Fixet er allerede deployet og virker

## Løsning
Én SQL-migration der henter telefonnummeret direkte fra `raw_payload->'data'` (det ligger allerede der som `contact_number`, `SUBSCRIBER_ID` eller `Telefon Abo1`):

```sql
UPDATE sales
SET customer_phone = COALESCE(
  NULLIF(raw_payload->'data'->>'contact_number', ''),
  NULLIF(raw_payload->'data'->>'SUBSCRIBER_ID', ''),
  NULLIF(raw_payload->'data'->>'Telefon Abo1', '')
)
WHERE source = 'Eesy'
  AND (customer_phone IS NULL OR customer_phone = '')
  AND raw_payload->'data' IS NOT NULL;
```

Ingen kodeændringer — kun én database-migration.

## Resultat
- De 2.529 eksisterende Eesy TM-salg får telefonnumre udfyldt med det samme
- Salgsvalideringen kan herefter matche Eesy-salg mod kundens telefonnumre


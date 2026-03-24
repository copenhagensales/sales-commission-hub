

# Fix: Status viser altid "approved" i Rådata-rapporten

## Problem
`get_sales_report_raw` RPC'en refererer til `s.status` — en kolonne der **ikke eksisterer** på `sales`-tabellen. Den korrekte kolonne hedder `s.validation_status`. Fordi `s.status` altid er NULL, returnerer `COALESCE(s.status, 'approved')` altid `'approved'`.

## Løsning
Én migration der opdaterer begge versioner af `get_sales_report_raw` (3-param og 5-param):

**Ændring** (linje 24 og 64):
```sql
-- Fra:
COALESCE(s.status, 'approved') AS status
-- Til:
COALESCE(s.validation_status, 'pending') AS status
```

Default ændres til `'pending'` da det er kolonnes faktiske default-værdi.

## Fil
- **Migration**: Drop + recreate begge overloads af `get_sales_report_raw` med `s.validation_status`


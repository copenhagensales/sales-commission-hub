## Mål
Tilføj "Tilskud" som ekstra kolonne i Rådata-fanen under **Rapporter Ledelse → Relatel** — både i tabellen og i Excel-eksporten, på samme måde som CVR-nummer.

## Kilde
Værdien ligger i `sales.raw_payload -> 'leadResultData'` med `label = 'Tilskud'`. Værdier set i data: `"0%"`, `"100%"`, `"50%"`.

```sql
(SELECT elem->>'value'
 FROM jsonb_array_elements(s.raw_payload->'leadResultData') elem
 WHERE elem->>'label' = 'Tilskud'
 LIMIT 1)
```

## Ændringer

### 1. Migration — udvid `get_sales_report_raw` (begge overloads)
- Tilføj `tilskud text` i `RETURNS TABLE` efter `cvr_number`.
- Tilføj subquery ovenfor som ny kolonne i SELECT.
- Ingen filter-ændringer. Klienter uden feltet → NULL → tom celle.
- Zone: rapporterings-RPC = gul.

### 2. `src/pages/reports/RawSalesTable.tsx`
- Tilføj `tilskud?: string | null` i `RawRow`.
- Ny `<TableHead>Tilskud</TableHead>` som sidste kolonne.
- Ny `<TableCell>{r.tilskud ?? ""}</TableCell>`.

### 3. `src/pages/reports/ReportsManagement.tsx`
- Tilføj `tilskud?: string | null` i lokal `RawRow`.
- Tilføj `"Tilskud": r.tilskud ?? ""` i `rawRows` til Excel.
- Udvid `columnWidths` for Rådata-arket med én ekstra bredde (10).

## Uden for scope
- Ingen ændring af `get_sales_report_detailed` eller Opsummering-fanen.
- Ingen ændring af pricing eller lagringsformat — vi læser blot fra eksisterende `raw_payload`.

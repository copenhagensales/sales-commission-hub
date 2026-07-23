# Tilføj CVR-nummer til Rådata (Rapporter Ledelse)

## Mål
Vise CVR-nummer som ekstra kolonne i Rådata-fanen under **Rapporter Ledelse → Relatel** — både i tabellen og i Excel-eksporten.

## Kilde
Sælgeren indtaster CVR i Adversus-feltet **"Sales ID"**, som ligger i `sales.raw_payload -> 'leadResultData'` som et element med `label = 'Sales ID'`.

Eksempel:
```json
{ "id": 106045, "label": "Sales ID", "value": "25994183" }
```

Værdien læses via:
```sql
(SELECT elem->>'value'
 FROM jsonb_array_elements(s.raw_payload->'leadResultData') elem
 WHERE elem->>'label' = 'Sales ID'
 LIMIT 1)
```

## Ændringer

### 1. Migration — udvid `get_sales_report_raw`
- Tilføj `cvr_number text` i RETURNS TABLE.
- Tilføj subquery ovenfor som ny kolonne i SELECT.
- Ingen andre felter, ingen filter-ændringer. Andre klienter (der ikke har feltet) returnerer NULL, hvilket vises som tom celle.
- Zone: rapporterings-RPC = gul zone.

### 2. `src/pages/reports/RawSalesTable.tsx`
- Tilføj `cvr_number: string | null` i `RawRow`.
- Ny `<TableHead>CVR-nummer</TableHead>` som sidste kolonne.
- Ny `<TableCell>{r.cvr_number ?? ""}</TableCell>`.

### 3. `src/pages/reports/ReportsManagement.tsx`
- Tilføj `cvr_number: string | null` i lokal `RawRow`-interface.
- Tilføj `"CVR-nummer": r.cvr_number ?? ""` i `rawRows` til Excel.
- Udvid `columnWidths`-arrayet i "Rådata"-arket med én ekstra bredde (14).

## Uden for scope
- Ingen ændring af `get_sales_report_detailed` eller Opsummering-fanen.
- Ingen ændring af pricing, løn, eller lagringsformat — vi læser blot fra eksisterende `raw_payload`.
- Ingen backfill nødvendig; data ligger allerede i `raw_payload` på hvert relevant salg.

## Bemærkning
Feltet er specifikt for Relatel-flowet. For klienter uden "Sales ID"-label i `leadResultData` (fx Eesy, YouSee, TDC Erhverv) vil kolonnen blot være tom — det matcher hvordan `customer_company` og andre valgfrie felter fungerer i dag.

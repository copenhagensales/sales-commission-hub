

# Tilføj OPP-nummer til TDC Erhverv udtrækket

## Problem
OPP-nummeret fra Adversus er gemt i `sales.adversus_opp_number`, men `get_sales_report_raw` RPC'en returnerer det ikke. Feltet "Reference" er `internal_reference` (internt MG-salgsid), ikke OPP-nummeret.

## Ændringer

### 1. Database migration: Udvid `get_sales_report_raw`
Tilføj `adversus_opp_number` som nyt felt i RPC'ens RETURNS TABLE og SELECT:
```sql
-- Tilføj til RETURNS TABLE:
adversus_opp_number text

-- Tilføj til SELECT:
s.adversus_opp_number AS adversus_opp_number
```

### 2. `src/pages/reports/ReportsManagement.tsx`
- Tilføj `adversus_opp_number` til `RawRow` interface
- Tilføj "OPP-nummer" kolonne i Excel-eksporten (Rådata-fanen)

### 3. `src/pages/reports/RawSalesTable.tsx`
- Tilføj `adversus_opp_number` til `RawRow` interface
- Tilføj "OPP-nummer" kolonne i tabellen (mellem "Reference" og andre kolonner)

| Fil | Ændring |
|-----|---------|
| Migration SQL | Tilføj `adversus_opp_number` til `get_sales_report_raw` |
| `src/pages/reports/ReportsManagement.tsx` | OPP-nummer i RawRow + Excel-eksport |
| `src/pages/reports/RawSalesTable.tsx` | OPP-nummer kolonne i tabel |


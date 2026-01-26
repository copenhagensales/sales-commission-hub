
# Plan: Inkrementel KPI-beregning med Delta-opdatering

## Baggrund og problem

Den nuværende `calculate-kpi-values` edge function:
- Henter **alle** salg for hele lønperioden hver gang (6.000+ salg)
- Udfører 12-24 paginerede database kald
- Tager 60+ sekunder og timeout ofte
- Genberegner alt fra bunden, selvom kun 1-10 nye salg er kommet siden sidst

**Eksempel på ineffektivitet:**
- Kl. 15:17 → cache opdateres med sales_count = 4 for Liva
- Kl. 15:21 → 1 nyt salg kommer ind
- Kl. 15:22 → funktionen henter alle 6.000+ salg igen for at beregne sales_count = 5
- Men den timeout inden den når at gemme resultatet

## Løsning: Inkrementel beregning med watermark

### Koncept

```text
┌──────────────────────────────────────────────────────────────────────┐
│  NUVÆRENDE TILGANG (ineffektiv)                                      │
├──────────────────────────────────────────────────────────────────────┤
│  Hvert minut:                                                        │
│  1. Hent ALLE 6.000 salg for lønperioden                            │
│  2. Genberegn totaler fra bunden                                     │
│  3. Gem i cache                                                      │
│  → Tid: 60+ sek, timeout risiko høj                                 │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  NY TILGANG (inkrementel)                                            │
├──────────────────────────────────────────────────────────────────────┤
│  Hvert minut:                                                        │
│  1. Læs watermark (sidst behandlede created_at)                     │
│  2. Hent KUN nye salg (WHERE created_at > watermark) → 0-10 rækker  │
│  3. Læs eksisterende cache-værdi                                     │
│  4. Tilføj delta (cached_value + nye_salg_count)                    │
│  5. Gem opdateret cache + ny watermark                               │
│  → Tid: 1-3 sek, timeout risiko elimineret                          │
└──────────────────────────────────────────────────────────────────────┘
```

### Ny tabel: kpi_watermarks

Denne tabel tracker hvornår vi sidst har behandlet data:

| Kolonne | Type | Formål |
|---------|------|--------|
| id | uuid | Primary key |
| period_type | text | 'today', 'payroll_period' |
| scope_type | text | 'employee', 'team', 'global' |
| scope_id | uuid | Employee/team ID (null for global) |
| last_processed_at | timestamptz | Watermark for sales.created_at |
| updated_at | timestamptz | Hvornår rækken sidst blev opdateret |

### Edge cases og håndtering

| Scenarie | Håndtering |
|----------|------------|
| **Slettet salg** | Periodisk full-refresh (hvert 30 min) |
| **Ændret commission** | Track sale_items.updated_at eller full-refresh |
| **Første kørsel** | Hvis ingen cache → fuld beregning |
| **Nyt period (ny dag/uge)** | Nulstil watermark ved periodeskift |
| **FM salg** | Samme logik med fieldmarketing_sales.created_at |

### Periodisk full-refresh

For at håndtere edge cases (sletninger, ændringer) køres en fuld refresh:
- Hvert 30. minut for employee-scoped KPIs
- Hvert 60. minut for leaderboards
- Ved periodeskift (midnat, mandag, 15. i måneden)

## Implementeringsplan

### 1. Database-ændringer

Opret `kpi_watermarks` tabel med unik constraint på (period_type, scope_type, scope_id).

Tilføj index på `sales.created_at` for effektiv inkrementel fetch.

### 2. Ny edge function: calculate-kpi-incremental

Denne funktion:
1. Læser watermark fra `kpi_watermarks`
2. Henter kun nye salg siden watermark
3. Grupperer salg per employee
4. Opdaterer kun berørte employees' cache-værdier
5. Opdaterer watermark

**Pseudo-kode:**
```text
// Læs watermark
lastProcessed = SELECT last_processed_at FROM kpi_watermarks 
                WHERE period_type = 'today' AND scope_type = 'employee'

// Hent nye salg
newSales = SELECT * FROM sales 
           WHERE created_at > lastProcessed
           ORDER BY created_at

// Gruppér per employee
affectedEmployees = grupperSalgPerEmployee(newSales)

// For hver berørt employee
FOR each employee IN affectedEmployees:
    currentCache = SELECT value FROM kpi_cached_values 
                   WHERE kpi_slug = 'sales_count' 
                   AND scope_id = employee.id
    
    newValue = currentCache.value + employee.newSalesCount
    
    UPSERT INTO kpi_cached_values (value = newValue)

// Opdater watermark
UPSERT INTO kpi_watermarks (last_processed_at = MAX(newSales.created_at))
```

### 3. Behold calculate-kpi-values til full-refresh

Den eksisterende funktion fortsætter som "full-refresh" version:
- Køres hvert 30. minut (ikke hvert minut)
- Sikrer konsistens og håndterer edge cases
- Kan også trigges manuelt ved behov

### 4. Opdateret cron-skema

| Funktion | Schedule | Formål |
|----------|----------|--------|
| calculate-kpi-incremental | Hvert minut | Hurtig delta-opdatering |
| calculate-kpi-values | Hvert 30. minut | Full-refresh for konsistens |

## Forventet performance-forbedring

| Metrik | Før | Efter |
|--------|-----|-------|
| Kørselstid | 60+ sek | 1-3 sek |
| Database reads | 6.000+ rækker | 1-10 rækker |
| Database queries | 12-24 | 3-5 |
| Timeout risiko | Høj | Elimineret |
| Data-forsinkelse | Op til 60+ min | Max 60 sek |

## Tekniske detaljer

### Inkrementel fetch query

Optimeret query der kun henter nye salg:

```sql
SELECT s.id, s.agent_email, s.agent_external_id, s.sale_datetime, s.created_at,
       si.mapped_commission, si.quantity, si.product_id
FROM sales s
LEFT JOIN sale_items si ON si.sale_id = s.id
WHERE s.created_at > $watermark
  AND s.sale_datetime >= $period_start
  AND s.sale_datetime <= $period_end
ORDER BY s.created_at ASC
```

### Index-anbefalinger

For optimal performance bør der oprettes:

```sql
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
```

### Håndtering af FM salg

Samme logik anvendes for fieldmarketing_sales:

```sql
SELECT * FROM fieldmarketing_sales 
WHERE created_at > $watermark
  AND registered_at >= $period_start
```

## Risici og mitigering

| Risiko | Mitigering |
|--------|------------|
| Misset salg ved fejl | Full-refresh hvert 30. min |
| Concurrent writes | UPSERT med ON CONFLICT |
| Watermark korruption | Default til full-refresh hvis watermark mangler |
| Commission ændringer | Trackes via sale_items.updated_at |

## Implementeringsrækkefølge

1. Opret `kpi_watermarks` tabel og index på sales.created_at
2. Opret ny `calculate-kpi-incremental` edge function
3. Opret nyt cron job for inkrementel function (hvert minut)
4. Opdater eksisterende cron job til at køre hvert 30. minut
5. Test og verificer at data opdateres korrekt
6. Monitor logs for at sikre stabil drift


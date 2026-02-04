
# System Optimeringsaudit: KPI & Leaderboard Pipeline

## Kritiske Fund

### 1. Massiv Watermark Duplikering (KRITISK)
**Problem:** `kpi_watermarks` tabellen har ~26,000 rækker hvor der kun burde være 2!

```text
Forventet:
| period_type      | scope_type | scope_id | count |
|------------------|------------|----------|-------|
| today            | employee   | NULL     | 1     |
| payroll_period   | employee   | NULL     | 1     |

Faktisk:
| period_type      | scope_type | scope_id | count  |
|------------------|------------|----------|--------|
| today            | employee   | NULL     | 13,135 |
| payroll_period   | employee   | NULL     | 13,134 |
```

**Root Cause:** `upsertWatermarks` funktionen bruger `onConflict: "period_type,scope_type,scope_id"` men tabellen mangler et unikt constraint på disse kolonner. Dette betyder at hver kørsel INSERT'er nye rækker i stedet for at opdatere eksisterende.

**Konsekvens:**
- Unødvendig database-vækst (~26KB → potentielt MB over tid)
- Langsom watermark-læsning
- Ineffektiv disk-brug

### 2. Incremental KPI Aldrig "Indhenter" (MODERAT)
**Problem:** Logs viser konsekvent:
```
Found 1000 new telesales since watermark
Payroll watermark: 2026-01-27T00:03:01.128+00:00 (8 dage gammel!)
```

Funktionen finder altid det maksimale antal salg (1000), hvilket indikerer at den aldrig "indhenter" de nyeste data. Watermark'et er 8 dage bagud.

**Root Cause:** Watermark-opdateringen fungerer ikke korrekt pga. manglende unique constraint.

### 3. FM Sales Limit på 1000 (MODERAT)
**Problem:** `calculate-leaderboard-incremental` logs viser:
```
Loaded 3081 telesales, 1000 FM sales
```

FM sales query'en bruger ikke paginering og rammer Supabase's 1000-rækkers grænse.

**Impakt:** FM-sælgere over grænsen vises ikke på leaderboards.

### 4. Redundant Full Data Fetch (OPTIMERING)
**Problem:** `calculate-leaderboard-incremental` henter ALLE salg for payroll-perioden (3000+ rækker) hvert minut, selvom det kun behøver at genberegne leaderboards.

**Anbefaling:** Da funktionen kører hvert minut og primært skal vise "today" data, kunne den optimeres til kun at hente dagens data med fuld payroll-beregning hver 5. minut.

### 5. Manglende `this_week` i Incremental (FUNKTIONEL GAP)
**Problem:** `calculate-leaderboard-incremental` beregner kun "today" og "payroll_period", men flere dashboards bruger også "this_week":
```typescript
// CsTop20Dashboard.tsx
const weekQuery = useCachedLeaderboard("this_week", scope, { enabled, limit });
```

Dette betyder "this_week" kun opdateres hver 30. minut via full refresh.

---

## Optimeringsprojekt

### Fase 1: Database Cleanup (Kritisk)

#### 1.1 Tilføj Unique Constraint til `kpi_watermarks`
```sql
-- Ryd duplikater (behold nyeste)
DELETE FROM kpi_watermarks
WHERE id NOT IN (
  SELECT DISTINCT ON (period_type, scope_type, scope_id) id
  FROM kpi_watermarks
  ORDER BY period_type, scope_type, scope_id, last_processed_at DESC
);

-- Tilføj unique constraint
ALTER TABLE kpi_watermarks 
ADD CONSTRAINT unique_watermark_key 
UNIQUE (period_type, scope_type, scope_id);
```

#### 1.2 Verificer upsert fungerer
Efter constraint er tilføjet, vil `onConflict` fungere korrekt.

### Fase 2: FM Sales Paginering

#### 2.1 Opdater `fetchFmSalesForPeriod` til at bruge paginering
```typescript
async function fetchFmSalesForPeriod(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string
): Promise<(FmSale & { registered_at: string })[]> {
  const PAGE_SIZE = 500;
  const allFmSales: (FmSale & { registered_at: string })[] = [];
  let page = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from("fieldmarketing_sales")
      .select("id, product_name, seller_id, client_id, registered_at")
      .gte("registered_at", startStr)
      .lte("registered_at", endStr)
      .order("registered_at", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    
    if (error) break;
    if (data && data.length > 0) {
      allFmSales.push(...data);
      hasMore = data.length === PAGE_SIZE;
      page++;
    } else {
      hasMore = false;
    }
  }
  return allFmSales;
}
```

### Fase 3: Tilføj `this_week` til Incremental

#### 3.1 Udvid periods array
```typescript
const periods = [
  { type: "today", start: getStartOfDay(now), end: now },
  { type: "this_week", start: getStartOfWeek(now), end: now }, // NY
  { type: "payroll_period", ...getPayrollPeriod(now) },
];
```

### Fase 4: Performance Optimering (Valgfri)

#### 4.1 Tiered Refresh Strategy
```text
┌─────────────────────────────────────────────────────────────────┐
│                OPTIMERET ARKITEKTUR                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  calculate-leaderboard-incremental (hvert minut)                │
│  ├─ "today": Fuld genberegning (kritisk for TV boards)          │
│  ├─ "this_week": Fuld genberegning                              │
│  └─ "payroll_period": Kun hvis nye salg detekteres              │
│                                                                 │
│  calculate-kpi-values (hver 30. minut)                          │
│  └─ Full refresh af alt (uændret)                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementeringsrækkefølge

| Prioritet | Opgave | Risiko | Tidsestimat |
|-----------|--------|--------|-------------|
| 1 (Kritisk) | Database cleanup: Ryd watermark duplikater + tilføj constraint | Lav | 5 min |
| 2 (Høj) | FM Sales paginering | Lav | 15 min |
| 3 (Høj) | Tilføj `this_week` til incremental | Lav | 10 min |
| 4 (Medium) | Tiered refresh optimering | Medium | 30 min |

---

## Tekniske Detaljer

### Berørte Filer

| Fil | Ændring |
|-----|---------|
| `supabase/functions/calculate-leaderboard-incremental/index.ts` | FM paginering + this_week |
| `supabase/functions/calculate-kpi-incremental/index.ts` | Verificer watermark-logik |
| Database migration | Unique constraint + cleanup |

### Forventet Resultat
- **Watermarks:** Fra 26,000 → 2 rækker
- **FM Sales:** Ingen 1000-rækkers grænse
- **This Week:** Opdateres hvert minut (ikke 30 min)
- **Performance:** Uændret execution time (~800ms)

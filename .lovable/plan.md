

# Plan: Fix Statement Timeout på Personal Weekly Stats

## Problem Identificeret

Thomas Wehage's daglige provisions-chart viser ingen data fordi **alle 3 parallelle queries timer out** med:
```
"canceling statement due to statement timeout" (HTTP 500)
```

### Bekræftet Data
Thomas HAR faktisk salg de seneste 14 dage:
| Dato | Provision |
|------|-----------|
| 21. jan | 900 kr |
| 20. jan | 1.575 kr |
| 15. jan | 1.750 kr |

Men query'erne når aldrig at returnere data pga. timeout.

## Rod-årsag

1. **RLS policies på `sales` tabellen** evalueres for hver række i joinet
2. **JOIN mellem `sale_items` og `sales`** med filter på `agent_email` er langsom
3. **Manglende index** på `sales.agent_email` og/eller `sales.sale_datetime`
4. **Statement timeout** (typisk 30s) nås før query fuldfører

## Løsningsforslag

### Option A: Database Function med SECURITY DEFINER (Anbefalet)

Samme mønster som `get_weekly_recognition_stats` - en database function der:
- Bypasser RLS (SECURITY DEFINER)
- Accepterer employee_id som parameter
- Returnerer daglige provision aggregeret
- Er optimeret med direkte SQL

```sql
CREATE OR REPLACE FUNCTION public.get_personal_daily_commission(
  p_employee_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  sale_date DATE,
  commission NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(s.sale_datetime) as sale_date,
    COALESCE(SUM(si.mapped_commission), 0) as commission
  FROM sale_items si
  INNER JOIN sales s ON s.id = si.sale_id
  INNER JOIN employee_agent_mapping eam ON eam.employee_id = p_employee_id
  INNER JOIN agents a ON a.id = eam.agent_id
  WHERE LOWER(s.agent_email) = LOWER(a.email)
    AND DATE(s.sale_datetime) BETWEEN p_start_date AND p_end_date
    AND (s.status IS NULL OR s.status != 'rejected')
  GROUP BY DATE(s.sale_datetime)
  ORDER BY sale_date;
END;
$$;
```

### Option B: Tilføj Database Index

Forbedrer query performance uden at ændre RLS:
```sql
CREATE INDEX IF NOT EXISTS idx_sales_agent_email_datetime 
ON sales (LOWER(agent_email), sale_datetime);
```

### Option C: Cache i kpi_cached_values

Beregn daglige stats i `calculate-kpi-incremental` og gem dem - men dette kræver mere omfattende ændringer.

## Anbefaling: Option A + B

1. **Opret database function** `get_personal_daily_commission`
2. **Tilføj index** for fremtidig performance
3. **Opdater hook** til at kalde funktionen i stedet for direkte queries

## Implementation

### 1. Database Migration
- Opret `get_personal_daily_commission` funktion
- Tilføj index på `sales(LOWER(agent_email), sale_datetime)`

### 2. Opdater Hook
**Fil:** `src/hooks/usePersonalWeeklyStats.ts`

Erstat de 3 parallelle queries med et enkelt kald til den nye funktion:
```typescript
const { data, error } = await supabase
  .rpc('get_personal_daily_commission', {
    p_employee_id: employeeId,
    p_start_date: format(fourteenDaysAgo, 'yyyy-MM-dd'),
    p_end_date: format(now, 'yyyy-MM-dd')
  });
```

### 3. Proces Data i Hook
Transformér RPC-resultat til `DailyCommissionEntry[]` format med dayName, isToday, isWeekend markers.

## Filer der ændres

| Fil/Resource | Handling |
|--------------|----------|
| Database | **NY** function `get_personal_daily_commission` |
| Database | **NY** index på `sales` |
| `src/hooks/usePersonalWeeklyStats.ts` | Brug RPC i stedet for direkte queries |

## Resultat

- Query eksekveres på ~100ms i stedet for timeout
- Thomas (og alle andre brugere) vil se deres daglige chart korrekt
- Samme sikkerhedsmodel som eksisterende recognition stats


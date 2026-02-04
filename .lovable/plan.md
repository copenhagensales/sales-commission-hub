
# Central Sales Aggregation Hook - Fuld Implementeringsplan

## Baggrund og Problemstilling

Analysen afslører **massiv duplikering af salgsaggregerings-logik** på tværs af 8+ filer. Den eksisterende `useSalesAggregates` hook bruges **ikke aktivt** og mangler nøglefunktionalitet. Dette resulterer i:

1. **Inkonsistent beregning** - Nogle komponenter ganger med `quantity`, andre ikke
2. **Performance overhead** - Hver komponent henter og beregner individuelt
3. **Vedligeholdelsesrisiko** - Ændringer til beregningslogik kræver opdatering af mange filer
4. **Manglende server-side aggregering** - RPC'en bruges ikke fuldt ud

### Nuværende Duplikering

| Fil | Aggregerings-pattern | Problem |
|-----|---------------------|---------|
| `LiveStats.tsx` | 4x `reduce((sum, item) => sum + mapped_commission)` | Ingen RPC, ingen paginering |
| `CombinedSalaryTab.tsx` | `reduce((sum, si) => sum + mapped_commission)` | Bruger `fetchAllRows` men ikke central hook |
| `DBOverviewTab.tsx` | `reduce(revenue)` + `reduce(commission)` | Separat logik |
| `DBDailyBreakdown.tsx` | Manuelt reduce med grouping | Duplikerer dato-grouping |
| `useCelebrationData.ts` | `calculateSalesAndCommission()` helper | Næsten identisk med central hook |
| `usePreviousPeriodComparison.ts` | `reduce((sum, item) => sum + mapped_commission)` | Ingen RPC, ingen central hook |
| `useRecognitionKpis.ts` | Manuelt aggregate per agent/dag | Speciel logik |
| `SalesGoalTracker.tsx` | `reduce((sum, item) => sum + mapped_commission)` | Personlig data |

---

## Implementeringsplan

### Fase 1: Udvid Server-Side RPC (SQL Migration)

Opret en forbedret `get_sales_aggregates_v2` der returnerer grupperede data:

```sql
CREATE OR REPLACE FUNCTION get_sales_aggregates_v2(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_team_id UUID DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_group_by TEXT DEFAULT 'none' -- 'employee', 'date', 'both', 'none'
)
RETURNS TABLE (
  group_key TEXT,
  group_name TEXT,
  total_sales INTEGER,
  total_commission DECIMAL,
  total_revenue DECIMAL
)
```

**Fordele:**
- Server-side beregning reducerer client load
- Automatisk `counts_as_sale` og `validation_status` håndtering
- Konsistent beregning med `quantity * mapped_commission`

---

### Fase 2: Udvid Central Hook (`useSalesAggregates.ts`)

Udvid den eksisterende hook med:

**Nye features:**
- Gruppering (employee, date, week, month)
- Agent email filtering (for personal stats)
- Top performer beregning
- Week/month breakdowns for celebration data

**Ny interface:**

```typescript
export interface AggregateData {
  sales: number;
  commission: number;
  revenue: number;
}

export interface SalesAggregatesExtended {
  totals: AggregateData;
  byEmployee: Record<string, AggregateData & { name: string }>;
  byDate: Record<string, AggregateData>;
  byWeek: Record<string, AggregateData>;
  byMonth: Record<string, AggregateData>;
  topPerformer: { email: string; name: string; data: AggregateData } | null;
  isFromRPC: boolean;
}

interface UseSalesAggregatesParams {
  periodStart: Date;
  periodEnd: Date;
  teamId?: string;
  employeeId?: string;
  clientId?: string;
  groupBy?: ('employee' | 'date' | 'week' | 'month')[];
  agentEmails?: string[];
  enabled?: boolean;
}
```

---

### Fase 3: Opret Specialiserede Wrapper Hooks

For at lette migrering og holde komponent-kode simpel:

**1. `usePersonalSalesStats.ts`** - For MyProfile, SalesGoalTracker

```typescript
export function usePersonalSalesStats(employeeId: string) {
  const { agentEmails } = useEmployeeAgentEmails(employeeId);
  return useSalesAggregatesExtended({
    periodStart: startOfMonth(new Date()),
    periodEnd: new Date(),
    agentEmails,
    groupBy: ['date'],
  });
}
```

**2. `useDashboardAggregates.ts`** - For celebration, TV dashboards

```typescript
export function useDashboardAggregates(dashboardSlug: string) {
  const clientId = getClientIdFromSlug(dashboardSlug);
  return useSalesAggregatesExtended({
    periodStart: startOfMonth(new Date()),
    periodEnd: new Date(),
    clientId,
    groupBy: ['date', 'employee'],
  });
}
```

**3. `useTeamDBStats.ts`** - For DBOverviewTab, CombinedSalaryTab

```typescript
export function useTeamDBStats(teamId: string, periodStart: Date, periodEnd: Date) {
  return useSalesAggregatesExtended({
    periodStart,
    periodEnd,
    teamId,
    groupBy: ['date', 'employee'],
  });
}
```

---

### Fase 4: Migrér Komponenter

**Prioriteret rækkefølge (letteste først):**

| # | Komponent | Nuværende Logik | Ny Hook | Kompleksitet |
|---|-----------|-----------------|---------|--------------|
| 1 | `usePreviousPeriodComparison.ts` | Manuelt reduce | `useSalesAggregates` | Lav |
| 2 | `SalesGoalTracker.tsx` | Manuelt week-query | `usePersonalSalesStats` | Lav |
| 3 | `useCelebrationData.ts` | Triple fetchAllRows | `useDashboardAggregates` | Medium |
| 4 | `CombinedSalaryTab.tsx` | fetchAllRows + reduce | `useTeamDBStats` | Medium |
| 5 | `useRecognitionKpis.ts` | Manuelt agent/dag agg | `useSalesAggregatesExtended` | Medium |
| 6 | `LiveStats.tsx` | 4x reduce patterns | `useSalesAggregatesExtended` | Høj |
| 7 | `DBOverviewTab.tsx` | Team-specifik | `useTeamDBStats` | Høj |
| 8 | `DBDailyBreakdown.tsx` | Daily grouping | `useTeamDBStats` | Høj |

---

### Fase 5: Opdater Edge Functions

**`tv-dashboard-data/index.ts`** - Brug den nye RPC i stedet for client-side aggregering:

```typescript
// Before: Manual aggregation
const totalCommission = allSales.reduce(...);

// After: Use RPC
const { data: aggregates } = await supabase.rpc('get_sales_aggregates_v2', {
  p_start: startOfDay,
  p_end: endOfDay,
  p_group_by: 'employee'
});
```

---

## Teknisk Specifikation

### SQL Migration: `get_sales_aggregates_v2`

```sql
CREATE OR REPLACE FUNCTION get_sales_aggregates_v2(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_team_id UUID DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_group_by TEXT DEFAULT 'none'
)
RETURNS TABLE (
  group_key TEXT,
  group_name TEXT,
  total_sales INTEGER,
  total_commission DECIMAL,
  total_revenue DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_sales AS (
    SELECT 
      s.id,
      s.agent_email,
      s.sale_datetime,
      si.quantity,
      si.mapped_commission,
      si.mapped_revenue,
      p.counts_as_sale
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    LEFT JOIN products p ON si.product_id = p.id
    LEFT JOIN client_campaigns cc ON s.client_campaign_id = cc.id
    LEFT JOIN agents a ON LOWER(s.agent_email) = LOWER(a.email)
    LEFT JOIN employee_agent_mapping eam ON a.id = eam.agent_id
    LEFT JOIN team_members tm ON eam.employee_id = tm.employee_id
    WHERE s.sale_datetime BETWEEN p_start AND p_end
      AND (p_team_id IS NULL OR tm.team_id = p_team_id)
      AND (p_employee_id IS NULL OR eam.employee_id = p_employee_id)
      AND (p_client_id IS NULL OR cc.client_id = p_client_id)
      AND COALESCE(s.validation_status, 'approved') NOT IN ('cancelled', 'rejected')
  )
  SELECT 
    CASE 
      WHEN p_group_by = 'employee' THEN fs.agent_email
      WHEN p_group_by = 'date' THEN DATE(fs.sale_datetime)::TEXT
      WHEN p_group_by = 'both' THEN fs.agent_email || '|' || DATE(fs.sale_datetime)::TEXT
      ELSE 'total'
    END AS group_key,
    CASE 
      WHEN p_group_by = 'employee' THEN SPLIT_PART(fs.agent_email, '@', 1)
      WHEN p_group_by = 'date' THEN TO_CHAR(DATE(fs.sale_datetime), 'YYYY-MM-DD')
      ELSE 'Total'
    END AS group_name,
    COALESCE(SUM(CASE WHEN COALESCE(fs.counts_as_sale, true) THEN fs.quantity ELSE 0 END), 0)::INTEGER,
    COALESCE(SUM(fs.mapped_commission * fs.quantity), 0),
    COALESCE(SUM(fs.mapped_revenue * fs.quantity), 0)
  FROM filtered_sales fs
  GROUP BY 
    CASE 
      WHEN p_group_by = 'employee' THEN fs.agent_email
      WHEN p_group_by = 'date' THEN DATE(fs.sale_datetime)::TEXT
      WHEN p_group_by = 'both' THEN fs.agent_email || '|' || DATE(fs.sale_datetime)::TEXT
      ELSE 'total'
    END,
    CASE 
      WHEN p_group_by = 'employee' THEN SPLIT_PART(fs.agent_email, '@', 1)
      WHEN p_group_by = 'date' THEN TO_CHAR(DATE(fs.sale_datetime), 'YYYY-MM-DD')
      ELSE 'Total'
    END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

---

## Estimeret Arbejde

| Opgave | Estimat |
|--------|---------|
| SQL: `get_sales_aggregates_v2` RPC | 30 min |
| Udvid `useSalesAggregates.ts` | 45 min |
| Opret wrapper hooks (3 stk) | 45 min |
| Migrér `usePreviousPeriodComparison` | 15 min |
| Migrér `SalesGoalTracker` | 20 min |
| Migrér `useCelebrationData` | 30 min |
| Migrér `CombinedSalaryTab` | 25 min |
| Migrér `useRecognitionKpis` | 25 min |
| Migrér `LiveStats` | 45 min |
| Migrér `DBOverviewTab` + `DBDailyBreakdown` | 60 min |
| Test og verificér | 30 min |
| **Total** | **~6 timer** |

---

## Fordele ved Konsolidering

1. **Én sandhedskilde** - Al salgsaggregering går gennem central hook
2. **Server-side beregning** - RPC reducerer client load og netværkstrafik
3. **Konsistent logik** - `counts_as_sale`, `validation_status`, `quantity * mapped_commission` håndteres ens
4. **Automatisk paginering** - `fetchAllRows` fallback indbygget
5. **Reduceret bundle size** - Duplikeret kode fjernes
6. **Lettere vedligeholdelse** - Ændringer kun ét sted
7. **Bedre performance** - Cache-deling mellem komponenter via react-query

---

## Filændringer Oversigt

### Nye Filer

```text
src/hooks/usePersonalSalesStats.ts      # Wrapper for personal data
src/hooks/useDashboardAggregates.ts     # Wrapper for dashboard/TV
src/hooks/useTeamDBStats.ts             # Wrapper for team DB stats
```

### Opdaterede Filer

```text
src/hooks/useSalesAggregates.ts         # Udvid med groupBy, agentEmails, extended interface
src/hooks/usePreviousPeriodComparison.ts # Brug central hook
src/hooks/useCelebrationData.ts         # Brug useDashboardAggregates
src/hooks/useRecognitionKpis.ts         # Brug central hook
src/components/my-profile/SalesGoalTracker.tsx  # Brug usePersonalSalesStats
src/components/salary/CombinedSalaryTab.tsx     # Brug useTeamDBStats
src/components/salary/DBOverviewTab.tsx         # Brug useTeamDBStats
src/components/salary/DBDailyBreakdown.tsx      # Brug useTeamDBStats
src/pages/LiveStats.tsx                         # Brug useSalesAggregatesExtended
```

### SQL Migrations

```text
supabase/migrations/xxx_create_get_sales_aggregates_v2.sql
```

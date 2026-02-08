
# Masterplan: Komplet Optimering + Langsigtet Skalerbarhed

## Executive Summary

Denne masterplan kombinerer **akutte databasefixes**, **kodeoptimeringer** og **langsigtet skalering** for at håndtere vækst fra nuværende ~17.000 salg til 500.000+ salg over de næste 3 år.

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│  SAMLET OVERBLIK                                                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  DATABASE CLEANUP                       │ FORVENTET GEVINST                     │
│  ───────────────────────────────────────┼─────────────────────────────────────  │
│  Login events deduplication             │ 222 MB → ~2 MB (-99%)                 │
│  kpi_cached_values VACUUM               │ 261 MB → ~5 MB (-98%)                 │
│  Log retention (30 dage)                │ ~60 MB frigivet                       │
│  Drop ubrugte indekser                  │ ~8 MB frigivet                        │
│                                                                                 │
│  KODE OPTIMERING                        │                                       │
│  ───────────────────────────────────────┼─────────────────────────────────────  │
│  FM Migration (15 filer)                │ Unified queries, -100% duplikering    │
│  TV Edge Function konsolidering         │ 2.642 LOC → ~800 LOC (-70%)           │
│  Pagination fixes (3 kritiske filer)    │ Skalerer til 100k+ salg               │
│  .single() → .maybeSingle() audit       │ -80% crash risiko (60 filer)          │
│  Console.log cleanup (edge functions)   │ 3.220 matches i 82 filer              │
│                                                                                 │
│  LANGSIGTET SKALERING                   │                                       │
│  ───────────────────────────────────────┼─────────────────────────────────────  │
│  Cursor-based pagination utility        │ Konstant performance ved vækst        │
│  Materialized views                     │ Server-side aggregering               │
│  Automatisk log retention cron          │ Forebygger bloat                      │
│                                                                                 │
│  SAMLET RESULTAT                                                                │
│  ───────────────────────────────────────────────────────────────────────────    │
│  Database: 864 MB → ~150 MB (-83%)                                              │
│  Skalerer til: 500.000+ salg over 3 år                                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Nuværende Database Status

| Tabel | Størrelse | Rækker | Problem |
|-------|-----------|--------|---------|
| kpi_cached_values | 261 MB | 2.094 | Ekstrem bloat (125 KB/række!) |
| login_events | 222 MB | 440.136 | 99%+ duplikater |
| sales | 43 MB | 17.414 | OK - aktiv data |
| integration_logs | 30 MB | 38.494 | Ingen retention policy |
| adversus_events | 24 MB | 20.871 | 15% dead tuples, ingen retention |
| kpi_leaderboard_cache | 17 MB | 76 | Mulig bloat |
| sale_items | 15 MB | 17.838 | 14% dead tuples |
| dialer_calls | 9 MB | 12.350 | OK nu (tidligere tom med bloat) |
| kpi_watermarks | 5 MB | 2 | 2.5 MB per række! |
| integration_debug_log | 3 MB | 3 | 1 MB per række! |

**Total database størrelse: 864 MB**

---

## FASE 1: Akut Database Cleanup (SQL Migrations)

### 1.1 Login Events Deduplication (KRITISK - 222 MB → ~2 MB)

```sql
-- Dedupliker: behold kun første login per bruger per dag
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY user_id, DATE(logged_in_at) 
    ORDER BY logged_in_at ASC
  ) as rn
  FROM login_events
)
DELETE FROM login_events WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Tilføj unik constraint for fremtidig beskyttelse
CREATE UNIQUE INDEX IF NOT EXISTS idx_login_events_user_session_unique 
ON login_events(user_id, session_id);
```

**Forventet resultat:** 440.136 → ~5.000 rækker

### 1.2 VACUUM Bloated Tabeller (280 MB → ~12 MB)

```sql
-- VACUUM FULL for tabeller med ekstrem bloat
VACUUM FULL kpi_cached_values;
VACUUM FULL kpi_leaderboard_cache;
VACUUM FULL kpi_watermarks;
VACUUM FULL integration_debug_log;

-- Standard VACUUM for tabeller med dead tuples
VACUUM ANALYZE sale_items;
VACUUM ANALYZE adversus_events;
VACUUM ANALYZE role_page_permissions;
```

### 1.3 Log Retention Policies (55 MB frigivet)

```sql
-- Oprydning nu
DELETE FROM integration_logs WHERE created_at < NOW() - INTERVAL '30 days';
DELETE FROM adversus_events WHERE timestamp < NOW() - INTERVAL '30 days';

-- Opret automatisk cleanup cron job
SELECT cron.schedule(
  'cleanup-old-logs',
  '0 4 * * *',
  $$
    DELETE FROM login_events WHERE logged_in_at < NOW() - INTERVAL '30 days';
    DELETE FROM integration_logs WHERE created_at < NOW() - INTERVAL '30 days';
    DELETE FROM adversus_events WHERE timestamp < NOW() - INTERVAL '30 days';
    DELETE FROM cron.job_run_details WHERE end_time < NOW() - INTERVAL '7 days';
  $$
);
```

### 1.4 Drop Ubrugte Indekser (8 MB frigivet)

| Index | Størrelse | Scans | Handling |
|-------|-----------|-------|----------|
| idx_sale_items_product_aggregation | 2.2 MB | 0 | DROP |
| adversus_events_external_id_key | 2.1 MB | 0 | DROP |
| idx_sales_adversus_external_id | 1.8 MB | 0 | DROP |

```sql
DROP INDEX IF EXISTS idx_sale_items_product_aggregation;
DROP INDEX IF EXISTS adversus_events_external_id_key;
DROP INDEX IF EXISTS idx_sales_adversus_external_id;
```

### 1.5 Drop Tomme Tabeller

Følgende tabeller er bekræftet tomme og kan fjernes:

| Tabel | Rækker | Handling |
|-------|--------|----------|
| communication_log | 0 | DROP |
| head_to_head_battles | 0 | DROP |
| employee_absence | 0 | DROP |
| time_off_request | 0 | DROP |
| weekly_goals | 0 | DROP |
| team_sales_goals | 0 | DROP |
| scheduled_team_changes | 0 | DROP |
| trusted_ip_ranges | 0 | DROP |
| failed_login_attempts | 0 | DROP |
| h2h_employee_stats | 0 | DROP |
| fixed_costs | 0 | DROP |
| transactions | 0 | DROP |
| performance_reviews | 0 | DROP |
| time_entry | 0 | DROP |
| applications | 0 | DROP |
| booking_diet | 0 | DROP |
| extra_work | 0 | DROP |
| mileage_report | 0 | DROP |

---

## FASE 2: Pagination Fixes (Kritiske for Skalering)

### 2.1 Filer der Mangler Pagination

| Fil | Problem | Nuværende | Løsning |
|-----|---------|-----------|---------|
| `src/components/salary/ClientDBTab.tsx` linje 480-498 | Direct fetch uden pagination | ~17k sales | Brug fetchAllRows |
| `src/hooks/useDashboardKpiData.ts` linje 183-196 | Ingen pagination | ~17k sales | Brug fetchAllRows |
| `src/hooks/useKpiTest.ts` | REST API uden pagination | ~17k sales | Tilføj pagination |

### 2.2 Implementering

**ClientDBTab.tsx:**
```typescript
// FRA (linje 480-490):
const { data: telesalesData } = await supabase
  .from("sales")
  .select(`...`)
  .gte("sale_datetime", periodStart.toISOString());

// TIL:
import { fetchAllRows } from "@/utils/supabasePagination";

const telesalesData = await fetchAllRows<any>(
  "sales",
  `id, client_campaign_id, client_campaigns!inner(client_id), 
   sale_items(quantity, mapped_commission, mapped_revenue)`,
  (q) => q.gte("sale_datetime", periodStart.toISOString())
          .lte("sale_datetime", periodEnd.toISOString()),
  { orderBy: "sale_datetime", ascending: false }
);
```

### 2.3 Ny Cursor-Based Pagination Utility

Tilføj til `src/utils/supabasePagination.ts`:

```typescript
export async function fetchAllRowsCursor<T = unknown>(
  table: string,
  select: string,
  filters?: (query: any) => any,
  options: {
    pageSize?: number;
    cursorColumn?: string;
    maxRows?: number;
  } = {}
): Promise<T[]> {
  const { pageSize = 500, cursorColumn = "id", maxRows } = options;
  const allData: T[] = [];
  let lastCursor: string | null = null;

  while (true) {
    if (maxRows && allData.length >= maxRows) break;

    let query = supabase
      .from(table)
      .select(select)
      .order(cursorColumn, { ascending: true })
      .limit(pageSize);

    if (lastCursor) {
      query = query.gt(cursorColumn, lastCursor);
    }
    if (filters) {
      query = filters(query);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) break;

    allData.push(...(data as T[]));
    lastCursor = (data[data.length - 1] as any)[cursorColumn];
    if (data.length < pageSize) break;
  }

  return allData;
}
```

---

## FASE 3: FM Migration Fuldførelse

### 3.1 Filer der Bruger Legacy fieldmarketing_sales Tabel (15 filer)

**Edge Functions (3 filer):**
| Fil | Antal steder |
|-----|--------------|
| `supabase/functions/calculate-kpi-values/index.ts` | 9 |
| `supabase/functions/parse-expense-formula/index.ts` | 1 |
| `supabase/functions/league-calculate-standings/index.ts` | 1 |

**Frontend (12 filer):**
| Fil | Kompleksitet | Antal steder |
|-----|--------------|--------------|
| `src/pages/vagt-flow/EditSalesRegistrations.tsx` | Høj (CRUD) | 8 |
| `src/pages/dashboards/FieldmarketingDashboardFull.tsx` | Medium | 2 |
| `src/pages/vagt-flow/FieldmarketingDashboard.tsx` | Medium (via hook) | - |
| `src/components/employee/EmployeeCommissionHistory.tsx` | Medium | 1 |
| `src/pages/dashboards/CphSalesDashboard.tsx` | Lav | 1 |
| `src/components/salary/ClientDBTab.tsx` | Lav | 1 |
| `src/components/dashboard/DailyRevenueChart.tsx` | Lav | 1 |
| `src/pages/reports/DailyReports.tsx` | Medium | 2 |
| `src/pages/reports/RevenueByClient.tsx` | Lav | 1 |
| `src/hooks/useKpiTest.ts` | Høj | 3 |
| `src/pages/MyProfile.tsx` | Lav | 2 |

### 3.2 Migrationsstrategi

```typescript
// FRA:
supabase.from("fieldmarketing_sales")
  .select("seller_id, product_name, registered_at")

// TIL:
supabase.from("sales")
  .select("id, agent_name, normalized_data, sale_datetime")
  .eq("source", "fieldmarketing")

// Field Mapping:
// seller_id → normalized_data->>'seller_id' ELLER agent_name
// product_name → normalized_data->>'product_name'
// registered_at → sale_datetime
// client_id → via client_campaign_id join
```

---

## FASE 4: TV Edge Function Konsolidering

### 4.1 Problem: 2.642 Linjer med Massive Duplikering

`tv-dashboard-data/index.ts` har 5 næsten identiske handlers:

| Handler | Linjer | Funktion |
|---------|--------|----------|
| handleEesyTmData | 211 | Eesy TV dashboard |
| handleTdcErhvervData | 303 | TDC Erhverv TV |
| handleRelatelData | 244 | Relatel TV |
| handleCsTop20Data | 473 | CS Top 20 |
| handleCelebrationData | 163 | Celebration overlay |

Plus **50+ console.log statements** som kører ved hvert request.

### 4.2 Løsning: Unified Dashboard Engine

```typescript
interface DashboardConfig {
  clientId: string;
  includeGoals: boolean;
  includeHours: boolean;
  includeCelebration: boolean;
}

const DASHBOARDS: Record<string, DashboardConfig> = {
  "eesy-tm": { clientId: "81993a7b-...", includeGoals: true, includeHours: true, includeCelebration: true },
  "tdc-erhverv": { clientId: "20744525-...", includeGoals: true, includeHours: true, includeCelebration: true },
  "relatel": { clientId: "0ff8476d-...", includeGoals: true, includeHours: false, includeCelebration: true },
};

// Shared helpers
async function fetchSalesForPeriods(supabase, clientId, periods) { ... }
async function resolveEmployees(supabase, sales) { ... }
function calculateStats(sales, employees, config) { ... }

// Én generisk handler erstatter 5 duplikerede
async function fetchDashboardData(supabase, dashboardId, periods) {
  const config = DASHBOARDS[dashboardId];
  const sales = await fetchSalesForPeriods(supabase, config.clientId, periods);
  const employees = await resolveEmployees(supabase, sales);
  return calculateStats(sales, employees, config);
}
```

**Forventet resultat:** 2.642 → ~800 linjer (-70%)

### 4.3 Cache Forbedring

```typescript
// Øg fra 15s til 30s - TV boards behøver ikke real-time
const CACHE_TTL_MS = 30000;
```

---

## FASE 5: .single() → .maybeSingle() Audit

### 5.1 Omfang
- **630 matches i 60 filer** bruger `.single()`
- Mange af disse er sikre (efter INSERT med RETURNING)
- Men mange er risikable (SELECT med WHERE der kan returnere 0 rækker)

### 5.2 Højprioritets Filer

| Fil | Risiko | Steder | Beskrivelse |
|-----|--------|--------|-------------|
| `src/hooks/useKpiTest.ts` | Høj | 6 | KPI test queries |
| `src/hooks/useDashboardKpiData.ts` | Høj | 3 | Dashboard data |
| `src/hooks/useEmployeeDashboards.ts` | Medium | 4 | Employee lookups |
| `src/hooks/useReferrals.ts` | Medium | 5 | Referral queries |
| `src/pages/vagt-flow/Billing.tsx` | Medium | 1 | Team lookup |
| `src/pages/vagt-flow/Bookings.tsx` | Medium | 1 | Team lookup |
| `src/components/salary/ClientDBTab.tsx` | Medium | 2 | Client DB queries |

### 5.3 Fix Pattern

```typescript
// RISIKABELT:
const { data, error } = await supabase
  .from("employee_master_data")
  .select("...")
  .eq("id", userId)
  .single(); // Crash hvis bruger ikke findes!

// SIKKERT:
const { data, error } = await supabase
  .from("employee_master_data")
  .select("...")
  .eq("id", userId)
  .maybeSingle();

if (!data) {
  // Håndter manglende data
}
```

---

## FASE 6: Console.log Cleanup i Edge Functions

### 6.1 Omfang
- **3.220 matches i 82 filer**

### 6.2 Prioriterede Edge Functions

| Fil | Matches | Handling |
|-----|---------|----------|
| `tv-dashboard-data/index.ts` | 50+ | Fjern alle undtagen errors |
| `enreach-manage-webhooks/index.ts` | 40+ | Fjern debug logs |
| `calculate-kpi-values/index.ts` | 30+ | Behold kun kritiske |
| `integration-engine/` | 20+ | Brug makeLogger() |

### 6.3 Pattern

```typescript
// Fjern alle debug logs:
console.log("...");

// Behold kun:
console.error("Error:", error);

// Brug struktureret logging hvor nødvendigt:
log("INFO", `Processed ${count} sales`);
```

---

## FASE 7: Cron Job Optimering

### 7.1 Nuværende Jobs (20 aktive)

| Job | Frekvens | Status |
|-----|----------|--------|
| calculate-kpi-incremental | Hvert minut | 60 kørsler/time - OK |
| calculate-leaderboard-incremental | Hvert minut | 60 kørsler/time - OK |
| dialer-*-sync (5 stk) | Hver 5. min | 12 kørsler/time hver - OK |
| process-scheduled-emails | Hvert minut | 60 kørsler/time - OK |
| adversus-sync-nightly | Kl 00-06 | **LEGACY - KAN DEPRECERES** |

### 7.2 Legacy Cron Job Deprecation

```sql
-- Fjern legacy adversus-sync-nightly (erstattet af integration-engine)
SELECT cron.unschedule('adversus-sync-nightly');
```

---

## FASE 8: Materialized Views (Langsigtet)

### 8.1 Daglige Aggregater

```sql
CREATE MATERIALIZED VIEW mv_daily_sales_stats AS
SELECT 
  DATE(sale_datetime) as sale_date,
  client_campaign_id,
  agent_email,
  COUNT(*) as sales_count,
  SUM(si.mapped_commission) as total_commission,
  SUM(si.mapped_revenue) as total_revenue
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
GROUP BY DATE(sale_datetime), client_campaign_id, agent_email
WITH DATA;

CREATE UNIQUE INDEX idx_daily_agg_unique 
ON mv_daily_sales_stats(sale_date, client_campaign_id, agent_email);

-- Refresh hver time
SELECT cron.schedule('refresh-daily-stats', '0 * * * *', $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_sales_stats;
$$);
```

---

## IMPLEMENTERINGSRÆKKEFØLGE

### Dag 1-2: Database Cleanup (FASE 1)

| Prioritet | Handling | Gevinst |
|-----------|----------|---------|
| 1 | Dedupliker login_events | 220 MB |
| 2 | VACUUM kpi_cached_values | 255 MB |
| 3 | VACUUM andre bloated tabeller | 15 MB |
| 4 | Log retention oprydning | 55 MB |
| 5 | Drop ubrugte indekser | 8 MB |
| 6 | Opret cleanup cron job | Forebyggelse |

### Dag 3: Pagination Fixes (FASE 2)

| Prioritet | Fil | Ændring |
|-----------|-----|---------|
| 7 | `src/utils/supabasePagination.ts` | Tilføj fetchAllRowsCursor |
| 8 | `src/components/salary/ClientDBTab.tsx` | Brug fetchAllRows |
| 9 | `src/hooks/useDashboardKpiData.ts` | Brug fetchAllRows |
| 10 | `src/hooks/useKpiTest.ts` | Tilføj pagination |

### Dag 4-7: FM Migration (FASE 3)

| Prioritet | Filer | Ændring |
|-----------|-------|---------|
| 11 | 3 edge functions | Migrér FM queries til sales tabel |
| 12 | `EditSalesRegistrations.tsx` | Kompleks CRUD migration |
| 13 | 11 andre frontend filer | Migrér FM queries |

### Dag 8-10: TV Edge Function Refactor (FASE 4)

| Prioritet | Handling |
|-----------|----------|
| 14 | Opret shared helpers |
| 15 | Opret DASHBOARDS config objekt |
| 16 | Konsolidér 5 handlers til 1 generisk |
| 17 | Fjern 50+ console.logs |

### Dag 11-12: Stabilitet (FASE 5-6)

| Prioritet | Handling |
|-----------|----------|
| 18 | .single() → .maybeSingle() audit (prioriterede filer) |
| 19 | Console.log cleanup i edge functions |

### Dag 13-15: Langsigtet Setup (FASE 7-8)

| Prioritet | Handling |
|-----------|----------|
| 20 | Deprecer adversus-sync-nightly cron |
| 21 | Opret mv_daily_sales_stats materialized view |
| 22 | Opret refresh cron job |
| 23 | Drop tomme tabeller |

---

## FILER DER ÆNDRES

### Database Migrations (SQL)

| Handling | Beskrivelse |
|----------|-------------|
| Dedupliker login_events | DELETE duplikater + unik constraint |
| VACUUM tabeller | kpi_cached_values, leaderboard, watermarks |
| Drop ubrugte indekser | 3 indekser |
| Opret cleanup cron job | Automatisk log retention |
| Drop tomme tabeller | 18+ tabeller |
| Opret materialized view | mv_daily_sales_stats |
| Deprecer cron job | adversus-sync-nightly |

### Edge Functions (4 filer)

| Fil | Ændring |
|-----|---------|
| `supabase/functions/tv-dashboard-data/index.ts` | Konsolidér handlers, fjern console.logs |
| `supabase/functions/calculate-kpi-values/index.ts` | FM migration |
| `supabase/functions/parse-expense-formula/index.ts` | FM migration |
| `supabase/functions/league-calculate-standings/index.ts` | FM migration |

### Frontend - Pagination (4 filer)

| Fil | Ændring |
|-----|---------|
| `src/utils/supabasePagination.ts` | Tilføj fetchAllRowsCursor |
| `src/components/salary/ClientDBTab.tsx` | Brug fetchAllRows |
| `src/hooks/useDashboardKpiData.ts` | Brug fetchAllRows |
| `src/hooks/useKpiTest.ts` | Tilføj pagination |

### Frontend - FM Migration (12 filer)

| Fil | Kompleksitet |
|-----|--------------|
| `src/pages/vagt-flow/EditSalesRegistrations.tsx` | Høj (CRUD) |
| `src/pages/dashboards/FieldmarketingDashboardFull.tsx` | Medium |
| `src/pages/vagt-flow/FieldmarketingDashboard.tsx` | Medium |
| `src/components/employee/EmployeeCommissionHistory.tsx` | Medium |
| `src/pages/dashboards/CphSalesDashboard.tsx` | Lav |
| `src/components/salary/ClientDBTab.tsx` | Lav |
| `src/components/dashboard/DailyRevenueChart.tsx` | Lav |
| `src/pages/reports/DailyReports.tsx` | Medium |
| `src/pages/reports/RevenueByClient.tsx` | Lav |
| `src/hooks/useKpiTest.ts` | Høj |
| `src/pages/MyProfile.tsx` | Lav |
| `src/hooks/useFieldmarketingSales.ts` | Medium (hook) |

### Frontend - .single() Audit (7 prioriterede filer)

| Fil | Steder |
|-----|--------|
| `src/hooks/useKpiTest.ts` | 6 |
| `src/hooks/useDashboardKpiData.ts` | 3 |
| `src/hooks/useEmployeeDashboards.ts` | 4 |
| `src/hooks/useReferrals.ts` | 5 |
| `src/pages/vagt-flow/Billing.tsx` | 1 |
| `src/pages/vagt-flow/Bookings.tsx` | 1 |
| `src/components/salary/ClientDBTab.tsx` | 2 |

---

## FORVENTET SAMLET RESULTAT

### Umiddelbart (Efter Fase 1-6)

| Metrik | Før | Efter | Forbedring |
|--------|-----|-------|------------|
| Database størrelse | 864 MB | ~150 MB | **-83%** |
| login_events | 440.136 rækker | ~5.000 | -99% |
| kpi_cached_values | 261 MB | ~5 MB | -98% |
| tv-dashboard-data LOC | 2.642 | ~800 | -70% |
| FM kode duplikering | 15 filer | 0 | -100% |
| .single() crash risiko | 60 filer | ~10 | -83% |
| Pagination-begrænsede queries | 3 kritiske | 0 | -100% |
| Edge function console.logs | 3.220 | ~100 | -97% |

### Langsigtet (1-3 år)

| Metrik | Uden plan | Med plan |
|--------|-----------|----------|
| DB ved 100k salg | ~3 GB | ~300 MB |
| DB ved 500k salg | ~15 GB | ~800 MB (+ cold storage) |
| Query tid (dashboard) | 5-10s | <2s |
| Log bloat | Ukontrolleret | Max 50 MB |
| Data retention | Manuel | Automatisk (GDPR-compliant) |

---

## TEKNISKE NOTER

### Vækstprojektion

```text
Måned        │ Salg/md  │ Kumulativ  │ Vækstfaktor
─────────────────────────────────────────────────
Jan 2025     │ 273      │ 273        │ Baseline
Jan 2026     │ 5.992    │ 17.414     │ 22x YoY
Jan 2027     │ ~15.000  │ ~100.000   │ Projekteret
Jan 2028     │ ~40.000  │ ~350.000   │ Projekteret
Jan 2029     │ ~60.000  │ ~600.000   │ Projekteret
```

### Realtime Tabeller (Ingen ændringer)

Følgende tabeller har realtime aktiveret og skal bevares:
- `sales`, `candidates`, `call_records`, `communication_logs`
- `chat_messages`, `chat_conversation_members`, `chat_message_reactions`
- `league_qualification_standings`

### Aktive Indekser (Bevar)

Disse indekser har høj aktivitet og skal bevares:
- `idx_sale_items_sale_covering` (1.86B scans)
- `idx_sale_items_sale_id` (10.16B scans)
- `sales_pkey` (102M scans)
- `idx_sales_datetime` (8.6M scans)

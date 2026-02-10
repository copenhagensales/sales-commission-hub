

# Komplet Dashboard Stabilitetsforbedring (inkl. ApiDataOverview RPC)

## Overblik

31 aendringer i 8 filer + 1 database migration. Designet til at skalere til 500.000+ raekker.

Bekraeftet datavolumen: 18.450 sales, 12.350 calls. Med 1000-raekkers graensen mister systemet op til 94% af data.

---

## Del 1: Database migration -- 3 nye RPCer

### RPC 1: `get_call_stats(start_ts, end_ts)`

Erstatter 3 row-fetch queries der henter 12.350+ raekker for at beregne AVG/SUM client-side. Returnerer 2 tal i stedet.

```sql
CREATE OR REPLACE FUNCTION get_call_stats(start_ts timestamptz, end_ts timestamptz)
RETURNS TABLE(avg_duration numeric, total_duration numeric) AS $$
  SELECT
    COALESCE(AVG(CASE WHEN duration_seconds > 0 THEN duration_seconds END), 0),
    COALESCE(SUM(duration_seconds), 0)
  FROM dialer_calls
  WHERE start_time >= start_ts AND start_time <= end_ts;
$$ LANGUAGE sql STABLE;
```

### RPC 2: `get_source_counts()`

Erstatter ApiDataOverview's hentning af 30.000+ raekker. Returnerer ~10 raekker via GROUP BY.

Inkluderer den saerlige logik hvor non-adversus sales ogsaa taelles som events:

```sql
CREATE OR REPLACE FUNCTION get_source_counts()
RETURNS TABLE(source_name text, entity_type text, cnt bigint) AS $$
  SELECT LOWER(source), 'sales', COUNT(*) FROM sales WHERE source IS NOT NULL GROUP BY LOWER(source)
  UNION ALL
  SELECT LOWER(source), 'sales_as_events', COUNT(*) FROM sales WHERE source IS NOT NULL AND LOWER(source) != 'adversus' GROUP BY LOWER(source)
  UNION ALL
  SELECT LOWER(integration_type), 'calls', COUNT(*) FROM dialer_calls WHERE integration_type IS NOT NULL GROUP BY LOWER(integration_type)
  UNION ALL
  SELECT LOWER(source), 'agents', COUNT(*) FROM agents WHERE source IS NOT NULL GROUP BY LOWER(source);
$$ LANGUAGE sql STABLE;
```

### RPC 3: `get_distinct_agent_emails_for_client(p_client_id uuid)`

Erstatter DailyReports' hentning af ALLE sales for at finde unikke emails.

```sql
CREATE OR REPLACE FUNCTION get_distinct_agent_emails_for_client(p_client_id uuid)
RETURNS TABLE(agent_email text) AS $$
  SELECT DISTINCT s.agent_email
  FROM sales s
  JOIN client_campaigns cc ON s.client_campaign_id = cc.id
  WHERE cc.client_id = p_client_id AND s.agent_email IS NOT NULL;
$$ LANGUAGE sql STABLE;
```

---

## Del 2: Fix kritiske logik-bugs i `useDashboardSalesData.ts`

### 2a: Timestamp-bug (linje 197-203, 401)

`time_stamps`-tabellen har ingen `date`-kolonne. Koden filtrerer paa `ts.date === dayStr` som altid er `undefined`.

**Fix**: Beregn dato fra `clock_in`:
```typescript
ts.clock_in && format(new Date(ts.clock_in), 'yyyy-MM-dd') === dayStr
```

### 2b: FM-sales field mismatch (linje 312-465)

FM-query henter felter der ikke eksisterer (`seller_id`, `registered_at`, `product_name`). Ingen FM-salg matches nogensinde.

**Fix**:
- Aendr select til `"id, sale_datetime, raw_payload, client_campaign_id"`
- Map `seller_id` fra `(s.raw_payload as any)?.fm_seller_id`
- Map `product_name` fra `(s.raw_payload as any)?.fm_product_name`
- Map `registered_at` fra `s.sale_datetime`

---

## Del 3: Erstat call row-fetch med RPC i `useDashboardKpiData.ts`

3 steder henter alle 12.350+ `duration_seconds`-raekker:

| Lokation | Case | Fix |
|----------|------|----|
| Linje 318-329 | `avg-call-duration` | Erstat med `get_call_stats` RPC, brug `avg_duration` |
| Linje 332-343 | `talk-time` | Erstat med `get_call_stats` RPC, brug `total_duration` |
| Linje 740-747 | `talk_time_seconds` (formula) | Erstat med `get_call_stats` RPC, brug `total_duration` |

---

## Del 4: Tilfoej `fetchAllRows` til KPI-queries i `useDashboardKpiData.ts`

### I `fetchKpiData` (linje 96-498):

| Linje | Case | Fix |
|-------|------|----|
| 232-262 | `sales-revenue` | Wrap i `fetchAllRows` |
| 266-290 | `avg-order-value` | Wrap i `fetchAllRows` |
| 454-478 | `commission` | Wrap i `fetchAllRows` |

### I `fetchMetricValueForFormula` (linje 526-753):

| Linje | Case | Fix |
|-------|------|----|
| 567-582 | `antal_salg` | Wrap i `fetchAllRows` |
| 600-614 | `commission` (formula) | Wrap i `fetchAllRows` |
| 617-633 | `revenue` (formula) | Wrap i `fetchAllRows` |

### I `useWidgetKpiData` (linje 850-1249):

| Linje | Case | Fix |
|-------|------|----|
| 982-1007 | `sales-count` | Wrap i `fetchAllRows` |
| 1037-1067 | `sales-revenue` | Wrap i `fetchAllRows` |
| 1197-1218 | `commission` | Wrap i `fetchAllRows` |

---

## Del 5: REST API paginering

### `useDashboardSalesData.ts`:

| Linje | Hvad | Fix |
|-------|------|----|
| 90 | Agent emails for klient | Tilfoej `Range: 0-9999` header |
| 286 | Salg for matchede agenter | Tilfoej `Range: 0-9999` header |

### `DailyReports.tsx`:

| Linje | Hvad | Fix |
|-------|------|----|
| 38-43 | ALLE sales for agent-lookup (ingen dato!) | Erstat med RPC `get_distinct_agent_emails_for_client` |
| 46-52 | ALLE FM sales (ingen dato!) | Tilfoej dato-filter + paginering |
| 325 | Sales i daterange | Tilfoej `Range: 0-9999` header |
| 572 | Sales for agenter | Tilfoej `Range: 0-9999` header |

---

## Del 6: ApiDataOverview -- erstat row-fetch med RPC

`ApiDataOverview.tsx` linje 36-74: Henter 18.450 sales + 12.350 calls som individuelle raekker blot for at taelle per source. Med 1000-raekkers graensen er tallene forkerte.

**Fix**: Erstat hele `queryFn` med kald til `get_source_counts()` RPC:

```typescript
const { data: rpcData } = await supabase.rpc("get_source_counts");
const eventsData = await supabase
  .from("adversus_events")
  .select("id", { count: "exact", head: true });

const sourceMap = new Map();
rpcData?.forEach(row => {
  const key = row.source_name;
  const existing = sourceMap.get(key) || { agents: 0, sales: 0, calls: 0, events: 0 };
  if (row.entity_type === 'sales') existing.sales = Number(row.cnt);
  if (row.entity_type === 'sales_as_events') existing.events += Number(row.cnt);
  if (row.entity_type === 'calls') existing.calls = Number(row.cnt);
  if (row.entity_type === 'agents') existing.agents = Number(row.cnt);
  sourceMap.set(key, existing);
});
// Adversus events fra dedicated tabel
const adversusStats = sourceMap.get("adversus") || { agents: 0, sales: 0, calls: 0, events: 0 };
adversusStats.events = eventsData.count || 0;
sourceMap.set("adversus", adversusStats);
```

Reducerer 30.000+ raekker til ~10 raekker.

---

## Del 7: Guardrail-logging i `supabasePagination.ts`

Tilfoej warning naar `fetchAllRows` returnerer mere end 5.000 raekker:

```typescript
if (allData.length >= 5000) {
  console.warn(`[fetchAllRows] HIGH VOLUME: ${allData.length} rows from ${table} - consider RPC`);
}
```

---

## Del 8: Test-vaerktoejer (lav prioritet)

### `FormulaLiveTest.tsx` (linje 403, 463, 605):
Tilfoej `Range: 0-9999` header til REST API fetch-kald.

### `useKpiTest.ts` (linje 170, 286, 435):
Tilfoej `Range: 0-9999` header til REST API fetch-kald.

---

## Implementeringsraekkefoelge

| Trin | Hvad | Effekt |
|------|------|--------|
| 1 | Database migration: 3 RPCer | Grundlag for alt andet |
| 2 | Fix timestamp-bug + FM field mismatch | Kritiske bugs der giver forkert data NU |
| 3 | Erstat call-queries med RPC | 12.350 raekker reduceret til 2 tal |
| 4 | `fetchAllRows` i alle KPI sale_items queries (9 steder) | Fjerner 1000-row afskaering |
| 5 | REST API paginering i dashboardSalesData + DailyReports (6 steder) | Fjerner tavs data-tab |
| 6 | ApiDataOverview RPC-erstatning | 30.000+ raekker reduceret til ~10 |
| 7 | Guardrail-logging | Fremtidig monitorering |
| 8 | Test-vaerktoejer paginering (6 steder) | Korrekte testresultater |

## Samlede aendringer

| Fil | Antal aendringer |
|-----|-----------------|
| Database migration (ny) | 3 RPCer |
| `src/hooks/useDashboardKpiData.ts` | 12 fixes |
| `src/hooks/useDashboardSalesData.ts` | 4 fixes |
| `src/pages/reports/DailyReports.tsx` | 4 fixes |
| `src/components/api-overview/ApiDataOverview.tsx` | 1 RPC-erstatning |
| `src/utils/supabasePagination.ts` | 1 guardrail |
| `src/components/kpi/FormulaLiveTest.tsx` | 3 fixes |
| `src/hooks/useKpiTest.ts` | 3 fixes |
| **Total** | **31 aendringer i 8 filer + 1 migration** |

## Fremtidssikring

Tre regler for alle fremtidige dashboards:
1. Aggregater (count/sum/avg): Brug ALTID SQL RPC
2. Raekkedata: Brug ALTID `fetchAllRows`
3. Guardrail: Automatisk warning ved >5.000 raekker


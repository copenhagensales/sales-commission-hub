

# Fix: Direkte FM-queries uden pagination (1000-rækkers grænse)

## Fund

Følgende 8 steder bruger direkte `supabase.from("sales")` med FM-filter UDEN `fetchAllRows`, og risikerer at miste data ved 1000+ rækker:

| # | Fil | Linje | Beskrivelse | Risiko |
|---|-----|-------|-------------|--------|
| 1 | `src/pages/reports/DailyReports.tsx` | 333 | FM-sælger lookup (raw_payload) | HOJ - alle FM-salg i perioden |
| 2 | `src/pages/reports/DailyReports.tsx` | 653 | Hoved FM-salgs query | HOJ - alle FM-salg i perioden |
| 3 | `src/pages/dashboards/CphSalesDashboard.tsx` | 411 | FM sales for "Salg per opgave" | HOJ - en måneds FM-salg |
| 4 | `src/pages/dashboards/CphSalesDashboard.tsx` | 814 | FM sales for team performance | HOJ - en måneds FM-salg |
| 5 | `src/pages/vagt-flow/FieldmarketingDashboard.tsx` | 113 | Måneds-sælger stats | MIDDEL - filtreret på klient |
| 6 | `src/pages/vagt-flow/FieldmarketingDashboard.tsx` | 163 | Dags-sælger stats | LAV - kun en dag |
| 7 | `src/hooks/useKpiTest.ts` | 351-362 | FM commission beregning | MIDDEL - test/debug tool |
| 8 | `src/hooks/useKpiTest.ts` | 499-510 | FM revenue beregning | MIDDEL - test/debug tool |

### Allerede sikre (bruger fetchAllRows eller count-only):
- `EditSalesRegistrations.tsx` (linje 137) - bruger `fetchAllRows` KORREKT
- `useDashboardSalesData.ts` (linje 307) - bruger `fetchAllRows` KORREKT
- `useFieldmarketingSales.ts` (linje 154) - bruger `count: "exact", head: true` (ingen data)
- `useKpiTest.ts` (linje 202) - bruger `count: "exact"` (ingen data)
- `MyProfile.tsx` (linje 739, 749) - filtreret på enkelt sælger, aldrig 1000+

## Plan

### Fil 1: `src/pages/reports/DailyReports.tsx` (2 steder)

**Linje 333-338**: Erstat direkte query med `fetchAllRows`:
```typescript
const fmSellersForClient = await fetchAllRows<{ raw_payload: any }>(
  "sales", "raw_payload",
  (q) => q.eq("source", "fieldmarketing")
    .gte("sale_datetime", `${startStr}T00:00:00`)
    .lte("sale_datetime", `${endStr}T23:59:59`),
  { orderBy: "sale_datetime", ascending: false }
);
```

**Linje 653-666**: Erstat direkte query med `fetchAllRows`:
```typescript
const rawFmSalesData = await fetchAllRows<{
  id: string; agent_name: string; sale_datetime: string;
  raw_payload: any; client_campaign_id: string | null;
}>(
  "sales",
  "id, agent_name, sale_datetime, raw_payload, client_campaign_id",
  (q) => q.eq("source", "fieldmarketing")
    .gte("sale_datetime", `${startStr}T00:00:00`)
    .lte("sale_datetime", `${endStr}T23:59:59`),
  { orderBy: "sale_datetime", ascending: false }
);
```

### Fil 2: `src/pages/dashboards/CphSalesDashboard.tsx` (2 steder)

**Linje 411-418**: Erstat med `fetchAllRows`:
```typescript
const fmSales = await fetchAllRows<{
  id: string; agent_name: string; normalized_data: any;
  sale_datetime: string; client_campaign_id: string | null;
}>(
  "sales",
  "id, agent_name, normalized_data, sale_datetime, client_campaign_id",
  (q) => q.eq("source", "fieldmarketing")
    .gte("sale_datetime", startOfPeriod)
    .lte("sale_datetime", endOfPeriod),
  { orderBy: "sale_datetime", ascending: false }
);
```

**Linje 814-819**: Erstat med `fetchAllRows`:
```typescript
const fmSalesData = await fetchAllRows<{
  id: string; agent_name: string; raw_payload: any; sale_datetime: string;
}>(
  "sales",
  "id, agent_name, raw_payload, sale_datetime",
  (q) => q.eq("source", "fieldmarketing")
    .gte("sale_datetime", `${monthStart}T00:00:00`)
    .lte("sale_datetime", `${todayStr}T23:59:59`),
  { orderBy: "sale_datetime", ascending: false }
);
```

### Fil 3: `src/pages/vagt-flow/FieldmarketingDashboard.tsx` (2 steder)

**Linje 113-122**: Erstat måneds-query med `fetchAllRows`:
```typescript
const monthSales = await fetchAllRows<{
  agent_name: string; raw_payload: any; sale_datetime: string;
}>(
  "sales",
  "agent_name, raw_payload, sale_datetime",
  (q) => q.eq("source", "fieldmarketing")
    .contains("raw_payload", { fm_client_id: clientId })
    .gte("sale_datetime", monthStart),
  { orderBy: "sale_datetime", ascending: false }
);
```

**Linje 163-173**: Erstat dags-query med `fetchAllRows` (for konsistens):
```typescript
const daySales = await fetchAllRows<{
  agent_name: string; raw_payload: any; sale_datetime: string;
}>(
  "sales",
  "agent_name, raw_payload, sale_datetime",
  (q) => q.eq("source", "fieldmarketing")
    .contains("raw_payload", { fm_client_id: clientId })
    .gte("sale_datetime", dayStart)
    .lte("sale_datetime", dayEnd),
  { orderBy: "sale_datetime", ascending: false }
);
```

### Fil 4: `src/hooks/useKpiTest.ts` (2 steder)

**Linje 351-362**: FM commission query - erstat med `fetchAllRows`
**Linje 499-510**: FM revenue query - erstat med `fetchAllRows`

## Samlet oversigt

| Fil | Antal ændringer |
|-----|----------------|
| `DailyReports.tsx` | 2 queries -> `fetchAllRows` |
| `CphSalesDashboard.tsx` | 2 queries -> `fetchAllRows` |
| `FieldmarketingDashboard.tsx` | 2 queries -> `fetchAllRows` |
| `useKpiTest.ts` | 2 queries -> `fetchAllRows` |

**Total: 8 queries opdateres til pagineret fetch**

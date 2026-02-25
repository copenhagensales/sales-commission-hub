

## Migrér Sælgerlønninger fra KPI-cache til live beregning

### Problem

`useSellerSalariesCached.ts` henter provision fra `kpi_cached_values` (aktuel periode) og `kpi_period_snapshots` (historisk). Disse caches opdateres asynkront og kan afvige fra de faktiske `sale_items.mapped_commission`-værdier, som Dagsrapporter bruger direkte.

### Løsning

Erstat Query 2 (linje 98-129) med et kald til `useSalesAggregatesExtended`, som kalder `get_sales_aggregates_v2` RPC'en. Denne beregner live fra `sale_items.mapped_commission` — samme kilde som Dagsrapporter.

### Teknisk plan (1 fil)

**`src/hooks/useSellerSalariesCached.ts`:**

1. Importér `useSalesAggregatesExtended` fra `@/hooks/useSalesAggregatesExtended`.
2. Erstat Query 2 (`kpi_cached_values`/`kpi_period_snapshots`) med:
   ```ts
   const { data: salesAggregates, isLoading: commissionLoading } = useSalesAggregatesExtended({
     periodStart: periodStart ?? new Date(),
     periodEnd: periodEnd ?? new Date(),
     groupBy: ['employee'],
     enabled: !!periodStart && !!periodEnd,
   });
   ```
3. Byg `commissionMap` fra `salesAggregates.byEmployee` i stedet for fra cache-data. RPC'ens `group_key` er allerede `employee_id` (UUID), så det mapper direkte til `emp.id`.
4. Slet dead code: `isCurrentPayrollPeriod()`, `buildPeriodKey()`, `isCurrent`, `periodKey`.
5. Behold `toLocalDateString()` — bruges stadig af diet/sick/bonus queries.

### Mapping-detalje

RPC'en (`get_sales_aggregates_v2`) joiner allerede `employee_agent_mapping` → `agents` for at resolve `employee_id`. Når `group_by = 'employee'`, er `group_key = eam.employee_id::text` — præcis det UUID der matches mod `emp.id` i `commissionMap`. Ingen ekstra agent-email-query nødvendig.

### Ingen ændringer i andre filer

- `SellerSalariesTab.tsx` forbruger stadig `SellerData[]` — interfacet er uændret.
- Queries 3-6 (feriepenge, diet, sygdom, dagsbonus) forbliver uændrede.

### Performance

- RPC'en kører en enkelt aggregeret SQL-forespørgsel med JOINs — hurtigere end at hente tusindvis af rækker client-side.
- Historiske perioder håndteres identisk (RPC accepterer vilkårlige datoer).
- `staleTime: 60000` fra `useSalesAggregatesExtended` giver rimelig caching uden drift.


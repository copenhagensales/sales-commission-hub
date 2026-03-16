

## Fix: Lucas' beregner viser 0 – brug live-data i stedet for cache

### Problem
`MyGoals.tsx` henter Lucas' provision og salgstal fra **cached KPIs** (`usePrecomputedKpis`), som opdateres af `calculate-kpi-incremental` edge-funktionen. Denne cache kan have problemer med agent-mapping for specifikke medarbejdere, hvilket resulterer i 0-værdier. Derudover henter `SalesGoalTracker` ugens provision via `agent_name`-match (linje 151-158), som kun virker for medarbejdere med en specifik agent-mapping og et matchende navn.

### Løsning
Erstat cached KPIs med **live-data** via `usePersonalSalesStats`, som bruger den centrale `useSalesAggregatesExtended`-hook. Denne hook resolver agent-emails korrekt (via `employee_agent_mapping` + `work_email` fallback) og henter direkte fra databasen.

### Ændringer

**1. `src/pages/MyGoals.tsx`**
- Fjern `usePrecomputedKpis` og `getKpiValue` imports/calls
- Tilføj `usePersonalSalesStats(employee.id, payrollPeriod.start, payrollPeriod.end)`
- Send live-data til `SalesGoalTracker` via `commissionStats`

**2. `src/components/my-profile/SalesGoalTracker.tsx`**
- Fjern den separate `weekSalesData` useQuery (linje 141-170) som bruger `agent_name`-match
- Erstat med data fra `usePersonalSalesStats` (som allerede beregner ugens total korrekt)
- Tilføj `weekTotal` til `SalesGoalTrackerProps` og brug den i stedet

### Fordele
- Salgstal opdateres live uden at afvente cache-opfriskning
- Agent-identitet resolves korrekt for alle medarbejdere (inkl. Lucas)
- Fjerner en redundant og fejlbehæftet database-query


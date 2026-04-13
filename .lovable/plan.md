

## Eksekveringsplan: Big-bang deploy — Fordel kunder, medarbejdere & stempelur

### Hvad vi bygger

Tre sammenhængende systemer deployet i én release med feature flag:

1. **`employee_client_assignments`** — eksplicit mapping af medarbejdere til kunder (inkl. kryds-team)
2. **`employee_time_clocks`** — stempelur som selvstændig entitet med 3 typer (override/documentation/revenue)
3. **Feature flag** — `feature_flags` tabel med `employee_client_assignments` nøgle, starter OFF

### Fase 1: DB-migration (1 migration)

```sql
-- Feature flag tabel
CREATE TABLE public.feature_flags (key text PK, enabled boolean DEFAULT false);
INSERT INTO feature_flags VALUES ('employee_client_assignments', false);

-- Clock type enum
CREATE TYPE public.clock_type AS ENUM ('override', 'documentation', 'revenue');

-- Employee-client assignments
CREATE TABLE public.employee_client_assignments (
  id uuid PK, employee_id FK→employee_master_data, client_id FK→clients,
  UNIQUE(employee_id, client_id)
);

-- Employee time clocks
CREATE TABLE public.employee_time_clocks (
  id uuid PK, employee_id FK→employee_master_data, client_id FK→clients (nullable),
  clock_type clock_type NOT NULL, hourly_rate numeric DEFAULT 0,
  is_active boolean DEFAULT true, created_at, created_by FK→auth.users
);

-- Eksklusive kunder pr. team
ALTER TABLE public.team_clients ADD CONSTRAINT unique_client_per_team UNIQUE (client_id);

-- Backfill: alle nuværende team_members × team_clients
INSERT INTO employee_client_assignments (employee_id, client_id)
SELECT DISTINCT tm.employee_id, tc.client_id
FROM team_members tm JOIN team_clients tc ON tc.team_id = tm.team_id;

-- 5 triggers (auto-assignment logik)
-- RLS policies på begge nye tabeller
```

**`hours_source` beholdes midlertidigt** i DB under hypercare. Fjernes efter 1 uge.

### Fase 2: Ny infrastruktur (4 nye filer)

| Fil | Formål |
|-----|--------|
| `src/hooks/useFeatureFlag.ts` | React Query hook: `useFeatureFlag('employee_client_assignments')` |
| `src/lib/resolveHoursSource.ts` | Central resolver: checker `employee_time_clocks` → fallback til vagtplan |
| `src/hooks/useEmployeeClientAssignments.ts` | CRUD hook for assignments |
| `src/hooks/useEmployeeTimeClocks.ts` | CRUD hook for stempelure |

### Fase 3: UI — TeamsTab opdeling (1 fil + 1 ny komponent)

**`TeamsTab.tsx`** — Opdel "Kunder"-fanen i:
- **Fordel kunder**: Tildel kunder til teamet (nedtonede kunder i andre teams)
- **Fordel medarbejdere**: Checkbox pr. medarbejder/kunde + "Andre kunder" sektion for kryds-team

**`TeamTimeClockTab.tsx`** (ny) — Stempelur-fane i Rediger team:
- Liste over aktive stempelure
- Tilføj: vælg medarbejder → kunde → type → evt. timesats
- Redigér/slet

### Fase 4: Downstream — hours_source erstatning (12 filer, bag feature flag)

Alle filer wrapper ny logik med `useFeatureFlag`:
- **Flag ON**: Brug `resolveHoursSource()` → checker `employee_time_clocks`
- **Flag OFF**: Brug legacy `hours_source` fra `team_standard_shifts`

Filer: `useDashboardSalesData`, `useStaffHoursCalculation`, `useAssistantHoursCalculation`, `useKpiTest`, `DailyReports`, `ShiftOverview`, `MySchedule`, `MyScheduleTabContent`, `VagtplanFMContent`, `EmployeeCommissionHistory`, `FormulaLiveTest`, `useEffectiveHourlyRate`

### Fase 5: Forecast/KPI → assignments (4 filer, bag flag)

`useClientForecast`, `useTeamGoalForecast`, `useDashboardSalesData`, `useDashboardKpiData` — filtrér medarbejdere via `employee_client_assignments` i stedet for `team_members` alene.

### Fase 6: FM booking → assignments (4 filer, bag flag)

`CapacityPanel`, `EditBookingDialog`, `AddEmployeeDialog`, `BookingsContent` — kun tildelte medarbejdere for valgt klient.

### Fase 7: Løn & profil (3 filer, bag flag)

`useAssistantHoursCalculation`, `ClientDBTab`, `useEffectiveHourlyRate`

### Fase 8: Edge functions (2 filer)

`calculate-kpi-values/index.ts`, `tv-dashboard-data/index.ts` — respektér `employee_time_clocks` for timer-beregning.

### Fase 9: Fjern toggle fra TeamStandardShifts

Fjern Vagtplan/Indstempling toggle (linje 1311-1337). `hours_source` skrives ikke længere.

---

### Aktiveringsflow (efter deploy)

1. **Preflight**: Verificér backfill row count, ingen duplicates, ingen revenue clocks med rate=0
2. **Aktivér**: `UPDATE feature_flags SET enabled = true WHERE key = 'employee_client_assignments'`
3. **Smoke test**: TeamsTab, stempelur, KPI, FM booking, løn
4. **Hypercare 48t**: Overvåg fejlrate, nul-timer, KPI-afvigelser
5. **Cleanup (1 uge)**: Fjern `hours_source` kolonner, fjern feature flag dual-read, fjern legacy kode

### Samlet scope

```text
1 DB-migration (2 tabeller + 1 enum + 1 constraint + backfill + 5 triggers + feature_flags)
4 nye filer (useFeatureFlag, resolveHoursSource, useEmployeeClientAssignments, useEmployeeTimeClocks)
1 ny komponent (TeamTimeClockTab)
1 stor opdatering (TeamsTab.tsx)
1 toggle-fjernelse (TeamStandardShifts.tsx)
12 downstream hours_source filer
4 forecast/KPI filer
4 FM booking filer
3 løn/profil filer
2 edge functions
= ~32 fil-ændringer
```




# Kundeforecast — Nyt forecast-modul

## Overblik

Nyt menupunkt "Forecast" i dashboards-sektionen med et professionelt B2B-dashboard der viser kapacitetsbaseret salgsforecast pr. kunde/kampagne. Bygges med mock data + typed beregninger, klar til backend-kobling.

## Eksisterende assets vi genbruger

- **`useTeamGoalForecast`** — allerede har shift-counting, absence-håndtering og performance-per-employee logik. Vi genbruger mønstret.
- **`onboarding_cohorts`** — eksisterende tabel med hold, startdato, team, capacity. Vi bygger forecast-cohorts som ny tabel.
- **`ChurnCalculator`** — eksisterende churn-beregning i CompanyOverview. Vi genbruger churn-data patterns.
- **Shift/absence data** — allerede tilgængelig via shift, employee_standard_shifts, absence_request_v2.

## Forbedringsforslag til din spec

1. **Brug "opgave" = `client_campaign`** som forecast-enhed, ikke bare client. Det giver granularitet pr. kampagne.
2. **Ramp-profiler bør have en default** pr. team/opgavetype, ikke kun manuelt oprettede. Systemet kan auto-beregne fra historisk data.
3. **Churn-profiler kan auto-genereres** fra eksisterende employee_master_data (employment_start_date + employment_end_date). Du har allerede dataen.
4. **Performance-vægtning**: Exponential weighted moving average (EWMA) over seneste 8 uger er bedre end faste buckets.
5. **Attendance-faktor bør være per-team**, ikke global. I har allerede absence-data grupperet pr. team.
6. **Forecast vs actual** kan kobles direkte til jeres `kpi_cached_values` eller `sales`-tabel for tidligere perioder.

## Database (4 nye tabeller)

### Migration SQL

```sql
-- Ramp profiles: how fast new hires reach full productivity
CREATE TABLE forecast_ramp_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_campaign_id uuid REFERENCES client_campaigns(id),
  day_1_7_factor numeric DEFAULT 0.15,
  day_8_14_factor numeric DEFAULT 0.35,
  day_15_30_factor numeric DEFAULT 0.60,
  day_31_60_factor numeric DEFAULT 0.85,
  steady_state_factor numeric DEFAULT 1.0,
  created_at timestamptz DEFAULT now()
);

-- Survival/churn profiles per campaign
CREATE TABLE forecast_survival_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_campaign_id uuid REFERENCES client_campaigns(id),
  survival_day_7 numeric DEFAULT 0.90,
  survival_day_14 numeric DEFAULT 0.82,
  survival_day_30 numeric DEFAULT 0.72,
  survival_day_60 numeric DEFAULT 0.65,
  created_at timestamptz DEFAULT now()
);

-- Forecast cohorts (manually added new starter groups)
CREATE TABLE client_forecast_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) NOT NULL,
  client_campaign_id uuid REFERENCES client_campaigns(id),
  start_date date NOT NULL,
  planned_headcount int NOT NULL DEFAULT 5,
  ramp_profile_id uuid REFERENCES forecast_ramp_profiles(id),
  survival_profile_id uuid REFERENCES forecast_survival_profiles(id),
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Stored forecast snapshots
CREATE TABLE client_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) NOT NULL,
  client_campaign_id uuid REFERENCES client_campaigns(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  forecast_sales_low int,
  forecast_sales_expected int,
  forecast_sales_high int,
  forecast_hours numeric,
  forecast_heads numeric,
  churn_loss numeric,
  absence_loss numeric,
  drivers_json jsonb DEFAULT '{}',
  calculated_at timestamptz DEFAULT now()
);

ALTER TABLE forecast_ramp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_survival_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_forecast_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_forecasts ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users with owner/teamleder access
CREATE POLICY "Managers can manage ramp profiles" ON forecast_ramp_profiles
  FOR ALL TO authenticated USING (
    public.is_owner(auth.uid()) OR public.is_teamleder_or_above(auth.uid())
  );
CREATE POLICY "Managers can manage survival profiles" ON forecast_survival_profiles
  FOR ALL TO authenticated USING (
    public.is_owner(auth.uid()) OR public.is_teamleder_or_above(auth.uid())
  );
CREATE POLICY "Managers can manage forecast cohorts" ON client_forecast_cohorts
  FOR ALL TO authenticated USING (
    public.is_owner(auth.uid()) OR public.is_teamleder_or_above(auth.uid())
  );
CREATE POLICY "Managers can view forecasts" ON client_forecasts
  FOR ALL TO authenticated USING (
    public.is_owner(auth.uid()) OR public.is_teamleder_or_above(auth.uid())
  );
```

## Fil-struktur

```text
src/
├── pages/
│   └── Forecast.tsx                    # Hovedside
├── components/forecast/
│   ├── ForecastKpiCards.tsx             # Top KPI-kort (6 stk)
│   ├── ForecastClientSelector.tsx      # Kunde/kampagne-vælger
│   ├── ForecastBreakdownTable.tsx      # Per-employee + per-cohort breakdown
│   ├── ForecastDriversPanel.tsx        # Hvad driver forecastet
│   ├── ForecastCohortManager.tsx       # Liste + opret nye hold
│   ├── CreateCohortDialog.tsx          # Modal til nyt opstartshold
│   ├── ForecastVsActualChart.tsx       # Historisk accuracy
│   ├── ForecastIntervalBadge.tsx       # Low/Expected/High badges
│   └── ForecastAssumptions.tsx         # Accordion med alle antagelser
├── hooks/
│   └── useClientForecast.ts            # Hovedhook: beregn forecast
├── lib/calculations/
│   └── forecast.ts                     # Pure forecast-beregninger
└── types/
    └── forecast.ts                     # Type definitions
```

## Beregningslogik (`lib/calculations/forecast.ts`)

### Etablerede sælgere
```
ewma_sales_per_hour = Σ(weekly_sph × weight) / Σ(weight)
  weight = decay^(weeks_ago), decay = 0.85
forecast = planned_hours × ewma_sph × personal_attendance_factor
```

### Nye cohorts
```
For each week in forecast period:
  days_since_start = week_start - cohort_start
  ramp = lookup ramp_factor for days_since_start
  survival = interpolate survival curve
  effective_heads = planned_headcount × survival × ramp
  hours = effective_heads × weekly_hours_per_head
  sales = hours × campaign_baseline_sph × attendance_factor
```

### Interval (Low/Expected/High)
- **Expected** = sum of all employee + cohort forecasts
- **Low** = Expected × 0.85 (P20 scenario)
- **High** = Expected × 1.12 (P80 scenario)
- Faktorer justeres baseret på historisk forecast-accuracy hvis tilgængelig

### Attendance
- Etablerede: personlig absence rate (seneste 90 dage)
- Nye: team/kampagne gennemsnit

## Implementeringsplan (9 trin)

1. **Database migration** — Opret 4 tabeller med RLS
2. **Types** — `src/types/forecast.ts` med alle interfaces
3. **Forecast calculation lib** — `src/lib/calculations/forecast.ts` med pure functions + mock data fallback
4. **useClientForecast hook** — Henter data fra DB, kalder beregninger
5. **Forecast page** — `src/pages/Forecast.tsx` med layout, selector, alle sektioner
6. **KPI Cards + Drivers** — Top-overblik med interval badges
7. **Cohort Manager** — CRUD for nye opstartshold
8. **Breakdown table + Forecast vs Actual** — Detaljerede tabeller/grafer
9. **Routing + permissions** — Tilføj til routes, sidebar, permission keys

## Design

- Card-baseret layout med 6 KPI-kort øverst (grid 3×2)
- Interval badges: `<Badge variant="outline">Low: 280</Badge>` etc.
- Drivers som accordion med ikoner og forklaringer
- Breakdown som sortérbar tabel med employee-rækker og cohort-rækker
- Forecast vs Actual som bar chart (recharts) med accuracy-procent
- Cohort-liste med inline-status og "Tilføj hold"-knap der åbner dialog
- Tooltips på alle tal der forklarer beregningen




# Uge-forecast for Eesy FM med markeder/centre

## Hvad
En ny sektion/side der viser **uge-for-uge forecast** for Eesy FM, baseret på faktiske bookinger. Hver uge viser:
- Antal bookede lokationer (opdelt i centre vs. markeder)
- Antal bookede dage (inkl. weekender)
- Bemanding pr. uge
- Forventet salg pr. uge (baseret på medarbejder-performance × bookede dage)
- Faktiske salg (når ugen er i gang/afsluttet)

## Hvorfor
FM-arbejdet er uge-drevet og afhænger af hvad der er booket (centre har anden performance end markeder). Weekendarbejde er normalt. Et månedligt forecast fanger ikke denne dynamik.

## Teknisk plan

### 1. Ny hook: `useFmWeeklyForecast.ts`
- Input: `clientId`, `month`/`year` (eller en dato-range)
- Henter bookinger fra `booking`-tabellen for Eesy FM klienten, joinet med `location` (for `type`) og `booking_assignment` (for faktisk bemanding)
- Grupperer pr. `week_number` + `year`
- For hver uge:
  - Tæller bookede dage (`booked_days` array-længde), opdelt efter `location.type` (centre vs. markeder)
  - Tæller unikke medarbejdere fra `booking_assignment`
  - Beregner forventet salg: henter SPH/salg-pr-dag fra `useClientForecast` eller beregner direkte fra historisk data
  - Henter faktiske salg fra `sales`-tabellen for den uge
- Returnerer `WeekForecast[]` med alle metrics

### 2. Ny komponent: `FmWeeklyForecastTable.tsx`
- Tabel med én række pr. uge i den valgte måned
- Kolonner: Uge nr., Dage (centre), Dage (markeder), Total dage, Medarbejdere, Forventet salg, Faktisk salg, Afvigelse
- Farvekodning: grøn/rød baseret på actual vs. forecast
- Mulighed for at **manuelt overskrive forventet salg pr. uge** (genbruger `employee_forecast_overrides`-konceptet, men på ugeniveau)
- Sumrække i bunden

### 3. Ny tabel: `fm_weekly_forecast_overrides` (migration)
```sql
CREATE TABLE public.fm_weekly_forecast_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  year integer NOT NULL,
  override_sales integer,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, week_number, year)
);
ALTER TABLE public.fm_weekly_forecast_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can manage fm weekly overrides"
  ON public.fm_weekly_forecast_overrides FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

### 4. Integration i Forecast-siden
- Når Eesy FM er valgt som kunde på `/forecast`, vis en ny sektion **"Ugefordeling"** mellem KPI-kort og breakdown-tabellen
- Viser `FmWeeklyForecastTable` med data fra hooken
- Periode-toggle (denne/næste måned) genbruges

### 5. Data-flow
```text
booking (week_number, year, location_id, booked_days, client_id)
  → JOIN location (type: "Coop butik" | "Markeder" | ...)
  → JOIN booking_assignment (employee_id, date)
  → GROUP BY week_number
  
sales (sale_datetime, client_campaign_id)
  → filtrer på Eesy FM campaigns
  → GROUP BY ISO week
```

## Berørte filer

| Fil | Ændring |
|-----|---------|
| Migration | Ny `fm_weekly_forecast_overrides` tabel |
| `src/hooks/useFmWeeklyForecast.ts` | Nyt hook: bookinger + salg pr. uge |
| `src/components/forecast/FmWeeklyForecastTable.tsx` | Ny komponent: uge-tabel med override |
| `src/pages/Forecast.tsx` | Vis ugefordeling når FM-kunde er valgt |




# Manuel forecast-override pr. medarbejder

## Hvad
Tilføj muligheden for at overskrive den beregnede forecast for individuelle medarbejdere direkte i `ForecastBreakdownTable` på Kundeforecast-siden. Overrides gemmes i databasen, så de overlever sidegenindlæsning og kan ses af andre brugere.

## Hvordan det virker

1. I forecast-tabellen vises et lille blyant-ikon ved forecast-tallet for hver medarbejder
2. Klik åbner en inline-redigering (input-felt) eller en lille dialog, hvor man kan indtaste et manuelt tal
3. Det manuelle override gemmes i en ny tabel og bruges i stedet for den beregnede værdi
4. Et visuelt hint (f.eks. badge/farve) viser at værdien er manuelt overridden
5. Man kan fjerne override'et og gå tilbage til beregnet forecast

## Teknisk plan

### 1. Ny databasetabel: `employee_forecast_overrides`

```sql
CREATE TABLE public.employee_forecast_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employee_master_data(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  period_start date NOT NULL, -- Første dag i måneden (YYYY-MM-01)
  override_sales integer NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, client_id, period_start)
);

ALTER TABLE public.employee_forecast_overrides ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read/write (manager-level access kontrolleres i frontend)
CREATE POLICY "Authenticated can manage overrides"
  ON public.employee_forecast_overrides FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### 2. Hook: `useEmployeeForecastOverrides`
- Henter overrides for den aktuelle client + periode
- Mutation for upsert og sletning
- Returnerer et `Map<employeeId, overrideSales>`

### 3. `ForecastBreakdownTable` ændringer
- Modtag nye props: `overrides: Map<string, number>`, `onOverride(employeeId, value | null)`, `clientId`, `periodStart`
- Ved forecast-kolonnen: vis override-værdi med blåt highlight + blyant-ikon
- Klik → inline input til nyt tal med gem/annuller
- Lille "×" knap til at fjerne override

### 4. `useClientForecast` / `Forecast.tsx` ændringer
- Hent overrides for den valgte client + periode
- Anvend overrides på `forecastSales` i resultatet, så KPI-kort og totaler afspejler de manuelle værdier
- Behold den beregnede værdi tilgængelig (vises som tooltip)

### 5. Visuel indikation
- Overridden forecast vises med blå baggrund og "Manuel" badge
- Tooltip viser: "Beregnet: X | Manuel: Y"

## Berørte filer

| Fil | Ændring |
|-----|---------|
| Migration | Ny `employee_forecast_overrides` tabel |
| `src/hooks/useEmployeeForecastOverrides.ts` | Nyt hook (fetch + upsert + delete) |
| `src/components/forecast/ForecastBreakdownTable.tsx` | Inline edit UI for overrides |
| `src/pages/Forecast.tsx` | Hent overrides, apply på forecast data, send som props |


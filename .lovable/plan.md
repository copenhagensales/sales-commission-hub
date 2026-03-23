

# Tilføj manuelt kundetarget på Kundeforecast

## Oversigt
Tilføj et felt på forecast-siden hvor man kan indtaste kundens salgstarget for den valgte periode. Targetet gemmes pr. kunde pr. måned i databasen og vises i summary-kortet som sammenligning med forecastet.

## Ændringer

### 1. Database: Ny tabel `client_monthly_targets`
Migration der opretter:
```sql
CREATE TABLE public.client_monthly_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  period_start date NOT NULL,
  target_sales integer NOT NULL,
  note text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, period_start)
);
ALTER TABLE public.client_monthly_targets ENABLE ROW LEVEL SECURITY;
-- Policy: authenticated users can CRUD
CREATE POLICY "Authenticated users can manage targets"
  ON public.client_monthly_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### 2. `ForecastSummary.tsx` — Vis target + inputfelt
- Tilføj props: `clientTarget?: number`, `onTargetChange?: (target: number) => void`, `isLoadingTarget?: boolean`
- Vis under forecast-tallet: "Kundetarget: X salg" med en inline edit-knap
- Når der klikkes, vis et lille inputfelt med gem-knap
- Vis forskel: forecast vs. target (f.eks. "+12 over target" eller "-8 under target") med farveindikation (grøn/rød)

### 3. `Forecast.tsx` — Hent og gem target
- Tilføj `useQuery` for at hente `client_monthly_targets` for valgt kunde + periode
- Tilføj `useMutation` for upsert af target (INSERT ON CONFLICT UPDATE)
- Send `clientTarget` og `onTargetChange` til `ForecastSummary`
- Vis kun target-feltet når en specifik kunde er valgt (ikke "alle kunder")

| Fil | Ændring |
|-----|---------|
| Migration SQL | Opret `client_monthly_targets` tabel |
| `src/components/forecast/ForecastSummary.tsx` | Vis target + inline redigering + afvigelse |
| `src/pages/Forecast.tsx` | Hent/gem target, send til ForecastSummary |



# Analyse: Hvorfor TDC Erhverv Dashboard viser "Ingen salg"

## Root Cause Identificeret

### Tidslinje for problemet:
1. **18:00:08** - KPI Full Refresh kørte og opdaterede `kpi_leaderboard_cache` (inkl. TDC Erhverv "today" = 0 entries)
2. **18:11:45** - TDC Erhverv salg blev synkroniseret til databasen (12 salg)
3. **18:18:49** - Du ser på dashboardet → viser **cached data fra 18:00** = "Ingen salg"
4. **18:30:xx** - Næste Full Refresh vil opdatere leaderboards med de nye salg

### Kerneproblemet
**Den inkrementelle KPI-beregning (hvert minut) opdaterer KUN `kpi_cached_values` (employee-scoped data) - men IKKE `kpi_leaderboard_cache` som dashboardet bruger.**

```text
┌─────────────────────────────────────────────────────────────────┐
│                    NUVÆRENDE ARKITEKTUR                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  calculate-kpi-incremental (hvert minut)                        │
│  └─ Opdaterer: kpi_cached_values (employee KPIs)                │
│  └─ OPDATERER IKKE: kpi_leaderboard_cache ← Problem!            │
│                                                                 │
│  calculate-kpi-values (hver 30. minut)                          │
│  └─ Opdaterer: kpi_cached_values (alle scopes)                  │
│  └─ Opdaterer: kpi_leaderboard_cache (global, team, client)     │
│                                                                 │
│  TDC Dashboard                                                  │
│  └─ Læser fra: kpi_leaderboard_cache (client-scoped)            │
│  └─ Kan være op til 30 minutter forsinket!                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Løsninger

### Option A: Tilføj Leaderboard-opdatering til Incremental Function (Anbefalet)
Udvid `calculate-kpi-incremental` til også at opdatere leaderboard-cache for berørte perioder:

```typescript
// Efter KPI values er opdateret, genberegn leaderboards for today og payroll_period
const affectedPeriods = ["today", "payroll_period"];
const affectedScopes = ["global", "client", "team"];

for (const period of affectedPeriods) {
  for (const scope of affectedScopes) {
    await recalculateLeaderboard(supabase, period, scope, ...);
  }
}
```

**Fordele:**
- Leaderboards opdateres inden for 1 minut efter nye salg
- Dashboards viser altid friske data

**Ulemper:**
- Øger execution time for incremental function
- Kan timeout hvis der er mange teams/clients

### Option B: Øg Frekvens af Full Refresh til Hvert 5. Minut
Ændr cron schedule fra `*/30 * * * *` til `*/5 * * * *`:

```sql
SELECT cron.alter_job(
  54, -- calculate-kpi-values-full-refresh
  schedule => '*/5 * * * *'
);
```

**Fordele:**
- Simpelt at implementere
- Maksimal forsinkelse reduceret til 5 minutter

**Ulemper:**
- Øget database belastning
- Full refresh er tungt (kan tage 30+ sekunder)

### Option C: Hybrid - Leaderboard-Only Incremental (Anbefalet)
Opret en ny edge function `calculate-leaderboard-incremental` der KUN opdaterer leaderboards:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    NY ARKITEKTUR                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  calculate-kpi-incremental (hvert minut)                        │
│  └─ Opdaterer: kpi_cached_values (employee KPIs)                │
│                                                                 │
│  calculate-leaderboard-incremental (hvert minut) ← NY           │
│  └─ Opdaterer: kpi_leaderboard_cache (today + payroll_period)   │
│  └─ Kun global og client-scoped (vigtigst for dashboards)       │
│                                                                 │
│  calculate-kpi-values (hver 30. minut)                          │
│  └─ Full refresh af alt (inkl. this_week, this_month)           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Anbefalet Implementering: Option C

### Trin 1: Opret `calculate-leaderboard-incremental` edge function
- Henter alle salg for "today" og "payroll_period"
- Beregner leaderboards for global og client scopes
- Gemmer i `kpi_leaderboard_cache`
- Kører hvert minut

### Trin 2: Tilføj cron job for ny function
```sql
SELECT cron.schedule(
  'calculate-leaderboard-incremental',
  '* * * * *', -- Hvert minut
  $$SELECT public.trigger_leaderboard_incremental()$$
);
```

### Trin 3: Opret trigger function i databasen
```sql
CREATE OR REPLACE FUNCTION public.trigger_leaderboard_incremental()
RETURNS void AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/calculate-leaderboard-incremental',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_key'))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Øjeblikkeligt Fix (Mens vi implementerer)
Manuelt trigger en full refresh nu:

```bash
curl -X POST https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/calculate-kpi-values \
  -H "Authorization: Bearer [SERVICE_KEY]"
```

---

## Berørte Filer
| Fil | Ændring |
|-----|---------|
| `supabase/functions/calculate-leaderboard-incremental/index.ts` | NY - Incremental leaderboard updates |
| `supabase/config.toml` | Tilføj ny function |
| Database migration | Opret `trigger_leaderboard_incremental()` og cron job |

## Resultat
- Dashboards viser friske data inden for 1-2 minutter efter salg synkroniseres
- Ingen 30-minutters forsinkelse på leaderboards
- Fuld robusthed via monthly full refresh backup

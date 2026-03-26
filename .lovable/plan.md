

## Slet Kundeforecast fra menu og database

### Oversigt
Fjern hele kundeforecast-funktionaliteten: sider, komponenter, hooks, routes, menupunkt, permission-key og alle 7 relaterede database-tabeller.

### Database-migration (DROP tables)
Drop disse tabeller i korrekt rækkefølge (pga. foreign keys):

1. `client_forecast_cohorts` (references ramp/survival profiles)
2. `client_forecasts`
3. `client_monthly_targets`
4. `employee_forecast_overrides`
5. `fm_weekly_forecast_overrides`
6. `forecast_ramp_profiles`
7. `forecast_survival_profiles`

```sql
DROP TABLE IF EXISTS client_forecast_cohorts CASCADE;
DROP TABLE IF EXISTS client_forecasts CASCADE;
DROP TABLE IF EXISTS client_monthly_targets CASCADE;
DROP TABLE IF EXISTS employee_forecast_overrides CASCADE;
DROP TABLE IF EXISTS fm_weekly_forecast_overrides CASCADE;
DROP TABLE IF EXISTS forecast_ramp_profiles CASCADE;
DROP TABLE IF EXISTS forecast_survival_profiles CASCADE;
```

### Slet filer (sider + komponenter + hooks)

**Sider:**
- `src/pages/Forecast.tsx`
- `src/pages/ForecastClientReport.tsx`

**Komponenter (hele mappen):**
- `src/components/forecast/` (16 filer)

**Hooks:**
- `src/hooks/useClientForecast.ts`
- `src/hooks/useEmployeeForecastOverrides.ts`
- `src/hooks/useFmWeeklyForecast.ts`
- `src/hooks/useForecastVsActual.ts`

**Types:**
- Forecast-relaterede typer i `src/types/forecast.ts`

### Redigér filer

1. **`src/routes/config.tsx`** — Fjern 2 forecast-routes + import af `Forecast`, `ForecastClientReport`
2. **`src/routes/pages.ts`** — Fjern 2 lazy exports (`Forecast`, `ForecastClientReport`)
3. **`src/components/layout/AppSidebar.tsx`** — Fjern "Kundeforecast" NavLink-blokken (linje 1681-1694)
4. **`src/hooks/usePositionPermissions.ts`** — Fjern `canViewForecast` permission
5. **`src/config/permissionKeys.ts`** — Fjern `menu_forecast` entry

### Uberørte filer
- `useTeamGoalForecast.ts` — Bruges til team-mål, ikke kundeforecast. Beholdes.


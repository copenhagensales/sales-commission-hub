## Konklusion

Der står 0, fordi siden i TV/public mode ikke har adgang til de cache-tabeller, som Eesy TM-overblikket læser fra.

Data findes i databasen lige nu:

- `sales_count / today` = 4
- `sales_count / this_week` = 54
- `sales_count / this_month` = 340
- `sales_count / payroll_period` = 1193
- `total_hours / payroll_period` = 4882.5

Men RLS/policies på cache-tabellerne tillader kun `authenticated`, ikke public/TV-link (`anon`). Derfor får public TV-linket tomme resultater og UI falder tilbage til 0 / “Ingen salg endnu”.

## Evidens

- `src/pages/EesyTmDashboard.tsx:6-15` viser Eesy TM med client id via `ClientDashboard`.
- `src/components/dashboard/ClientDashboard.tsx:72-75` henter KPI’er via `useClientDashboardKpis` fra cache.
- `src/components/dashboard/ClientDashboard.tsx:83-86` henter leaderboards fra cache.
- `src/hooks/usePrecomputedKpi.ts:151-156` læser `kpi_cached_values` for `scope_type='client'` og Eesy client id.
- `src/hooks/useCachedLeaderboard.ts:35-52` læser `kpi_leaderboard_cache`.
- DB-query viser aktuelle Eesy TM cache-tal er opdaterede og ikke 0.
- DB-policy-query viser:
  - `kpi_cached_values`: SELECT kun til `authenticated`
  - `kpi_leaderboard_cache`: SELECT kun til `authenticated`
  - ingen `anon` adgang

## Plan

1. Lav en minimal RLS-migration for public TV-read adgang til cache-tabellerne:
   - Giv `anon` læseadgang til `kpi_cached_values`.
   - Giv `anon` læseadgang til `kpi_leaderboard_cache`.
   - Tilføj SELECT-policies for `anon`, begrænset til de cachedata TV-boards skal kunne vise.

2. Bevar sikkerhedsgrænsen:
   - Ingen public adgang til rå `sales`, medarbejderdata eller `tv_board_access`.
   - TV-koden skal stadig verificeres via `verify_tv_board_code`.
   - Public adgang gives kun til aggregeret cache/leaderboard-data, som TV-boardet allerede er designet til at vise.

3. Verificér efter migration:
   - Åbn preview/public TV-linket igen.
   - Bekræft at KPI-kortene viser 4 / 54 / 340 / 1193 og salg/time beregnes fra timer.
   - Bekræft at TOP-lister viser cache-leaderboard i stedet for “Ingen salg endnu”.

## Bemærkning

Dette løser 0-problemet. Det tidligere problem med `BNA4` på custom domain kræver stadig at den nye frontend faktisk publiceres, fordi live-siden før stadig kørte gammel kode der kaldte `tv_board_access` direkte.
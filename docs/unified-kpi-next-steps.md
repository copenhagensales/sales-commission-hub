# Unified KPI next steps (stabilitet + korrekthed)

Denne plan samler de vigtigste næste skridt for at undgå blandede datakilder, perioder uden salgsdata og inkonsistente KPI-tal.

## 1) Canonical metric contract (obligatorisk)
- Brug én versionsstyret kontrakt for KPI-definitioner (salg/provision/revenue/status/tidszone).
- Frontend gateway + pipelines skal referere samme kontraktversion.
- Kontrakten er introduceret i `src/lib/metricContract.ts` (v1) som startpunkt.

## 2) Én metric-pipeline + én serving layer
- KPI-kort skal læse fra præberegnede KPI-view/tabeller (cache-first).
- Direkte source queries må kun bruges til row-level visninger (recent sales/export/admin).
- Undgå at dashboard-komponenter selv bygger ad hoc sales-queries.

## 3) Dual-read / compare mode før cutover
- Kør midlertidigt både legacy og unified source i samme side.
- Log mismatch (%) per KPI og scope før legacy slukkes.
- Gate: migration først når mismatch er under aftalt tærskel i flere dage.
- Teknisk foundation lagt i:
  - `src/hooks/useKpiGateway.ts` (`legacySnapshot` + health compare)
  - `src/hooks/useKpiHealthMonitor.ts`
  - `supabase/migrations/20260218193000_3f9ac9c2_kpi_health_and_reconcile_foundation.sql` (`kpi_dual_read_compare`)

## 4) Driftssikring: freshness/correctness + alarmer
- Mål `seconds_since_last_successful_update`.
- Mål `cache_vs_source_delta_pct`.
- Alert ved overskridelse af threshold (ikke kun ved exceptions).
- Runtime thresholds/flags ligger i `src/config/kpiRuntime.ts`.

## 5) UI signalering af datakvalitet
- Vis `data_as_of` + stale badge på KPI-kort.
- Ny komponent: `src/components/dashboard/DataFreshnessBadge.tsx`.
- Nye hooks skal returnere freshness metadata (`dataAsOf`, `isStale`).

## 6) Fælles KPI gateway service/hook
- Introducér ét fælles entrypoint til KPI’er, inkl. contract-version, data source, freshness.
- Ny hook: `src/hooks/useKpiGateway.ts`.
- Feature flag:
  - env: `VITE_USE_UNIFIED_KPI_SOURCE=true|false`
  - runtime override: `localStorage.useUnifiedKpiSource=true|false`

## 7) Reconcile strategi
- Incremental hvert minut.
- Mini-reconcile hver 5. minut (fx seneste 24 timer).
- Natlig full reconcile (30-90 dage afhængigt af datavolumen).
- Reconcile schedule metadata er seedet i `kpi_reconcile_schedule` via migration.

## Praktisk rollout (lav risiko)
1. Aktivér KPI gateway på 1 dashboard bag feature-flag.
2. Tilføj freshness badge på samme side.
3. Aktivér dual-read compare og mål mismatch i 3-7 dage.
4. Rul videre dashboard for dashboard.
5. Sluk legacy KPI source efter accepterede gates.

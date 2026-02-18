

# Integrer PR 12: Unified KPI Next Steps

## Status

Alle kodefiler fra PR 12 er **allerede integreret** i codebasen:
- `src/lib/metricContract.ts` -- canonical metric contract (v1)
- `src/config/kpiRuntime.ts` -- feature flags + thresholds
- `src/hooks/useKpiGateway.ts` -- unified KPI gateway hook
- `src/hooks/useKpiHealthMonitor.ts` -- freshness/correctness monitor
- `src/components/dashboard/DataFreshnessBadge.tsx` -- stale badge
- `src/utils/postgrestFetch.ts` -- retry/timeout/maxRows forbedringer
- `src/hooks/useDashboardSalesData.ts` -- chunked fetching + dataAsOf

## Manglende: Database migration

Migrationen `20260218193000_3f9ac9c2_kpi_health_and_reconcile_foundation.sql` er til stede som fil, men tabellerne er **ikke oprettet** i databasen endnu.

### Tabeller der oprettes

1. **kpi_health_snapshots** -- logger freshness og KPI-vaerdier per source/scope/period
2. **kpi_dual_read_compare** -- gemmer delta mellem unified og legacy KPI-kilder
3. **kpi_reconcile_schedule** -- metadata for reconcile-kadence (mini 5min, full nightly)

### Implementeringsplan

1. Koer migrationen via database migration tool (opretter 3 tabeller + 2 indekser + seed data)
2. Ingen kodeaendringer noedvendige -- alt er allerede paa plads

### Teknisk detalje

Migrationen bruger `CREATE TABLE IF NOT EXISTS` og `ON CONFLICT ... DO UPDATE`, saa den er idempotent og sikker at koere.




## Fix den underliggende KPI-cache der ikke er opdateret siden 13/4

### Status
- DB per Klient er nu beskyttet af stale-check (forrige fix).
- **MEN**: Hele `kpi_cached_values` har ikke været opdateret i 8 dage — alle klienter, ikke kun Eesy FM.
- Andre dashboards (TV, klient-dashboards, leaderboards, FM aggregeret) læser stadig direkte fra cachen uden stale-fallback og viser derfor forkerte tal.

### Trin 1: Genstart cachen straks
Kald edge-funktionen `calculate-kpi-values` manuelt med `chunk: "kpis"` og bagefter `chunk: "leaderboards"` for at få alle cachede tal opdateret med det samme.

### Trin 2: Find ud af hvorfor cron-jobbet er stoppet
Læs fra `cron.job` og `cron.job_run_details` for at se:
- Om jobbet bag `trigger_kpi_calculation()` overhovedet eksisterer / er aktivt.
- Hvornår det sidst kørte og hvilken fejl der eventuelt blev returneret.

Rapportér tilbage hvad der findes. Hvis jobbet er deaktiveret eller mangler, præsenterer jeg en separat migration der genskaber/aktiverer det.

### Trin 3 (valgfrit, anbefalet): Beskyt de øvrige cache-læsere
Tilføj samme stale-check (cache > 2 timer → fallback til live) i:
- `src/hooks/usePrecomputedKpi.ts` (bruges af TV/klient-dashboards)
- `src/hooks/useAggregatedClientCache.ts` (FM aggregeret)
- Leaderboard-hooks der læser `kpi_leaderboard_cache`

Det forhindrer at samme tavse fejl rammer andre views fremover.

### Filer der potentielt berøres
- Ingen ved Trin 1+2 (kun edge function call + read queries).
- Trin 3: `src/hooks/usePrecomputedKpi.ts`, `src/hooks/useAggregatedClientCache.ts`, evt. leaderboard-hook.

### Spørgsmål
Skal jeg køre alle 3 trin, eller kun 1+2 (minimum) — og lade Trin 3 vente til vi ved om cron-jobbet kan gøres stabilt igen?


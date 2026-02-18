# Integrationsplan: Få PR 2–5 ind i Lovable (uden PR 1)

## Formål
Sikre at ændringerne fra PR 2, PR 3, PR 4 og PR 5 bliver integreret stabilt i Lovable, hvor PR 5 (KPI snapshot/cache-retning) er baseline.

## Scope
- Inkluderet: PR 2, PR 3, PR 4, PR 5.
- Ekskluderet: PR 1.

## Baseline-beslutning
PR 5 behandles som den arkitektoniske baseline for KPI-beregning:
- `calculate-kpi-incremental` kører snapshot-beregning (ikke watermark/delta).
- Dashboards migreres mod cache-baserede KPI-kilder.

Konsekvens: Ved konflikter mellem PR 2–4 og PR 5 i KPI-flow vælges PR 5-strategien.

## Foreslået integrationsrækkefølge
1. Start fra den branch Lovable deployer fra i dag.
2. Integrér PR 2.
3. Integrér PR 3.
4. Integrér PR 4.
5. Verificér at PR 5-adfærd stadig er intakt efter merge-konfliktløsning.

> Bemærk: Selvom PR 5 allerede er kørt, skal den bruges som reference under konfliktløsning, så PR 2–4 ikke reintroducerer legacy KPI-logik.

## Konfliktløsningsregler
### KPI- og datakonsistens-filer
- Behold PR 5-logik i:
  - `supabase/functions/calculate-kpi-incremental/index.ts`
  - cache-orienterede KPI hooks/dashboards
- Afvis ændringer fra PR 2–4, hvis de:
  - genindfører watermark/delta-akkumulering,
  - genindfører direkte KPI-queries i sider der er migreret til cache.

### Ikke-KPI-filer
- Behold PR 2–4 forbedringer for:
  - performance,
  - edge function robusthed,
  - permissions/UX-fixes,
  når de ikke bryder KPI-baseline.

## Verificeringsplan (gates)
### Gate A — Build og type-sikkerhed
- Kør build + typecheck uden fejl.

### Gate B — KPI correctness
- Sammenlign cache-KPI mod referenceudtræk på udvalgte scopes:
  - employee,
  - client,
  - global.
- Kontroller perioder: today, this_week, this_month, payroll_period.

### Gate C — Dashboard konsistens
- Verificér at KPI-kort på centrale dashboards læser fra cache-kilde efter merge af PR 2–4.
- Spot-check at “sum af delkort” ikke afviger uventet fra overordnede totals.

### Gate D — Drift/rollback
- Sørg for at eventuelle feature flags/rollback-switches stadig virker pr. dashboard.
- Bekræft at monitorering for freshness/correctness er intakt.

## Udrulning
1. Deploy samlet PR 2–5 integration til staging.
2. Kør 24–72 timers observation af mismatch/freshness.
3. Deploy til produktion trinvist.
4. Fjern evt. midlertidige compare-paths først når afvigelser er under aftalt tærskel.

## Risici og mitigering
- Risiko: PR 2–4 reintroducerer gammel KPI-logik.
  - Mitigering: filspecifik konfliktstrategi med PR 5 som source-of-truth.
- Risiko: Skjulte forskelle i dashboard-tal efter integration.
  - Mitigering: gate-baseret compare (employee/client/global + perioder).
- Risiko: Øget load efter samlet merge.
  - Mitigering: staging-observation med fokus på refresh/fetch mønstre.

## Konklusion
Forløbet skal eksplicit være **PR 2–5**, med PR 5 som styrende KPI-arkitektur. Det reducerer regressions-risiko og gør integrationen driftssikker uden at skulle afvente eller medtage PR 1.

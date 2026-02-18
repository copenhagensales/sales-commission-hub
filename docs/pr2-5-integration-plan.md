# PR 2–5 Integrations-PR (uden PR 1)

## Mål
Lav én ny integrations-PR til Lovable, som **kun** indeholder PR 2, PR 3, PR 4 og PR 5 – og hvor PR 5’s KPI-arkitektur forbliver styrende.

## Scope
- ✅ Inkluder: PR 2, PR 3, PR 4, PR 5
- ❌ Ekskluder: PR 1

## Baseline-regel
PR 5 er source-of-truth for KPI-flow:
- `calculate-kpi-incremental` skal forblive snapshot/cache-baseret.
- Der må ikke reintroduceres watermark/delta-logik i KPI-beregningen.
- Dashboards, der er migreret til cached KPI-kilder, må ikke falde tilbage til direkte KPI-queries.

---

## Konkrete trin til den nye integrations-PR

### 1) Opret integrations-branch fra Lovable’s aktuelle deploy-base
```bash
git checkout <lovable-base-branch>
git pull
git checkout -b integration/pr-2-5
```

### 2) Integrér PR 2, PR 3 og PR 4 i rækkefølge
Brug merge/cherry-pick alt efter hvordan PR’erne eksisterer i historikken:

```bash
# Eksempel (merge)
git merge <branch-for-pr2>
git merge <branch-for-pr3>
git merge <branch-for-pr4>

# Eller (cherry-pick af merge commits/commit ranges)
git cherry-pick <pr2-commits>
git cherry-pick <pr3-commits>
git cherry-pick <pr4-commits>
```

### 3) Konfliktløsning med PR 5-prioritet
Ved konflikter i KPI-relaterede filer:
- behold PR 5-retningen (snapshot/cache)
- afvis ændringer der genindfører legacy KPI-flow

Særligt kritisk fil:
- `supabase/functions/calculate-kpi-incremental/index.ts`

### 4) Kør tekniske checks før PR åbnes
```bash
npm run typecheck
npm run build
npm run lint
```

Hvis et projekt bruger andre scripts, erstat med tilsvarende kommandoer.

### 5) Kør funktionelle verifikationer (gates)
- **Gate A – KPI correctness**
  - Sammenlign cache-værdier mod reference for scopes: employee, client, global.
  - Tjek perioder: `today`, `this_week`, `this_month`, `payroll_period`.
- **Gate B – Dashboard consistency**
  - Verificér KPI-kort på centrale dashboards efter integration.
  - Spot-check at delsummer og totals er konsistente.
- **Gate C – Drift/rollback**
  - Verificér at feature flags/rollback-switches virker.
  - Bekræft freshness/correctness monitorering.

### 6) Åbn ny integrations-PR (PR 2–5)
PR-title forslag:
- `Integrate PR 2-5 on top of PR 5 baseline (exclude PR 1)`

PR-beskrivelse skal indeholde:
- eksplicit scope (2–5 only)
- konfliktstrategi (PR 5 vinder i KPI-flow)
- test- og gate-resultater
- rollout-plan (staging → observation → gradvis prod)

---

## Rollout-plan
1. Deploy integrations-PR til staging.
2. Kør 24–72 timers observation (freshness, mismatch, fejlrate).
3. Deploy gradvist til produktion.
4. Fjern midlertidige compare-paths først når afvigelser er under aftalt tærskel.

## Risici og mitigering
- **Risiko:** PR 2–4 reintroducerer gammel KPI-logik.
  - **Mitigering:** Filspecifik konfliktstrategi med PR 5 som baseline.
- **Risiko:** Talafvigelser mellem dashboards efter merge.
  - **Mitigering:** Scope/period-gates før merge + observation i staging.
- **Risiko:** Load-spikes efter samlet integration.
  - **Mitigering:** Trinvis rollout og monitorering af refresh/fetch-mønstre.

## Definition of Done
- Ny PR er oprettet med scope **kun PR 2–5**.
- KPI-flow følger fortsat PR 5-arkitektur.
- Tekniske checks + gates er dokumenteret i PR.
- Staging-observation er gennemført før fuld produktion.

## Hvis Lovable ikke kan hente PR
Hvis Lovable ikke kan hente PR’en direkte:
1. Push branch igen og bekræft at commit-hash er synlig på remote.
2. Opret en frisk PR fra samme branch med tydelig titel: `PR 2-5 integration (retry)`
3. Del både PR-link, branch-navn og seneste commit-hash i samme besked til Lovable.
4. Hvis fetch stadig fejler, opret en ny branch fra samme commit og åbn PR derfra (teknisk workaround for cache/fetch issues).

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

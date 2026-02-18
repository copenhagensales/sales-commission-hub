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


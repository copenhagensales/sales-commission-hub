# Komplet implementeringsplan for PR 2–5 (uden PR 1)

## Overblik
Denne plan dækker de manglende leverancer fra master-planen og den kritiske arkitektur-review:
- integration af allerede oprettede utilities,
- cron-staggering for at undgå rate-limits,
- freshness-badges i dashboards,
- observability via fetch-tracking.

Planen holder samtidig fast i baseline: PR 5 er source-of-truth for KPI-arkitektur (snapshot/cache), og PR 1 er ude af scope.

## Scope og baseline
- ✅ Inkluder: PR 2, PR 3, PR 4, PR 5
- ❌ Ekskluder: PR 1
- Baseline-regel:
  - `calculate-kpi-incremental` skal forblive snapshot/cache-baseret.
  - Der må ikke reintroduceres watermark/delta-logik i KPI-beregningen.
  - Dashboards migreret til cached KPI-kilder må ikke falde tilbage til direkte KPI-queries.

---

## Del 1: Cron-staggering (akut – Adversus fejler nu)

### Problem
Alle 5 dialer-integrationer kører på `*/5 * * * *` samtidigt. De to Adversus-konti (`Lovablecph` + `Relatel_CPHSALES`) deler API og rammer 429 rate limits.

### Løsning
Opdater cron-schedules, så integrationerne forskydes og ikke rammer samme minut:

| Integration        | Provider  | Ny schedule |
|-------------------|-----------|-------------|
| Lovablecph        | adversus  | `1,6,11,16,21,26,31,36,41,46,51,56 * * * *` |
| Relatel_CPHSALES  | adversus  | `3,8,13,18,23,28,33,38,43,48,53,58 * * * *` |
| Eesy              | enreach   | `0,5,10,15,20,25,30,35,40,45,50,55 * * * *` |
| tryg              | enreach   | `2,7,12,17,22,27,32,37,42,47,52,57 * * * *` |
| ase               | enreach   | `4,9,14,19,24,29,34,39,44,49,54,59 * * * *` |

Udføres via SQL mod `cron.job`-tabellen.

---

## Del 2: REFRESH_PROFILES integration i alle dashboards

### Problem
`REFRESH_PROFILES` er defineret i `tvMode.ts`, men bruges ikke konsekvent. Mange filer har hardcodede `staleTime`/`refetchInterval` værdier.

### Løsning
Migrér dashboards og hooks til at bruge `REFRESH_PROFILES` centralt.

### Filer der opdateres
- `src/pages/CsTop20Dashboard.tsx` – brug `REFRESH_PROFILES.dashboard` / `.tv`
- `src/pages/UnitedDashboard.tsx` – brug `REFRESH_PROFILES.dashboard`
- `src/pages/boards/SalesDashboard.tsx` – brug `REFRESH_PROFILES.dashboard`
- `src/hooks/usePrecomputedKpi.ts` – brug `REFRESH_PROFILES.dashboard`
- `src/hooks/usePersonalWeeklyStats.ts` – brug `REFRESH_PROFILES.dashboard`
- `src/hooks/useTvCelebrationData.ts` – brug `REFRESH_PROFILES.dashboard`
- `src/hooks/useIntegrationDebugLog.ts` – brug `REFRESH_PROFILES.config`
- `src/hooks/useCarQuiz.ts` – brug `REFRESH_PROFILES.dashboard`
- `src/hooks/usePendingContractLock.ts` – brug `REFRESH_PROFILES.dashboard`
- `src/hooks/useCodeOfConduct.ts` – brug `REFRESH_PROFILES.dashboard`
- `src/pages/reports/RevenueByClient.tsx` – brug `REFRESH_PROFILES.dashboard`
- `src/components/home/HeadToHeadComparison.tsx` – brug `REFRESH_PROFILES.dashboard`
- `src/components/recruitment/SendSmsDialog.tsx` – beholder egen profil (15s polling, specifik use-case)

### Mønster
```ts
import { REFRESH_PROFILES } from "@/utils/tvMode";

useQuery({
  ...REFRESH_PROFILES.dashboard,
  // resten af query config
});
```

---

## Del 3: `trackFetch` integration i kritiske data-hooks

### Problem
`trackFetch` er defineret men ikke brugt konsekvent. Der mangler observability på fetch-latency.

### Løsning
Wrap de tungeste/vigtigste queries med `trackFetch`.

### Filer der opdateres
- `src/hooks/useDashboardSalesData.ts` – wrap hele `queryFn`
- `src/hooks/usePrecomputedKpi.ts` – wrap KPI-fetches
- `src/pages/dashboards/SalesOverviewAll.tsx` – wrap salgsdata-fetch
- `src/pages/dashboards/CphSalesDashboard.tsx` – wrap dashboard-fetch
- `src/pages/dashboards/FieldmarketingDashboardFull.tsx` – wrap FM-data-fetch

### Mønster
```ts
import { trackFetch } from "@/utils/fetchPerformance";

queryFn: () => trackFetch("dashboard-sales-data", async () => {
  // eksisterende fetch-logik
});
```

---

## Del 4: Freshness badges på dashboards

### Problem
Dashboards viser ikke tydeligt, hvornår data sidst blev opdateret. Brugere kan ikke se om tal er friske eller forældede.

### Løsning
Opret genbrugelig komponent: `src/components/ui/DataFreshnessBadge.tsx`.

### Krav til komponent
- Viser “Opdateret kl. HH:mm” baseret på `calculated_at` fra KPI-cache.
- Viser advarsel:
  - gul, hvis data er ældre end 5 min,
  - rød, hvis data er ældre end 15 min.
- Kompakt design, der passer i dashboard-headers.

### Dashboards der får badge
- `CphSalesDashboard.tsx`
- `SalesOverviewAll.tsx`
- `UnitedDashboard.tsx`
- `EesyTmDashboard.tsx`
- `TdcErhvervDashboard.tsx`
- `RelatelDashboard.tsx`
- `CsTop20Dashboard.tsx`
- `FieldmarketingDashboardFull.tsx`

---

## Rækkefølge
1. **Del 1 først** (akut fix – Adversus sync fejler nu).
2. **Del 2 + Del 3 parallelt** (utility-integration, lav risiko).
3. **Del 4 til sidst** (ny UI-komponent).

---

## Når PR 2–4 endnu ikke er synkroniseret i Lovable
Brug denne sekvens for at hente de manglende GitHub-ændringer ind i Lovable-miljøet, før merge:

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


## Når PR 2–4 endnu ikke er synkroniseret i Lovable (gør dette nu)
Brug denne sekvens for at hente de manglende GitHub-ændringer ind i Lovable-miljøet, **før** du merge’r:

1. Tilføj/fix `origin` remote til GitHub-repoet.
2. Hent PR refs direkte fra GitHub.
3. Cherry-pick PR 2–4 commits ind på integrations-branch.
4. Verificér at filer fra PR 2–4 faktisk er til stede lokalt.

Eksempelkommandoer:
```bash
# 1) Tilføj remote (hvis mangler)
git remote add origin <github-repo-url>

# 2) Hent refs + PR refs
# 2) Hent nyeste refs + PR refs
git fetch origin
git fetch origin pull/2/head:pr-2
git fetch origin pull/3/head:pr-3
git fetch origin pull/4/head:pr-4

# 3) Opret integration branch fra base
git checkout <lovable-base-branch>
git pull --ff-only origin <lovable-base-branch>
git checkout -b integration/pr-2-5

# 4) Integrér PR 2-4
# (vælg enten merge eller cherry-pick)
git merge pr-2
git merge pr-3
git merge pr-4

# 5) Verificér indhold
# 5) Verificér at ændringer kom med
git log --oneline --decorate -n 30
git diff --name-only <lovable-base-branch>...HEAD
```

Hvis `pull/<nr>/head` refs ikke er tilladt, brug branch-navne eller hent patch og anvend med `git am`.

---

## Tekniske detaljer
- Ingen nye dependencies kræves.
- Estimeret antal filer:
  - 1 ny komponent (`DataFreshnessBadge`)
  - ~20 filer opdateres med `REFRESH_PROFILES` / `trackFetch`
  - 1 SQL-migration til cron-staggering

## Risici og mitigering
- Cron-opdatering: lav risiko, kan rulles tilbage via SQL.
- `REFRESH_PROFILES`: ingen funktionel ændring, kun centralisering af eksisterende værdier.
- `trackFetch`: observability wrapper uden forretningslogiske sideeffekter.
- Freshness badges: ren UI-tilføjelse, ingen dataændring.

## Definition of Done
- Ny integrations-PR er oprettet med scope kun PR 2–5.
- PR 5 KPI-arkitektur er bevaret i konfliktløsning.
- Del 1 (cron-staggering) er i drift og 429-rate er reduceret.
- Del 2+3 er implementeret i de nævnte filer.
- Del 4 er live på de oplistede dashboards.
- Verifikation/gates er dokumenteret i PR.

## Hvis Lovable ikke kan hente PR
1. Push branch igen og bekræft at commit-hash er synlig på remote.
2. Opret en frisk PR fra samme branch med titel: `PR 2-5 integration (retry)`.
3. Del PR-link, branch-navn og seneste commit-hash i samme besked til Lovable.
4. Hvis fetch stadig fejler: opret ny branch fra samme commit og åbn PR derfra.
Hvis `pull/<nr>/head` refs ikke er tilladt i jeres Git-hosting, så brug branch-navne eller hent patch fra PR’en og anvend med `git am`.

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

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

```bash
# 1) Tilføj remote (hvis mangler)
git remote add origin <github-repo-url>

# 2) Hent refs + PR refs
git fetch origin
git fetch origin pull/2/head:pr-2
git fetch origin pull/3/head:pr-3
git fetch origin pull/4/head:pr-4

# 3) Opret integration branch fra base
git checkout <lovable-base-branch>
git pull --ff-only origin <lovable-base-branch>
git checkout -b integration/pr-2-5

# 4) Integrér PR 2-4
git merge pr-2
git merge pr-3
git merge pr-4

# 5) Verificér indhold
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

# Unified Dashboard Architecture – Kritisk og ambitiøs version

## Kort vurdering af Lovable-planen
Lovable-planen er stærk på retning: én primær kilde (cache), hurtigere opdatering og færre tunge direkte queries. Det er den rigtige retning.

Men planen er **ikke tilstrækkelig robust** endnu, hvis målet er:
1. Korrekte tal under alle driftsscenarier.
2. Hurtige opdateringer uden spikes eller race conditions.
3. Ens og verificerbar talhentning på tværs af alle dashboards.

Den mangler især en tydelig model for datakonsistens, observability, idempotens, og kontrolleret rollout med automatisk validering.

---

## Huller i nuværende plan (skal lukkes)

### 1) “1 minut” alene løser ikke correctness
Hvis incremental-opdateringen fejler i 2-3 minutter, kan dashboards stadig vise forældede tal uden alarm. Full refresh hver 30. minut er for sent som eneste safety net.

**Krav:** freshness-SLO + watchdog alarmer, ikke kun cron-frekvens.

### 2) Ingen eksplicit idempotens/replay-strategi
Delta-baseret opdatering kræver hård idempotens ved retries, timeout og dobbeltkørsel. Uden det får I over-/undertælling.

**Krav:** deterministic event-nøgle + dedupe ledger eller monotone batch-offsets per scope.

### 3) Watermarks er nævnt, men ikke transaktionelt designet
Hvis watermark opdateres før alle scope-upserts er committed, opstår permanent datatab.

**Krav:** atomisk transaktion per batch (upserts + watermark commit sammen).

### 4) Ingen canonical metric contract
“sales_count”, “total_commission”, “total_revenue” bruges bredt, men uden central definition af:
- hvilke filtre gælder (fx cancelled, pending, draft),
- hvilken tidszone bruges,
- hvilken dato bruges (created_at vs sale_date),
- hvordan negative korrektioner håndteres.

**Krav:** én versionsstyret metric-spec (v1/v2), som alle dashboards og jobs følger.

### 5) Frontend migration mangler kompatibilitetslag
Hvis nogle sider bruger cache og andre direkte DB med anden business-logik, får I tillidsbrud (“tallene matcher ikke”).

**Krav:** midlertidig dual-read/compare mode med synlig mismatch-måling, før direkte queries fjernes.

### 6) Ingen load- og failure-budget
60s polling på mange dashboards kan stadig presse DB/cache afhængigt af antal samtidige brugere.

**Krav:** kapacitetsbudget + adaptive refresh + fallback policy ved høj load.

---

## Ambitiøs target-arkitektur (anbefalet)

## A. Én metric-pipeline med 3 lag
1. **Raw events (sales changes)** – append-only ændringer.
2. **Canonical aggregation** – scoped KPI-tabeller (employee/client/global) med versionsstyrede regler.
3. **Serving layer** – hooks/API læser kun præberegnede KPI’er for standardperioder.

Direkte queries bevares kun til row-level visninger (recent sales, export, admin).

## B. Event-idempotens og transaktionel sikkerhed
- Indfør `kpi_batch_runs` med `run_id`, `from_watermark`, `to_watermark`, status.
- Kør batch i én transaktion:
  - læs input,
  - aggreger,
  - upsert KPI scope,
  - commit watermark.
- Ved retry: samme `run_id` må ikke kunne tælle data to gange.

## C. Reconciliation-loop (automatisk korrekthed)
- Behold incremental hvert minut.
- Kør **mini-reconcile** hvert 5. minut for seneste 24 timer.
- Kør full reconcile natligt for 30-90 dage.
- Mål og log drift mellem incremental og reconcile.

Målet er ikke at “håbe” full refresh retter fejl, men aktivt at måle og lukke afvigelser hurtigt.

## D. Central Metric Contract
Opret en dokumenteret og versionsstyret kontrakt:
- canonical periodedefinitioner (today/week/month/payroll),
- timezone-policy (fx Europe/Copenhagen),
- statusfiltre,
- beregningsregler for commission/revenue,
- regler for voids/refunds/chargebacks.

Både Edge Functions og frontend hooks refererer samme kontrakt-version.

## E. Standardiseret data-access i frontend
- Én fælles “KPI gateway” hook/service for alle dashboards.
- Dashboard-specifikke komponenter må ikke selv opfinde queries for standard-KPI’er.
- Feature flag per dashboard: `useUnifiedKpiSource=true/false`.

## F. Drift og observability som førstegangs-krav
- Dashboard freshness-metric: “seconds since last successful scope update”.
- Correctness-metric: “cache-vs-source delta (%)”.
- Pipeline health: batch duration, lag, failed runs, retries.
- Alarmer på threshold, ikke kun fejlstacktraces.

---

## Konkret udfordring af de foreslåede migrations

### CPH Sales
Enig i cache-first. Men kræv at KPI-kort vises med `data_as_of` timestamp og fallback-tilstand (stale badge), så brugeren kan se datakvalitet.

### SalesOverviewAll
Enig i at fjerne direkte sales-queries. Men klientlisten og KPI-data skal hentes i samme konsistente snapshot (samme cutoff), ellers hopper totals.

### United
Enig i migration. Kræv også at team-filtre bruger samme canonical scope-regler som leaderboard, ellers bliver “sum af kort” ≠ leaderboard.

### Fieldmarketing
Enig i cache for KPI-kort. Men eksport og recent-sales skal have tydelig etikette “rådata/live”, så brugerne forstår forskel på snapshot-KPI og live-liste.

### MyProfile + ImmediatePaymentASE
Her er planen for blød. Løn-/provisionsnære sider må ikke være “enten-eller”.

**Anbefaling:**
- beregningskritiske tal = authoritative payroll pipeline,
- dashboard-KPI = fast cache,
- vis tydeligt når tal er “foreløbige” vs “løn-godkendte”.

---

## Opdateret implementeringsrækkefølge (mere driftsikker)
1. Definér og godkend Metric Contract v1 (obligatorisk før kode).
2. Implementér idempotent batch-run model + transaktionelle watermarks.
3. Tilføj observability + alarmer + freshness/correctness metrics.
4. Implementér client/global incremental med feature flags.
5. Aktivér dual-read compare mode på 1 dashboard (CPH) og mål mismatch i 3-7 dage.
6. Migrér resterende dashboards trinvist med rollback-switch per side.
7. Slå direkte KPI-queries fra først når mismatch-rate er under aftalt tærskel.
8. Indfør 5-min reconcile + natlig full reconcile som permanent drift.

---

## Målbare acceptkriterier (foreslåede gates)
- **Freshness:** P95 < 90 sekunder fra nyt salg til cache-opdateret KPI.
- **Correctness:** cache-vs-source afvigelse < 0.1% på sales_count og < 0.25% på beløb.
- **Stabilitet:** < 0.5% failed incremental runs per døgn.
- **Performance:** dashboard KPI-load P95 < 300 ms fra cache.
- **Rollback:** hvert dashboard kan skifte tilbage til legacy source via feature flag på < 5 min.

---

## Beslutning
Jeg er enig i strategien (cache-first og ensretning), men planen bør opgraderes fra “migration” til **platform-løft** med correctness, observability og idempotens som hårde krav.

Hvis I implementerer ovenstående, får I ikke bare hurtigere dashboards, men et driftsikkert KPI-system hvor tallene kan forsvares overfor både ledelse og lønkørsel.

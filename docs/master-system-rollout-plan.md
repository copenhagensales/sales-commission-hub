# Master PR Plan: Verdens hurtigste og mest robuste dashboard-system

## Vision
Vi bygger et system, hvor salg bliver synligt næsten med det samme, API-kald er forudsigelige under load, og alle dashboards/TV-visninger opfører sig ensartet. Målet er høj hastighed **og** høj stabilitet.

## Executive outcomes
- Hurtigere time-to-visibility fra nyt salg til dashboard/TV.
- Ensartet API-adfærd på tværs af frontend hooks, edge functions og integration jobs.
- Færre rate-limit spikes mod tredjeparts-API’er.
- Bedre driftsrobusthed via standardiserede refresh-profiler, pagination og fallback.

## Hvad er allerede implementeret i denne store opdatering

### 1) Pagination og data-integritet i stor skala
- Indført shared PostgREST pagination helper (`fetchAllPostgrestRows`) med:
  - limit/offset pagination
  - retry/backoff
  - count=exact på første side
  - stop-kriterier + maxPages guard
- Migreret one-shot/cap-prægede fetches i centrale hooks/flows:
  - `useDashboardSalesData`
  - `useKpiTest` (inkl. total commission/revenue paths)
  - `FormulaLiveTest`
- TV edge dataflow bruger ensrettet pagination-mønster i salgsflows.

### 2) Dashboard performance-optimering
- Tunge loops refaktoreret til precomputed maps/lookups (O(1) opslag fremfor gentagne scans).
- Conditional fetches: supplerende endpoints kaldes kun når data kræver det.
- Robust timestamp-parse med `Date`-baseret håndtering og defensive fallbacks.

### 3) TV-mode og celebration correctness
- TV-mode detekterer direkte `/t/` links konsekvent.
- Celebration payload matcher seller-kontekst bedre (employeeName + salesCount).
- Placeholder replacement understøtter `{key}`, `{{key}}`, `{ key }` case-insensitivt.
- Overlay-tekst forbedret for linebreaks/long-word wrapping.
- Duration-håndtering harmoniseret for at undgå fejlkonvertering.

### 4) Adversus load/rate-limit beskyttelse
- 5-minutters dialer schedules bliver staggered i stedet for at ramme samtidigt.
- Specifik offset-håndtering for delte integrationer reducerer burst-risk.

## Ensartet API-standard (master policy)

### A. Client fetch policy
- Brug shared pagination helper for større datamængder.
- Ingen hardcoded caps (`Range: 0-9999`, `limit=10000`) i kritiske datastier.
- Retry/backoff kun for transient fejl.

### B. Edge function policy
- Standardiser paginerede helper-mønstre i tunge salgsflows.
- Bevar responskontrakter for dashboards/TV.
- Defensive checks ved tom/inkonsistent data.

### C. Refresh policy
- Live TV: kortere refresh-profiler på nøgle-metrics.
- Standard dashboards: balanceret refresh med cache for lavere load.
- Ingen global query-invalidation i loops hvor scoped invalidation er nok.

### D. Integration policy
- Delte tredjeparts-konti: staggered schedule + begrænset samtidighed.
- Background processing til tunge syncs.
- Tydelige fail-safe regler ved rate limits.

## Rollout plan (klar til drift)

### Fase 1: Stabilisering (dag 0-2)
- Verificér alle centrale dashboards/TV paths med production-lignende data.
- Aktivér scoped invalidation i live views.
- Confirm rate-limit budget på integration jobs.

### Fase 2: Accelerering (dag 3-7)
- Tun refetch-profiler pr. dashboard-type.
- Stram logging/metrics omkring fetch latency og fejlrate.
- Luk resterende duplikerede fetch/loop mønstre.

### Fase 3: Verdensklasse (uge 2-4)
- Introducér SLO’er for freshness, latency, error-rate.
- Observability-lag for ingest -> DB -> dashboard kæden.
- Løbende dead-code/unused-query cleanup med faste release-kriterier.

## Målbare KPI/SLO forslag
- P95 time-to-visibility (nyt salg -> dashboard): < 10-20 sek på live views.
- P95 edge response for TV data endpoints: < 1.5 sek ved normal load.
- Rate-limit fejl mod tredjeparts API: < 1% over 24h.
- API-kald pr. dashboard-session reduceret uden tab af datafriskhed.

## Risiko og mitigering
- Risiko: For aggressiv polling giver DB/load spikes.
  - Mitigering: profileret refresh + scoped invalidation.
- Risiko: Tredjeparts rate limits ved samtidige jobs.
  - Mitigering: staggered cron + concurrency budget.
- Risiko: Regressions i business-logik.
  - Mitigering: typecheck/build + targeted runtime checks.

## “World-class” sluttilstand
Systemet er bygget til vækst: store datamængder, flere dashboards, højere opdateringsfrekvens — uden at kompromittere korrekthed, stabilitet eller brugeroplevelse.


## Rettigheder (stabilitet og ensartethed)
- Brug én konsistent permissions-kilde i kritiske brugerflows (route guards + side/tab-visibility må ikke bruge divergerende hooks).
- Standardiser cache-håndtering med versioneret nøgle og kontrolleret invalidation ved ændringer i permissions-model.
- Indfør fast driftstjek for roller med hyppige issues (fx fieldmarketing-roller), inkl. verificering af menu + tab adgang i samme session.
- Kræv deploy-verificering af permissions efter hver større release (smoke-test: login -> route access -> tab access -> action access).
- Dokumentér fallback-procedure: cache reset + hard refresh + release checksum verificering.

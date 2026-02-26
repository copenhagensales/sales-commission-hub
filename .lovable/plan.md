
# Senior API-ekspert: Stabilitetsanbefalinger

## Overordnet vurdering

Systemet har allerede et solidt fundament med run-locks, circuit breaker, watermarks og nat-pause. Men der er flere arkitektoniske huller som en driftsansvarlig ville prioritere for at naa "enterprise-grade" stabilitet.

---

## Prioritet 1: Kritiske stabilitetsforbedringer

### 1.1 Global Provider Quota Gate (brug rate_limit_remaining)

**Problem:** Sync-runs forsooger stadig at ramme API'en selvom kvoten er 0. Circuit breaker reagerer foerst EFTER fejlen -- det spilder kald og edge function tid.

**Loesning:** Foer enhver sync, laes den seneste `rate_limit_remaining` og `rate_limit_reset` fra `integration_sync_runs`. Hvis remaining=0, skip ALLE integrations for den provider indtil reset-tidspunktet. Ingen API-kald overhovedet.

```text
┌─────────────────┐     remaining > 0?     ┌──────────┐
│ Cron trigger     │──────── YES ──────────>│ Run sync │
│                  │                        └──────────┘
│                  │──────── NO ───────────>│ Skip     │
│                  │   log "quota exhausted" │ (0 kald) │
└─────────────────┘   wait until reset      └──────────┘
```

**Fil:** `sync-integration.ts` -- tilfoej quota-check foer circuit breaker check.

### 1.2 Transaktionel Watermark (atomisk sync state)

**Problem:** Watermark (`dialer_sync_state.last_success_at`) opdateres EFTER data-upsert, men de er ikke i samme transaktion. Hvis edge function crasher mellem upsert og watermark-update, mister systemet sporet og re-fetcher eller springer data over.

**Loesning:** Wrap upsert + watermark-update i en database-funktion (RPC) der koerer som een transaktion. Alternativt: opdater watermark FOERST med et "pending" flag, og marker "confirmed" efter upsert.

**Fil:** Ny RPC-funktion + opdatering af `sync-integration.ts` sales/sessions blokke.

### 1.3 Dead Letter Queue for fejlede records

**Problem:** Hvis en upsert-batch fejler (fx 200 sales), logges fejlen men data tabes permanent. Der er ingen mekanisme til at genbehandle individuelle fejlede records.

**Loesning:** Tilfoej en `sync_failed_records` tabel. Naar en batch fejler, gem raa-data + fejlbesked. En separat healer-job kan genbehandle dem. Enrichment-healer eksisterer allerede for leads -- udvid moensteret.

**Tabel:** `sync_failed_records (id, integration_id, dataset, raw_payload, error, created_at, retry_count, resolved_at)`

---

## Prioritet 2: Observerbarhed og proaktiv alarmering

### 2.1 Data Freshness SLO med automatisk eskalering

**Problem:** Dashboardet viser "ingen sync i X min" men der er ingen proaktiv notifikation. Medarbejdere opdager foerst problemer naar de kigger paa TV-skaermen.

**Loesning:** Tilfoej en edge function (`sync-health-check`) der koerer hvert 10. minut og checker:
- Er der data yngre end 20 min for hver integration?
- Er circuit breaker aktiv?
- Er kvoten opbrugt?

Ved brud: log til `integration_logs` med status "health_alert" (kan later udvides til Slack/email).

### 2.2 Sync Run Summary pr. dag

**Problem:** Det er svaert at se trender over tid. Hvor mange kald brugte vi i gaar? Hvad er success-raten denne uge?

**Loesning:** Daglig aggregerings-job der beregner:
- Total API-kald pr. provider
- Success/error/skipped fordeling
- Gennemsnitlig varighed
- Rate-limit hit rate

Gem i en `sync_daily_summary` tabel. Vis paa System Stability som trend-graf.

---

## Prioritet 3: Robusthed og fejlhåndtering

### 3.1 Graceful Degradation i IngestionEngine

**Problem:** Hvis campaigns-sync fejler, fortsaetter sales-sync alligevel -- men sales kan afhaenge af kampagne-mappings. Der er ingen dependency-aware sequencing.

**Loesning:** Goer action-raekkefoelgen eksplicit konfigurerbar med dependencies:
```text
campaigns -> users -> sales -> calls
```
Hvis campaigns fejler, log warning men fortsaet med cached kampagne-data. Hvis der INGEN cached data findes, skip sales med en klar fejlbesked.

### 3.2 Retry med exponential backoff paa DB-niveau

**Problem:** `retry.ts` har 3 retries med 100ms base -- det er for aggressivt for eksterne API'er og for kort for Supabase-upserts under load.

**Loesning:** Differentier retry-strategi:
- **Externe API-kald:** 5 retries, 2s base, respect Retry-After header (allerede delvist i RateLimiter)
- **Database upserts:** 3 retries, 500ms base (transient Supabase errors)
- **Credential decryption:** 2 retries, 1s base (sjældne fejl)

### 3.3 Timeout Guard paa edge function niveau

**Problem:** Edge functions har en hard timeout (typisk 60s-150s). Lange syncs kan blive afbrudt midt i en batch uden cleanup.

**Loesning:** Tilfoej en "budget timer" i sync-integration der tracker forlobet tid. Hvis >80% af timeout er brugt, stop gracefully, gem watermark for det der ER processeret, og log "partial_timeout".

---

## Prioritet 4: Konfiguration og vedligehold

### 4.1 Centraliser provider-konfiguration

**Problem:** Rate limits, budgets, actions og schedules er spredt paa tvaers af 4+ filer (`provider-sync.ts`, `safe-backfill.ts`, `rate-limiter.ts`, `sync-integration.ts`). AEndring af en graense kraever redigering af flere filer.

**Loesning:** Flyt al provider-konfiguration til `dialer_integrations.config` JSON-feltet eller en dedikeret `provider_config` tabel:
```text
{
  "rate_limits": { "per_minute": 55, "per_hour": 900 },
  "budget": { "limit": 1000, "threshold": 0.70 },
  "working_hours": { "start": 8, "end": 21, "timezone": "Europe/Copenhagen" },
  "actions": ["campaigns", "users", "sales", "calls"],
  "max_records": 200
}
```

### 4.2 Fjern duplikerede cron-jobs

**Problem:** LiveCronStatus viser allerede at der er "duplicate sync architecture" (baade provider-sync og direkte integration-engine jobs). Dette foraarsager skipped_locked entries og forvirring.

**Loesning:** Audit og konsolider til een sync-arkitektur pr. integration. Brug ScheduleEditor til at migrere alle til provider-sync modellen, og slet legacy per-integration cron jobs.

---

## Implementeringsraekkefoelge

| Fase | Opgave | Effekt | Indsats |
|------|--------|--------|---------|
| 1 | Global quota gate (1.1) | Eliminerer spildte API-kald naar kvote=0 | Lav |
| 1 | Fjern duplikerede cron jobs (4.2) | Renere logs, faerre skipped_locked | Lav |
| 2 | Transaktionel watermark (1.2) | Forhindrer data-tab ved crash | Medium |
| 2 | Dead letter queue (1.3) | Genbehandling af fejlede records | Medium |
| 3 | Health check function (2.1) | Proaktiv alarmering | Medium |
| 3 | Timeout guard (3.3) | Graceful haandtering af lange syncs | Lav |
| 4 | Centraliser config (4.1) | Nemmere vedligehold | Medium |
| 4 | Daglig summary (2.2) | Trend-indsigt | Lav |

---

## Tekniske filer der paavirkes

1. `supabase/functions/integration-engine/actions/sync-integration.ts` -- quota gate, timeout guard, dependency sequencing
2. `supabase/functions/integration-engine/actions/provider-sync.ts` -- quota gate paa provider-niveau
3. `supabase/functions/integration-engine/utils/circuit-breaker.ts` -- integration med quota gate
4. `supabase/functions/integration-engine/core/sales.ts` -- dead letter queue ved batch-fejl
5. Ny RPC-funktion til transaktionel watermark
6. Ny tabel: `sync_failed_records`
7. Ny tabel: `sync_daily_summary` (valgfri)
8. Ny edge function: `sync-health-check` (valgfri)
9. `src/hooks/useStabilityAlerts.ts` -- quota-aware alerting
10. `src/pages/SystemStability.tsx` -- trend-visning

Vil du starte med fase 1 (quota gate + oprydning af cron jobs)?

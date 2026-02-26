# Runbook: API Rate-Limit Stabilisering

## Formål
Denne runbook beskriver alle driftstiltag for at reducere 429-fejl og sikre stabil synkronisering.

## Implementerede stabilitetstiltag

### 1. Split Cron: Sales vs Meta
Alle integrationer kører nu to separate cron jobs:
- **Sales-sync**: Hver 5. minut (primær data)
- **Meta-sync**: Hver 30. minut (campaigns, users, sessions/calls)

Dette reducerer API-kald med ~60% da campaigns/users sjældent ændrer sig.

| Integration | Sales Schedule | Meta Schedule |
|---|---|---|
| Lovablecph (26fac751) | :03,:08,:13... | :05,:35 |
| Relatel (657c2050) | :00,:05,:10... | :10,:40 |
| Tryg (d79b9632) | :00,:05,:10... | :01,:31 |
| Eesy (a5068f85) | :02,:07,:12... | :03,:33 |
| ASE (a76cf63a) | :04,:09,:14... | :05,:35 |

### 2. Inkrementel Sales Sync
I stedet for at hente de sidste N dage ved hvert kald, bruger systemet nu en **watermark** (gemt i `dialer_sync_state`):
- Henter kun sales ændret siden `last_success_at` (med 5 min overlap)
- Buffer på 2 min for in-flight records
- Fallback til day-baseret fetch for nye integrationer

### 3. Circuit Breaker
Tabel: `integration_circuit_breaker`

| Consecutive failures | Pause-tid |
|---|---|
| 3 | 15 minutter |
| 5 | 30 minutter |
| 8+ | 60 minutter |

- Trigges ved 429-fejl eller når >50% af API-kald er rate-limited
- Nulstilles automatisk ved succesfuld sync
- Prevents hammering af blokeret API

### 4. Provider-Level Locking (Adversus)
`provider_sync_locks` tabel sikrer at kun én Adversus-sync kører ad gangen.
Enreach-integrationer bruger staggered cron schedules for kollisionsundgåelse.

### 5. Soft Fail-Fast på Meta Sync
Hvis campaigns/users sync rammer 429, logges en warning men sales-sync fortsætter.
Tidligere aborterede hele processen.

## Verifikation
Overvåg i System Stability:
- `integration_sync_runs`: Check `rate_limit_hits` og `api_calls_made`
- `integration_circuit_breaker`: Check om nogen er paused
- `integration_logs`: Check for "Circuit breaker" warnings

```sql
-- Check circuit breaker status
SELECT cb.*, di.name 
FROM integration_circuit_breaker cb
JOIN dialer_integrations di ON di.id = cb.integration_id
WHERE cb.consecutive_failures > 0 OR cb.paused_until > now();

-- Check sync run health (last hour)
SELECT di.name, isr.status, isr.api_calls_made, isr.rate_limit_hits, isr.duration_ms
FROM integration_sync_runs isr
JOIN dialer_integrations di ON di.id = isr.integration_id
WHERE isr.started_at > now() - interval '1 hour'
ORDER BY isr.started_at DESC;
```

## Rollback
For at gendanne combined cron jobs:
1. Slet split-jobs: `SELECT cron.unschedule('<jobid>')` for alle `-sync-sales` og `-sync-meta` jobs
2. Genskab combined jobs med `actions: ["campaigns","users","sales","sessions"]`

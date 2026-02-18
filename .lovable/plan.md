
# Adversus Rate-Limit Fix: Komplet Implementeringsplan

## 1. Validation af nuværende state

### Aktive cron jobs

| JobID | Jobnavn | Schedule | Actions | Integration |
|-------|---------|----------|---------|-------------|
| 47 | `dialer-26fac751-sync` | `1,11,21,31,41,51 * * * *` (hvert 10 min) | `campaigns,users,sales,sessions` | Lovablecph (TDC) |
| 48 | `dialer-657c2050-sync` | `6,16,26,36,46,56 * * * *` (hvert 10 min) | `campaigns,users,sales,sessions` | Relatel_CPHSALES |

**Bekræftet:** Begge kører ALLE 4 actions hvert 10. minut med kun 5 minutters offset.

### Fejlrate (sidste 24 timer)

| Integration | Succes | Fejl | Fejlrate |
|-------------|--------|------|----------|
| Lovablecph | 3 | 22 | **88%** |
| Relatel_CPHSALES | 228 | 23 | 9% |

**Lovablecph:** Sidste succesfulde sync: `2026-02-18 14:52` — alle fejl er `Rate Limit Adversus Excedido (after retries)`.
**Relatel:** Kører stabilt (10 sales pr. run), men bidrager til samlet credential-load.

### Sessions 403

**Bekræftet:** Lovablecph (TDC) returnerer HTTP 403 på `/v1/sessions`. Sessions-action skal fjernes permanent for denne integration.

### Credential-deling

Begge integrationer deler Adversus API-credentials. Med 5 min offset og ~2-4 min runtime per run overlapper de regelmæssigt → 429.

---

## 2. Final Change Plan (lav risiko)

### Princip
- **Sales:** Hyppigt (det kritiske data) — separate jobs
- **Metadata** (campaigns, users): Sjældent (1x/time) — ændrer sig sjældent
- **Sessions:** Kun for Relatel (hvor endpoint virker), 1x/time i metadata-job
- **Minimum gap:** 12+ minutter mellem jobs der deler credentials

### Nye schedules

| Job | Integration | Schedule | Actions | API-kald/run |
|-----|------------|----------|---------|-------------|
| `dialer-26fac751-sync` | Lovablecph sales | `4,19,34,49 * * * *` (hvert 15 min) | `sales` | ~15-25 |
| `dialer-657c2050-sync` | Relatel sales | `1,11,21,31,41,51 * * * *` (hvert 10 min) | `sales` | ~15-25 |
| `dialer-26fac751-meta` | Lovablecph meta | `5 * * * *` (1x/time) | `campaigns,users` | ~3 |
| `dialer-657c2050-meta` | Relatel meta | `35 * * * *` (1x/time) | `campaigns,users,sessions` | ~5 |

### Frekvens-valg: Lovablecph 15 min (ikke 10 min)

**Begrundelse:**
- TDC har lavere salgsvolumen end Relatel → 15 min er tilstrækkeligt
- Giver bedre separation fra Relatel-runs
- Reducerer samlet API-load med 33% for denne integration
- Kan justeres til 10 min senere hvis nødvendigt

---

## 3. Executable SQL

### Trin 1: Unschedule gamle jobs

```sql
SELECT cron.unschedule('dialer-26fac751-sync');
SELECT cron.unschedule('dialer-657c2050-sync');
```

### Trin 2: Schedule nye jobs

```sql
-- Lovablecph: KUN sales, hvert 15 min, offset :04
SELECT cron.schedule(
  'dialer-26fac751-sync',
  '4,19,34,49 * * * *',
  $$SELECT net.http_post(
    url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/integration-engine',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bGltbWVpanBmbWFrc3ZtdXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzQ1MjMsImV4cCI6MjA4MDI1MDUyM30.LbC-t03QXt5FJUHyD5fVff3OHdqYv7uWD-tFOBNyOVI"}'::jsonb,
    body := '{"days": 1, "source": "adversus", "actions": ["sales"], "integration_id": "26fac751-c2d8-4b5b-a6df-e33a32e3c6e7"}'::jsonb
  ) AS request_id;$$
);

-- Relatel: KUN sales, hvert 10 min, offset :01
SELECT cron.schedule(
  'dialer-657c2050-sync',
  '1,11,21,31,41,51 * * * *',
  $$SELECT net.http_post(
    url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/integration-engine',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bGltbWVpanBmbWFrc3ZtdXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzQ1MjMsImV4cCI6MjA4MDI1MDUyM30.LbC-t03QXt5FJUHyD5fVff3OHdqYv7uWD-tFOBNyOVI"}'::jsonb,
    body := '{"days": 1, "source": "adversus", "actions": ["sales"], "integration_id": "657c2050-1faa-4233-a964-900fb9e7b8c6"}'::jsonb
  ) AS request_id;$$
);

-- Lovablecph metadata: campaigns+users, 1x/time, minut :05
SELECT cron.schedule(
  'dialer-26fac751-meta',
  '5 * * * *',
  $$SELECT net.http_post(
    url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/integration-engine',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bGltbWVpanBmbWFrc3ZtdXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzQ1MjMsImV4cCI6MjA4MDI1MDUyM30.LbC-t03QXt5FJUHyD5fVff3OHdqYv7uWD-tFOBNyOVI"}'::jsonb,
    body := '{"days": 1, "source": "adversus", "actions": ["campaigns", "users"], "integration_id": "26fac751-c2d8-4b5b-a6df-e33a32e3c6e7"}'::jsonb
  ) AS request_id;$$
);

-- Relatel metadata: campaigns+users+sessions, 1x/time, minut :35
SELECT cron.schedule(
  'dialer-657c2050-meta',
  '35 * * * *',
  $$SELECT net.http_post(
    url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/integration-engine',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bGltbWVpanBmbWFrc3ZtdXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzQ1MjMsImV4cCI6MjA4MDI1MDUyM30.LbC-t03QXt5FJUHyD5fVff3OHdqYv7uWD-tFOBNyOVI"}'::jsonb,
    body := '{"days": 1, "source": "adversus", "actions": ["campaigns", "users", "sessions"], "integration_id": "657c2050-1faa-4233-a964-900fb9e7b8c6"}'::jsonb
  ) AS request_id;$$
);
```

### Trin 3: Opdater dialer_integrations config

```sql
-- Lovablecph: ny sync_schedule + marker at sessions er disabled
UPDATE dialer_integrations
SET config = jsonb_set(
  jsonb_set(
    COALESCE(config, '{}'::jsonb),
    '{sync_schedule}',
    '"4,19,34,49 * * * *"'
  ),
  '{sync_actions}',
  '["sales"]'
),
updated_at = now()
WHERE id = '26fac751-c2d8-4b5b-a6df-e33a32e3c6e7';

-- Relatel: ny sync_schedule
UPDATE dialer_integrations
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{sync_schedule}',
  '"1,11,21,31,41,51 * * * *"'
),
updated_at = now()
WHERE id = '657c2050-1faa-4233-a964-900fb9e7b8c6';
```

---

## 4. Backfill Steps

### Manuel kørsel for Lovablecph (kør efter cron-ændring)

```sql
SELECT net.http_post(
  url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/integration-engine',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bGltbWVpanBmbWFrc3ZtdXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzQ1MjMsImV4cCI6MjA4MDI1MDUyM30.LbC-t03QXt5FJUHyD5fVff3OHdqYv7uWD-tFOBNyOVI'
  ),
  body := '{"source": "adversus", "integration_id": "26fac751-c2d8-4b5b-a6df-e33a32e3c6e7", "actions": ["campaigns", "users", "sales"], "days": 1}'::jsonb
);
```

**Hvornår `days: 3`:** Kun hvis backfill med `days: 1` viser manglende sales fra 2+ dage. Ellers hold `days: 1`.

### Verificer backfill

```sql
SELECT DATE(sale_datetime) as dag, COUNT(*) as antal
FROM sales
WHERE created_at > now() - interval '3 days'
  AND source = 'adversus'
  AND dialer_campaign_id IN (
    SELECT adversus_campaign_id FROM adversus_campaign_mappings
    WHERE client_campaign_id IN (
      SELECT id FROM client_campaigns WHERE client_id = (
        SELECT id FROM clients WHERE name ILIKE '%TDC%' LIMIT 1
      )
    )
  )
GROUP BY DATE(sale_datetime)
ORDER BY dag DESC;
```

---

## 5. Verification Checklist (24-48 timer)

### Success criteria
- [ ] Lovablecph 429-rate < 5% (ned fra 88%)
- [ ] Lovablecph sales > 0 pr. sync-run
- [ ] Relatel succes-rate forbliver > 90%
- [ ] Ingen overlap-relaterede fejl i logs

### SQL monitoring queries

```sql
-- 429-rate pr. integration (sidste 24 timer)
SELECT 
  integration_name,
  COUNT(*) FILTER (WHERE status = 'success') as success,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'error') / NULLIF(COUNT(*), 0), 1) as error_pct
FROM integration_logs
WHERE integration_name IN ('Lovablecph', 'Relatel_CPHSALES')
  AND created_at > now() - interval '24 hours'
GROUP BY integration_name;

-- Sales importeret pr. run (sidste 6 timer)
SELECT 
  integration_name, created_at, message,
  details->'results'->'sales'->>'processed' as sales_processed
FROM integration_logs
WHERE integration_name IN ('Lovablecph', 'Relatel_CPHSALES')
  AND status = 'success'
  AND created_at > now() - interval '6 hours'
ORDER BY created_at DESC LIMIT 20;

-- Bekræft nye cron jobs
SELECT jobid, jobname, schedule, 
  CASE 
    WHEN command LIKE '%"sales"%' AND command NOT LIKE '%"campaigns"%' THEN 'sales-only'
    WHEN command LIKE '%"campaigns"%' THEN 'metadata'
    ELSE 'unknown'
  END as job_type
FROM cron.job 
WHERE jobname LIKE '%26fac751%' OR jobname LIKE '%657c2050%'
ORDER BY jobname;
```

---

## 6. Rollback

```sql
-- 1. Fjern nye jobs
SELECT cron.unschedule('dialer-26fac751-sync');
SELECT cron.unschedule('dialer-657c2050-sync');
SELECT cron.unschedule('dialer-26fac751-meta');
SELECT cron.unschedule('dialer-657c2050-meta');

-- 2. Genskab originale jobs
SELECT cron.schedule(
  'dialer-26fac751-sync',
  '1,11,21,31,41,51 * * * *',
  $$SELECT net.http_post(
    url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/integration-engine',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bGltbWVpanBmbWFrc3ZtdXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzQ1MjMsImV4cCI6MjA4MDI1MDUyM30.LbC-t03QXt5FJUHyD5fVff3OHdqYv7uWD-tFOBNyOVI"}'::jsonb,
    body := '{"days": 1, "source": "adversus", "actions": ["campaigns", "users", "sales", "sessions"], "integration_id": "26fac751-c2d8-4b5b-a6df-e33a32e3c6e7"}'::jsonb
  ) AS request_id;$$
);

SELECT cron.schedule(
  'dialer-657c2050-sync',
  '6,16,26,36,46,56 * * * *',
  $$SELECT net.http_post(
    url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/integration-engine',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bGltbWVpanBmbWFrc3ZtdXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzQ1MjMsImV4cCI6MjA4MDI1MDUyM30.LbC-t03QXt5FJUHyD5fVff3OHdqYv7uWD-tFOBNyOVI"}'::jsonb,
    body := '{"days": 1, "source": "adversus", "actions": ["campaigns", "users", "sales", "sessions"], "integration_id": "657c2050-1faa-4233-a964-900fb9e7b8c6"}'::jsonb
  ) AS request_id;$$
);

-- 3. Revert config
UPDATE dialer_integrations
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb) - 'sync_actions',
  '{sync_schedule}',
  '"1,11,21,31,41,51 * * * *"'
),
updated_at = now()
WHERE id = '26fac751-c2d8-4b5b-a6df-e33a32e3c6e7';

UPDATE dialer_integrations
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{sync_schedule}',
  '"6,16,26,36,46,56 * * * *"'
),
updated_at = now()
WHERE id = '657c2050-1faa-4233-a964-900fb9e7b8c6';
```

---

## 7. Phase 2: maxRecords optimering (separat, ikke blokerende)

### Problem
`maxRecords` (200) filtrerer EFTER `adapter.fetchSales()` → `buildLeadDataMap()` kalder stadig Adversus API for ALLE leads.

### Minimal patch-plan
1. Tilføj `maxRecords` parameter til `AdversusAdapter.fetchSales()`
2. I `buildLeadDataMap()`: stop efter `maxRecords` unikke leads er hentet
3. Return early fra lead-fetching loop

### Risikovurdering
- **Lav risiko** — ændrer kun fetch-volumen, ikke data-behandling
- **Kræver test** at sortering + limit giver korrekte nyeste sales
- **Anbefaling:** Implementer efter Phase 1 er bekræftet stabil (24-48 timer)

---

## Eksekveringsrækkefølge

1. Kør "Unschedule gamle jobs" SQL
2. Kør "Schedule nye jobs" SQL (alle 4 statements)
3. Kør "Opdater config" SQL
4. Kør backfill for Lovablecph
5. Monitorér i 24-48 timer via verification queries
6. Phase 2: maxRecords optimering (efter stabilitet bekræftet)

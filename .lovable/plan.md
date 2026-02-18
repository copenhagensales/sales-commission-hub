

# Systemstabilitet -- Adversus Integrations Dashboard

## Oversigt

En ny underside under `/system-stability` der giver realtids-overblik over alle Adversus (og Enreach) integrationers sundhed, med visuelle metrics, tidslinje-overlap-detektion og direkte styring af sync-frekvens og scheduling -- alt sammen med audit log og rollback.

---

## 1. Datamodel og nye tabeller

### 1a. `integration_sync_runs` (ny tabel)

Lagrer hvert sync-run med detaljerede metrics. Udfyldes af `integration-engine` ved afslutning af hvert run.

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | |
| integration_id | uuid FK | Reference til `dialer_integrations.id` |
| started_at | timestamptz | |
| completed_at | timestamptz | |
| duration_ms | integer | Beregnet varighed |
| status | text | `success`, `error`, `partial` |
| actions | text[] | Hvilke actions blev krt |
| records_processed | integer | Antal records |
| api_calls_made | integer | Antal API-kald |
| retries | integer | Antal retries i dette run |
| rate_limit_hits | integer | Antal 429-responses |
| error_message | text | Evt. fejlbesked |

### 1b. `integration_schedule_audit` (ny tabel)

Audit log for alle scheduling-andringer.

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | |
| integration_id | uuid | |
| changed_by | uuid | auth.uid() |
| change_type | text | `schedule_update`, `frequency_change`, `rollback` |
| old_config | jsonb | Tidligere config snapshot |
| new_config | jsonb | Ny config |
| old_schedule | text | Tidligere cron expression |
| new_schedule | text | Ny cron expression |
| created_at | timestamptz | |

### 1c. Udvidelse af `integration_logs`

Tilf felter til eksisterende tabel via migration:

- `duration_ms` (integer, nullable)
- `api_calls` (integer, nullable)
- `retries` (integer, nullable)
- `rate_limit_hits` (integer, nullable)

---

## 2. Beregnede Metrics (hentet via SQL/hooks)

Alle metrics beregnes fra `integration_sync_runs` + `integration_logs`:

- **Succes-rate (%)**: `COUNT(status=success) / COUNT(*)` for sidste 1h / 24h
- **429-rate (%)**: `SUM(rate_limit_hits) / SUM(api_calls)` for sidste 15/60 min
- **Gennemsnitlig varighed**: `AVG(duration_ms)` pr. integration
- **Estimeret budget-forbrug**: `SUM(api_calls sidste 15 min) / rate_limit_budget * 100`
- **Overlap-score**: Beregnet i frontend ud fra cron-expressions

---

## 3. UI-wireframe (kort)

```text
+---------------------------------------------------------------+
| Systemstabilitet                                    [Opdater]  |
+---------------------------------------------------------------+
|                                                                |
|  +-- Status Cards (1 per integration) ---+                     |
|  | [Lovablecph]      [Relatel]     [Eesy] ...                  |
|  | Status: OK (gron) | OK (gron) | OK (gron)                  |
|  | 429-rate: 2%      | 0%        | 0%                         |
|  | Succes: 95%       | 100%      | 100%                       |
|  | Sidste sync: 2m   | 1m        | 30s                        |
|  | Varighed: 4.2s    | 2.1s      | 3.8s                       |
|  +--------------------------------------------+               |
|                                                                |
|  +-- Rate Limit Budget Gauge ---+                              |
|  | [===-------] 23% brugt (15 min)                             |
|  | [====------] 41% brugt (60 min)                             |
|  +------------------------------+                              |
|                                                                |
|  +-- Tidslinje (60 min) ---------------------------+           |
|  | :00 :05 :10 :15 :20 :25 :30 :35 :40 :45 :50 :55|           |
|  | Lovablecph  [=]      [=]      [=]      [=]      |           |
|  | Relatel  [=]   [=]   [=]   [=]   [=]   [=]      |           |
|  | Eesy  [=][=][=][=][=][=][=][=][=][=][=][=]       |           |
|  | Overlap-advarsler markeret med rod               |           |
|  +--------------------------------------------------+          |
|                                                                |
|  +-- Styring --------------------------------+                 |
|  | Integration: [Lovablecph v]               |                 |
|  | Sync-frekvens: [15 min v]                 |                 |
|  | Minut-offset: [4,19,34,49]  (redigerbar)  |                 |
|  | Actions: [x] Sales [ ] Campaigns [x] Meta |                 |
|  | [Preview konflikter]  [Gem]               |                 |
|  +-------------------------------------------+                 |
|                                                                |
|  +-- Seneste Runs (tabel) ---+                                 |
|  | Tid | Integration | Status | Varighed | API | 429s | Retry  |
|  +-------------------------------------------+                 |
|                                                                |
|  +-- Audit Log ---+                                            |
|  | Tid | Bruger | Andring | Gammel | Ny | [Rollback]           |
|  +-----------------+                                           |
+---------------------------------------------------------------+
```

---

## 4. Implementeringsplan i faser

### Fase 1 -- MVP (datalager + skrivbar)

**Database:**
- Opret `integration_sync_runs` tabel
- Opret `integration_schedule_audit` tabel
- Tilf `duration_ms`, `api_calls`, `retries`, `rate_limit_hits` kolonner til `integration_logs`
- RLS policies: kun `is_owner()` eller `is_teamleder_or_above()` kan lase og skrive

**Edge function (integration-engine):**
- Ved afslutning af hvert sync-run: INSERT i `integration_sync_runs` med alle metrics
- Tal retries og 429-hits i AdversusAdapter og pass dem op

**Edge function (update-cron-schedule):**
- Tilf audit log INSERT ved hver schedule-andring (gammel/ny config + schedule)

**Frontend:**
- Ny side-komponent: `src/pages/SystemStability.tsx`
- Route: `/system-stability`, tilgangelig for `ejer` og `teamleder`
- Status-kort pr. integration med farve-indikator (gron/gul/rod baseret pa 429-rate og succes-rate)
- Tabel med seneste runs
- Simpel audit log visning

### Fase 2 -- Visuel styring

**Frontend:**
- Frekvens-dropdown (5/10/15/30/60 min) pr. integration
- Redigerbar minut-offset (cron expression input)
- Preview-funktion: beregn overlap mellem alle aktive cron jobs for de deles API-credentials
- Advarsel hvis jobs overlapper inden for 2 minutter
- Gem-knap kalder `update-cron-schedule` edge function
- Automatisk INSERT i `integration_schedule_audit` (via edge function)

### Fase 3 -- Avanceret visualisering

**Frontend:**
- Tidslinje-komponent (Recharts / custom SVG) der viser alle jobs pa en 60-min akse
- Rate limit budget gauge (progress bar: % af estimeret budget brugt)
- Trend-graf: 429-rate over tid (sidste 24h)
- Rollback-knap i audit log (kalder `update-cron-schedule` med `old_config`)

---

## 5. SQL/API-andringer

### Nye migrationer:

```sql
-- Tabel: integration_sync_runs
CREATE TABLE integration_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES dialer_integrations(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  status text NOT NULL DEFAULT 'running',
  actions text[],
  records_processed integer DEFAULT 0,
  api_calls_made integer DEFAULT 0,
  retries integer DEFAULT 0,
  rate_limit_hits integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabel: integration_schedule_audit
CREATE TABLE integration_schedule_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES dialer_integrations(id),
  changed_by uuid,
  change_type text NOT NULL,
  old_config jsonb,
  new_config jsonb,
  old_schedule text,
  new_schedule text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Udvid integration_logs
ALTER TABLE integration_logs
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS api_calls integer,
  ADD COLUMN IF NOT EXISTS retries integer,
  ADD COLUMN IF NOT EXISTS rate_limit_hits integer;

-- Index for hurtige opslag
CREATE INDEX idx_sync_runs_integration_time
  ON integration_sync_runs (integration_id, started_at DESC);
CREATE INDEX idx_schedule_audit_integration_time
  ON integration_schedule_audit (integration_id, created_at DESC);

-- RLS
ALTER TABLE integration_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_schedule_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can read sync runs"
  ON integration_sync_runs FOR SELECT
  USING (is_teamleder_or_above(auth.uid()));

CREATE POLICY "Managers can read audit log"
  ON integration_schedule_audit FOR SELECT
  USING (is_teamleder_or_above(auth.uid()));

CREATE POLICY "Service role inserts sync runs"
  ON integration_sync_runs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role inserts audit"
  ON integration_schedule_audit FOR INSERT
  WITH CHECK (true);
```

### API (edge function) andringer:

- `integration-engine/actions/sync-integration.ts`: Tilf tracking af `api_calls`, `retries`, `rate_limit_hits` og INSERT i `integration_sync_runs`
- `update-cron-schedule/index.ts`: INSERT i `integration_schedule_audit` med `old_config`/`new_config` ved alle schedule-andringer

---

## 6. Acceptance Criteria for "Stabil Drift"

| Metric | Terskel | Beskrivelse |
|--------|---------|-------------|
| 429-rate | < 5% | Andel af API-kald der far 429 over 1 time |
| Succes-rate | > 95% | Andel af sync-runs der fuldforer uden fejl |
| Max overlap | < 2 min | Minimum afstand mellem jobs der deler credentials |
| Sync latency | < 15 min | Tid fra salg registreres i Adversus til det vises i systemet |
| Varighed pr. run | < 30s | Gennemsnitlig run-varighed (ekskl. outliers) |
| Audit trail | 100% | Alle schedule-andringer logges med rollback-mulighed |

---

## 7. Teknisk arkitektur

**Nye filer:**
- `src/pages/SystemStability.tsx` -- hovedside
- `src/components/system-stability/IntegrationStatusCards.tsx`
- `src/components/system-stability/SyncRunsTable.tsx`
- `src/components/system-stability/ScheduleEditor.tsx`
- `src/components/system-stability/TimelineOverlap.tsx`
- `src/components/system-stability/RateLimitGauge.tsx`
- `src/components/system-stability/AuditLog.tsx`
- `src/hooks/useIntegrationSyncRuns.ts`
- `src/hooks/useScheduleAudit.ts`
- `src/utils/cronOverlapDetector.ts` -- parser cron expressions og finder overlap

**Rute:** Tilf `/system-stability` i `src/routes/config.tsx` med `access: "role"` og `roles: ["ejer", "teamleder"]`

**Datahentning:** React Query hooks med 30s auto-refetch for realtids-folelse


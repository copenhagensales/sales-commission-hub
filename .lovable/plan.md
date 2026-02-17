

# Robust Sessions-sync: Komplet implementeringsplan

## Hvad bygges

En komplet sessions-ingest pipeline der henter ALLE opkaldsudfald (ikke kun salg) fra Adversus og Enreach, med idempotent incremental sync, rate limit haandtering og et analytics-lag til hitrate-beregninger. Samtidig fixes `buildLeadDataMap` saa alle leads hentes korrekt uanset kampagnestoerrelse.

---

## A) Database migrationer (4 migrationer, additiv, non-breaking)

### Migration 1: `dialer_sessions` tabel
Ny tabel til ALLE session-udfald. Schema:
- `id uuid PK DEFAULT gen_random_uuid()`
- `integration_id uuid NOT NULL FK -> dialer_integrations(id) ON DELETE CASCADE`
- `external_id text NOT NULL`
- `lead_external_id text`, `agent_external_id text`, `campaign_external_id text`
- `status text NOT NULL` (success, notInterested, unqualified, invalid, automaticRedial, privateRedial, noAnswer, busy, unknown)
- `start_time timestamptz`, `end_time timestamptz`, `session_seconds integer`
- `has_cdr boolean DEFAULT false`, `cdr_duration_seconds integer`, `cdr_disposition text`
- `source text NOT NULL DEFAULT 'adversus'`
- `metadata jsonb DEFAULT '{}'::jsonb`
- `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`
- UNIQUE `(integration_id, external_id)`

Indekser:
- `(integration_id, start_time DESC)`
- `(integration_id, campaign_external_id, start_time DESC)`
- `(integration_id, agent_external_id, start_time DESC)`
- `(integration_id, status, start_time DESC)`

RLS (same pattern som `dialer_calls`):
- SELECT: `is_manager_or_above(auth.uid())`
- INSERT: service role (WITH CHECK true)
- UPDATE: service role (WITH CHECK true)

Trigger: `updated_at = now()` paa UPDATE via custom trigger function (moddatetime er ikke installeret).

### Migration 2: `dialer_sync_state` tabel
- `integration_id uuid NOT NULL FK -> dialer_integrations(id) ON DELETE CASCADE`
- `dataset text NOT NULL` (sales, calls, sessions, users, campaigns)
- `last_success_at timestamptz`
- `cursor text`
- `last_error_at timestamptz`, `last_error text`
- `updated_at timestamptz NOT NULL DEFAULT now()`
- PK `(integration_id, dataset)`

RLS: SELECT for `is_manager_or_above`, service role INSERT/UPDATE.

### Migration 3: `integration_id` paa `dialer_calls`
- `ALTER TABLE dialer_calls ADD COLUMN integration_id uuid REFERENCES dialer_integrations(id)` (nullable)
- Backfill: `UPDATE dialer_calls dc SET integration_id = di.id FROM dialer_integrations di WHERE dc.dialer_name = di.name`
- Index: `(integration_id, start_time DESC)`
- Bevarer eksisterende UNIQUE `(external_id, integration_type, dialer_name)` - INGEN breaking change

### Migration 4: Aggregeret view
```text
CREATE VIEW dialer_session_daily_metrics AS
SELECT
  date_trunc('day', start_time)::date AS date,
  integration_id,
  campaign_external_id,
  agent_external_id,
  COUNT(*) AS total_sessions,
  COUNT(*) FILTER (WHERE status = 'success') AS success_sessions,
  COUNT(*) FILTER (WHERE status = 'notInterested') AS not_interested_sessions,
  COUNT(*) FILTER (WHERE status = 'invalid') AS invalid_sessions,
  COUNT(*) FILTER (WHERE status = 'unqualified') AS unqualified_sessions,
  COUNT(*) FILTER (WHERE status IN ('automaticRedial','privateRedial')) AS redial_sessions,
  AVG(session_seconds) FILTER (WHERE session_seconds > 0) AS avg_session_seconds,
  COUNT(*) FILTER (WHERE has_cdr = true) AS sessions_with_calls,
  AVG(cdr_duration_seconds) FILTER (WHERE has_cdr AND cdr_duration_seconds > 0) AS avg_call_duration
FROM dialer_sessions
WHERE start_time IS NOT NULL
GROUP BY 1,2,3,4;
```

---

## B) Integration engine aendringer

### B1: `types.ts` - Tilfoej `StandardSession`
Ny interface med: `externalId`, `integrationType`, `dialerName`, `leadExternalId`, `agentExternalId`, `campaignExternalId`, `status`, `startTime`, `endTime`, `sessionSeconds`, `hasCdr`, `cdrDurationSeconds`, `cdrDisposition`, `metadata`.

### B2: `adapters/interface.ts` - Tilfoej optional metoder
- `fetchSessions?(days: number): Promise<StandardSession[]>`
- `fetchSessionsRange?(range: DateRange): Promise<StandardSession[]>`

### B3: `adapters/adversus.ts` - 2 aendringer

**Ny `fetchSessions` + `fetchSessionsRange`**:
- Kalder Adversus `/sessions` endpoint med `startTime` filter
- Paginering med `pageSize=1000`, `sortProperty=startTime`, `sortDirection=DESC`
- Henter ALLE statuses (success, notInterested, unqualified, invalid, automaticRedial, privateRedial)
- CDR fra session objekt (sessionSeconds, cdr data)
- Rate limit retry med exponential backoff

**Refactor `buildLeadDataMap`** (linje 422-609):
- Fjern bulk kampagne-fetch loop (linje 449-536) der fejler paa 5000+ leads
- Udtraek unikke `leadId`s fra salgsarrayet
- Batch-fetch alle via eksisterende `fetchLeadById` i grupper af 5 med 200ms delay
- Fjern `MAX_FALLBACK_LEADS = 20` begransning
- Output-format 100% identisk: `Map<leadId, { opp, resultData, resultFields }>`
- OPP-pattern matching og resultFields-parsing bevares uaendret

### B4: `adapters/enreach.ts` - Ny `fetchSessions`
- Genbruger `/simpleleads?AllClosedStatuses=true` endpoint (dataen hentes allerede)
- Mapper ALLE closures til StandardSession (ikke kun Success)
- Status-mapping: `Success` -> `success`, andre closure vaerdier lowercase direkte
- Logger unikke closure-typer per koersel for diagnostik
- Ingen ekstra API-kald
- Genbruger `processPageByPage` med ny generisk version der returnerer `StandardSession[]`

### B5: Nye utility-filer

**`utils/rate-limiter.ts`** (ny fil):
- Sliding window rate limiter per integration
- `maxPerMinute: 55`, `maxPerHour: 900` (buffer under Adversus limits)
- `waitForSlot()`: async metode der venter hvis over limit
- 429-haandtering: Retry-After + exponential backoff + jitter

**`utils/sync-state.ts`** (ny fil):
- `getSyncState(supabase, integrationId, dataset)` -> laes fra `dialer_sync_state`
- `upsertSyncState(supabase, integrationId, dataset, lastSuccessAt, cursor?)` -> upsert
- `recordSyncError(supabase, integrationId, dataset, errorMsg)` -> gem fejl

### B6: `core/sessions.ts` (ny fil)
`processSessions(supabase, sessions, integrationId, batchSize, log)`:
- Agent-matching via `agents` tabel (same pattern som `core/calls.ts` linje 96-131)
- Lookup via `agentMapByExtId`, `agentMapByDialerId`, `agentMapByEmail`
- Batch-upsert til `dialer_sessions` med `onConflict: "integration_id,external_id"`
- `ignoreDuplicates: false` (opdater eksisterende)
- Return `{ processed, errors, matched, duplicates }`

### B7: `core/index.ts` - Re-eksporter `processSessions`

### B8: `core.ts` - Tilfoej `processSessions` metode paa `IngestionEngine`

### B9: `actions/sync-integration.ts` - Tilfoej sessions action

Kritisk backward compatibility: Aendr linje 61:
```text
// FRA:
const actionList = actions || (action === "sync" ? ["campaigns", "users", "sales"] : [action]);
// TIL:
const actionList = actions || (action === "sync" ? ["campaigns", "users", "sales", "sessions"] : [action]);
```

Sessions action flow:
1. Laes sync state fra `dialer_sync_state`
2. Beregn vindue: `start = last_success_at - 5min overlap`, `stop = now - 2min`
3. Fallback for foerste koersel: `days` parameter
4. Fetch via adapter (`fetchSessionsRange` eller `fetchSessions`)
5. Process via `engine.processSessions`
6. Opdater sync state ved success/error

### B10: `utils/index.ts` - Re-eksporter nye utils

---

## C) Cron integration

### `update-cron-schedule/index.ts`
Aendr dialer payload (linje 50-55):
```text
// FRA:
payload = { source: provider, integration_id, action: "sync", days: 1 };
// TIL:
payload = { source: provider, integration_id, actions: ["campaigns", "users", "sales", "sessions"], days: 1 };
```

Eksisterende cron jobs med `action: "sync"` forbliver kompatible via fallback i B9.

---

## D) Filer der EKSPLICIT IKKE roeres

| Fil | Grund |
|-----|-------|
| `core/sales.ts` | Straksbetalings-preservation, pricing rules, email filter uaendret |
| `core/calls.ts` | CDR processing, UNIQUE constraint uaendret |
| `core/normalize.ts` | Data normalisering uaendret |
| `core/campaigns.ts` | Uaendret |
| `core/users.ts` | Uaendret |
| `core/mappings.ts` | Uaendret |
| `index.ts` (entry point) | Action routing allerede fleksibelt |
| Alle FM edge functions | FM-data har source='fieldmarketing', aldrig i dialer_sessions |
| `calculate-leaderboard-*` | Bruger `sales` + `sale_items`, ikke sessions |
| `tv-dashboard-data` | Bruger `sales` tabel, ikke sessions |

---

## E) Komplet filliste

| Fil | Type | Risiko |
|-----|------|--------|
| DB Migration 1: `dialer_sessions` | Ny tabel | Lav |
| DB Migration 2: `dialer_sync_state` | Ny tabel | Lav |
| DB Migration 3: `dialer_calls` + `integration_id` | Additivt | Medium (verify backfill) |
| DB Migration 4: `dialer_session_daily_metrics` view | Nyt view | Lav |
| `integration-engine/types.ts` | Tilfoej interface | Lav |
| `integration-engine/adapters/interface.ts` | Tilfoej optional metoder | Lav |
| `integration-engine/adapters/adversus.ts` | fetchSessions + buildLeadDataMap fix | Hoej |
| `integration-engine/adapters/enreach.ts` | fetchSessions | Medium |
| `integration-engine/core/sessions.ts` | Ny fil | Lav |
| `integration-engine/core/index.ts` | Re-eksport | Lav |
| `integration-engine/core.ts` | Tilfoej metode | Lav |
| `integration-engine/actions/sync-integration.ts` | Sessions action + backward compat | Medium |
| `integration-engine/utils/rate-limiter.ts` | Ny fil | Lav |
| `integration-engine/utils/sync-state.ts` | Ny fil | Lav |
| `integration-engine/utils/index.ts` | Re-eksport | Lav |
| `update-cron-schedule/index.ts` | Payload aendring | Lav |

---

## F) Non-regression gates

Foer deploy verificeres:

1. **Backfill match quality**: `SELECT dialer_name, COUNT(*), COUNT(integration_id) FROM dialer_calls GROUP BY 1` - alle 5 integrationer skal matche
2. **Sales sync integritet**: Koer `actions: ["sales"]` og verificer pricing rules + `is_immediate_payment` preservation
3. **FM dashboards**: `SELECT COUNT(*) FROM sales WHERE source = 'fieldmarketing'` - uaendret
4. **Calls sync**: `SELECT COUNT(*) FROM dialer_calls` - uaendret deduplicering
5. **Cron backward compat**: Eksisterende `action: "sync"` payload giver samme resultat + sessions

## G) Testplan

1. Deploy edge functions
2. `POST integration-engine { integration_id: "26fac...", actions: ["sessions"], days: 1 }` (Adversus)
3. Verificer records i `dialer_sessions` med alle status-typer
4. Verificer `dialer_sync_state` opdateret
5. Koer igen -> ingen duplikater (idempotens)
6. `POST integration-engine { integration_id: "d79b9632...", actions: ["sessions"], days: 1 }` (Enreach)
7. Verificer Enreach closure-typer logget
8. `SELECT * FROM dialer_session_daily_metrics LIMIT 10` -> hitrate aggregering
9. Koer fuld `action: "sync"` -> backward compatible med sessions inkluderet


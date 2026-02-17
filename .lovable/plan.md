
# Robust Sessions-sync: Komplet Implementeringsplan

## Hvad bygges

En komplet sessions-ingest pipeline der henter ALLE opkaldsudfald (ikke kun salg) fra Adversus og Enreach, med idempotent incremental sync, rate limit haandtering og et analytics-lag til hitrate-beregninger. Samtidig fixes `buildLeadDataMap` saa alle leads hentes korrekt uanset kampagnestoerrelse.

**Nul-regression garanti**: Ingen aendringer i sales-processing, pricing rules, straksbetalinger, fieldmarketing, eller eksisterende calls-flow.

---

## A) DATABASE MIGRATIONER (4 additive, non-breaking)

### Migration 1: `dialer_sessions` tabel

Ny tabel til at gemme ALLE session-udfald (success, notInterested, unqualified, invalid, etc.):

```text
dialer_sessions
  id                    uuid PK DEFAULT gen_random_uuid()
  integration_id        uuid NOT NULL FK -> dialer_integrations(id) ON DELETE CASCADE
  external_id           text NOT NULL
  lead_external_id      text
  agent_external_id     text
  campaign_external_id  text
  status                text NOT NULL
  start_time            timestamptz
  end_time              timestamptz
  session_seconds       integer
  has_cdr               boolean DEFAULT false
  cdr_duration_seconds  integer
  cdr_disposition       text
  source                text NOT NULL DEFAULT 'adversus'
  metadata              jsonb DEFAULT '{}'::jsonb
  created_at            timestamptz DEFAULT now()
  updated_at            timestamptz DEFAULT now()

  UNIQUE (integration_id, external_id)
```

Indekser:
- `(integration_id, start_time DESC)`
- `(integration_id, campaign_external_id, start_time DESC)`
- `(integration_id, agent_external_id, start_time DESC)`
- `(integration_id, status, start_time DESC)`

RLS (same pattern som `dialer_calls`):
- Enabled
- SELECT: `is_teamleder_or_above(auth.uid())`
- INSERT: service role (WITH CHECK true)
- UPDATE: service role (WITH CHECK true)

Trigger: Custom `updated_at` trigger paa UPDATE (moddatetime extension er ikke installeret).

### Migration 2: `dialer_sync_state` tabel

Incremental sync watermark/cursor tracking:

```text
dialer_sync_state
  integration_id   uuid NOT NULL FK -> dialer_integrations(id) ON DELETE CASCADE
  dataset          text NOT NULL (sales, calls, sessions, users, campaigns)
  last_success_at  timestamptz
  cursor           text
  last_error_at    timestamptz
  last_error       text
  updated_at       timestamptz NOT NULL DEFAULT now()

  PK (integration_id, dataset)
```

RLS: Enabled, SELECT for managers, service-role INSERT/UPDATE.

### Migration 3: `integration_id` paa `dialer_calls`

- `ALTER TABLE dialer_calls ADD COLUMN integration_id uuid REFERENCES dialer_integrations(id)` (nullable)
- Backfill via: `UPDATE dialer_calls dc SET integration_id = di.id FROM dialer_integrations di WHERE dc.dialer_name = di.name`
- Nyt index: `(integration_id, start_time DESC)`
- Bevarer eksisterende UNIQUE constraint `(external_id, integration_type, dialer_name)` - INGEN breaking change
- `core/calls.ts` onConflict forbliver `"external_id,integration_type,dialer_name"` - uaendret

### Migration 4: Aggregeret view `dialer_session_daily_metrics`

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

Hitrate: `success_sessions / NULLIF(total_sessions, 0)`

---

## B) INTEGRATION ENGINE AENDRINGER

### B1: `types.ts` - Tilfoej `StandardSession`

Ny interface tilfojet i bunden af filen:

```text
StandardSession
  externalId           string
  integrationType      'adversus' | 'enreach' | 'other'
  dialerName           string
  leadExternalId       string
  agentExternalId      string
  campaignExternalId   string
  status               string (success, notInterested, unqualified, invalid, automaticRedial, privateRedial, noAnswer, busy, unknown)
  startTime            string (ISO-8601)
  endTime              string (ISO-8601)
  sessionSeconds       number
  hasCdr               boolean
  cdrDurationSeconds   number
  cdrDisposition       string
  metadata             Record<string, unknown>
```

### B2: `adapters/interface.ts` - Tilfoej optional metoder

Tilfoej til `DialerAdapter` interface (linje 3-14):
- `fetchSessions?(days: number): Promise<StandardSession[]>`
- `fetchSessionsRange?(range: DateRange): Promise<StandardSession[]>`

Optional metoder = non-breaking for eksisterende adapters.

### B3: `adapters/adversus.ts` - 2 aendringer

**NY: `fetchSessions(days)` + `fetchSessionsRange(range)`**

Implementerer kald til Adversus `/sessions` endpoint (bekraeftet fra den aeldre `sync-adversus` funktion):
- API format: `/sessions?filters={startTime:{$gt:ISO}}&page=N&pageSize=1000&sortProperty=startTime&sortDirection=DESC`
- Henter ALLE session statuses: `success`, `notInterested`, `unqualified`, `invalid`, `automaticRedial`, `privateRedial`
- Mapper session-objekter til `StandardSession`:
  - `session.id` -> `externalId`
  - `session.leadId` -> `leadExternalId`
  - `session.userId` -> `agentExternalId`
  - `session.campaignId` -> `campaignExternalId`
  - `session.status` -> `status` (bruges direkte - Adversus returnerer semantiske statuses)
  - `session.sessionSeconds` -> `sessionSeconds`
  - `session.cdr` -> CDR-felter (durationSeconds, disposition) hvis tilgaengeligt
- Paginering med `pageSize=1000`, stopper naar `sessions.length < pageSize`
- Rate limit retry via eksisterende `get()` metode

**FIX: `buildLeadDataMap` (linje 422-609)**

Nuvaerende problem: Bulk-fetch af leads per kampagne med `pageSize=5000` mister nyere leads i store kampagner (fx Relatel 105958). Fallback begranset til `MAX_FALLBACK_LEADS = 20`.

Ny logik:
1. Fjern bulk kampagne-fetch loop (linje 449-536)
2. Udtraek unikke `leadId`s direkte fra `sales` arrayet
3. Batch-fetch ALLE manglende leads via eksisterende `fetchLeadById` metode (linje 616-661)
4. Grupper i batches af 5 med 200ms delay mellem batches
5. Fjern `MAX_FALLBACK_LEADS = 20` begransning (linje 542)

Output-format 100% identisk: `Map<leadId, { opp, resultData, resultFields }>`
- OPP-pattern matching (`/OPP-\d{4,6}/`) bevares uaendret
- `resultFields` parsing bevares uaendret
- Baade `fetchSales` og `fetchSalesRange` kalder `buildLeadDataMap` - begge opdateres konsistent

### B4: `adapters/enreach.ts` - Ny `fetchSessions`

**NY: `fetchSessions(days)` + `fetchSessionsRange(range)`**

Genbruger EKSISTERENDE `/simpleleads?AllClosedStatuses=true` endpoint:
- Dataen hentes ALLEREDE men filtreres vaek (linje 368-376: `closure.toLowerCase() === "success"`)
- Ny sessions-metode mapper ALLE closures til `StandardSession` i stedet for at filtrere
- Status-mapping: `Success` -> `success`, andre closures -> lowercase direkte (fx `NoSale` -> `nosale`)
- Logger unikke closure-typer per koersel for diagnostik
- Agent fra `firstProcessedByUser.orgCode` eller `lastModifiedByUser.orgCode`
- Campaign fra `campaign.uniqueId`
- Genbruger `processPageByPage` med en generisk version der returnerer `StandardSession[]`
- **INGEN ekstra API-kald** - same data som `fetchSales` allerede henter

### B5: Nye utility-filer

**`utils/rate-limiter.ts`** (ny fil):

Central rate limiter per integration med sliding window:
- `maxPerMinute: 55` (buffer under Adversus 60/min limit)
- `maxPerHour: 900` (buffer under Adversus 1000/hour limit)
- `waitForSlot()`: async metode der venter med sleep hvis over limit
- 429-haandtering: Laes `Retry-After` header, exponential backoff, random jitter (0-500ms)

**`utils/sync-state.ts`** (ny fil):

CRUD helpers for `dialer_sync_state`:
- `getSyncState(supabase, integrationId, dataset)` -> laes fra tabel, return `{ last_success_at, cursor }` eller null
- `upsertSyncState(supabase, integrationId, dataset, lastSuccessAt, cursor?)` -> upsert med onConflict
- `recordSyncError(supabase, integrationId, dataset, errorMsg)` -> opdater `last_error_at` + `last_error`

### B6: `core/sessions.ts` (ny fil)

`processSessions(supabase, sessions, integrationId, batchSize, log)`:

- Agent-matching via `agents` tabel (same pattern som `core/calls.ts` linje 96-131):
  - Fetch alle agents med `id, external_adversus_id, external_dialer_id, email`
  - Byg 3 lookup maps: `agentMapByExtId`, `agentMapByDialerId`, `agentMapByEmail`
  - Match session `agentExternalId` mod alle 3 maps
- Transform `StandardSession[]` til database rows med felter:
  - `integration_id`, `external_id`, `lead_external_id`, `agent_external_id`, `campaign_external_id`
  - `status`, `start_time`, `end_time`, `session_seconds`
  - `has_cdr`, `cdr_duration_seconds`, `cdr_disposition`
  - `source`, `metadata`, `updated_at`
- Batch-upsert til `dialer_sessions` med `onConflict: "integration_id,external_id"`, `ignoreDuplicates: false`
- Return `{ processed, errors, matched, duplicates }`

### B7: `core/index.ts` - Re-eksporter

Tilfoej: `export { processSessions } from "./sessions.ts";`

### B8: `core.ts` - Tilfoej metode

Tilfoej `processSessions(sessions, integrationId, batchSize)` metode paa `IngestionEngine` klassen der delegerer til `core/sessions.ts`.

### B9: `actions/sync-integration.ts` - Sessions action

**Kritisk backward compatibility** - aendr linje 61:

```text
// FRA (nuvaerende):
const actionList = actions || (action === "sync" ? ["campaigns", "users", "sales"] : [action]);

// TIL:
const actionList = actions || (action === "sync" ? ["campaigns", "users", "sales", "sessions"] : [action]);
```

Dette sikrer at EKSISTERENDE cron jobs med `action: "sync"` automatisk inkluderer sessions.

**Ny sessions-action blok** (efter calls-blokken, linje 159):

```text
if (actionList.includes("sessions")) {
  // 1. Laes sync state for incremental vindue
  const syncState = await getSyncState(supabase, integration.id, "sessions");
  
  // 2. Beregn window
  //    start = last_success_at - 5min overlap (fang sent registrerede)
  //    stop = now - 2min (undgaa in-flight records)
  //    Fallback for ny integration: days parameter
  const windowStart = syncState?.last_success_at
    ? new Date(new Date(syncState.last_success_at).getTime() - 5*60*1000)
    : new Date(Date.now() - days*24*60*60*1000);
  const windowEnd = new Date(Date.now() - 2*60*1000);
  
  // 3. Fetch via adapter
  let sessions = [];
  if (adapter.fetchSessionsRange) {
    sessions = await adapter.fetchSessionsRange({
      from: windowStart.toISOString(),
      to: windowEnd.toISOString()
    });
  } else if (adapter.fetchSessions) {
    sessions = await adapter.fetchSessions(days);
  }
  
  // 4. Process og upsert
  if (sessions.length > 0) {
    runResults["sessions"] = await engine.processSessions(sessions, integration.id);
  }
  
  // 5. Opdater sync state
  await upsertSyncState(supabase, integration.id, "sessions", windowEnd);
}
```

Sync state opdateres ogsaa i error-handling.

### B10: `utils/index.ts` - Re-eksporter

Tilfoej eksport af `RateLimiter`, `getSyncState`, `upsertSyncState`, `recordSyncError`.

---

## C) CRON INTEGRATION

### `update-cron-schedule/index.ts` (linje 50-55)

Aendr dialer payload:

```text
// FRA (nuvaerende):
payload = { source: provider || "adversus", integration_id, action: "sync", days: 1 };

// TIL:
payload = { source: provider || "adversus", integration_id, actions: ["campaigns", "users", "sales", "sessions"], days: 1 };
```

Backward compatibility: Eksisterende cron jobs bruger stadig `action: "sync"` indtil de genplanlaces. Fallback i B9 sikrer at `"sync"` ogsaa inkluderer sessions.

---

## D) FILER DER EKSPLICIT IKKE ROERES

| Fil | Grund |
|-----|-------|
| `core/sales.ts` | Straksbetalings-preservation (linje 459-525), pricing rules, email filter, normalize-flow - ALT uaendret |
| `core/calls.ts` | CDR processing, UNIQUE constraint `(external_id, integration_type, dialer_name)`, agent matching - uaendret |
| `core/normalize.ts` | Data normalisering via field mappings - uaendret |
| `core/campaigns.ts` | Campaign processing - uaendret |
| `core/users.ts` | User processing - uaendret |
| `core/mappings.ts` | Campaign mapping lookup - uaendret |
| `index.ts` (entry point) | Action routing allerede fleksibelt nok |
| `adapters/registry.ts` | Adapter instantiering - uaendret |
| Alle FM edge functions | FM-data har `source='fieldmarketing'`, aldrig i dialer_sessions |
| `calculate-leaderboard-*` | Bruger `sales` + `sale_items`, ikke sessions |
| `tv-dashboard-data` | Bruger `sales` tabel, ikke sessions |
| `dialer-webhook/*` | Webhook processing uaendret |

---

## E) KOMPLET FILLISTE

| # | Fil | Type | Risiko |
|---|-----|------|--------|
| 1 | DB Migration 1: `dialer_sessions` | Ny tabel + indekser + RLS + trigger | Lav |
| 2 | DB Migration 2: `dialer_sync_state` | Ny tabel + RLS | Lav |
| 3 | DB Migration 3: `dialer_calls` + `integration_id` | Additivt (nullable kolonne + backfill + index) | Medium |
| 4 | DB Migration 4: `dialer_session_daily_metrics` view | Nyt view | Lav |
| 5 | `integration-engine/types.ts` | Tilfoej `StandardSession` interface | Lav |
| 6 | `integration-engine/adapters/interface.ts` | Tilfoej 2 optional metoder | Lav |
| 7 | `integration-engine/adapters/adversus.ts` | `fetchSessions` + `fetchSessionsRange` + `buildLeadDataMap` refactor | Hoej |
| 8 | `integration-engine/adapters/enreach.ts` | `fetchSessions` + `fetchSessionsRange` | Medium |
| 9 | `integration-engine/core/sessions.ts` | Ny fil: `processSessions()` | Lav |
| 10 | `integration-engine/core/index.ts` | Tilfoej re-eksport | Lav |
| 11 | `integration-engine/core.ts` | Tilfoej `processSessions` metode | Lav |
| 12 | `integration-engine/actions/sync-integration.ts` | Sessions action + backward compat fallback | Medium |
| 13 | `integration-engine/utils/rate-limiter.ts` | Ny fil: central rate limiter | Lav |
| 14 | `integration-engine/utils/sync-state.ts` | Ny fil: sync state CRUD | Lav |
| 15 | `integration-engine/utils/index.ts` | Tilfoej re-eksporter | Lav |
| 16 | `update-cron-schedule/index.ts` | Payload aendring | Lav |

---

## F) NON-REGRESSION GATES

Foer deploy verificeres:

1. **Backfill match quality**: `SELECT dialer_name, COUNT(*), COUNT(integration_id) FROM dialer_calls GROUP BY 1` - alle integrationer skal matche
2. **Sales sync integritet**: Koer `actions: ["sales"]` og verificer:
   - Pricing rules matcher korrekt (Daekningssum-berigelse for ASE)
   - `is_immediate_payment` preservation virker
   - OPP extraction + leadResultFields bevares
3. **FM dashboards**: `SELECT COUNT(*) FROM sales WHERE source = 'fieldmarketing'` - uaendret
4. **Calls sync**: Deduplicering via `(external_id, integration_type, dialer_name)` - uaendret
5. **Cron backward compat**: `action: "sync"` payload giver sessions + sales + campaigns + users

## G) TESTPLAN

1. Deploy alle edge functions
2. **Adversus sessions**: `POST integration-engine { integration_id: "<adversus-id>", actions: ["sessions"], days: 1 }`
   - Verificer records i `dialer_sessions` med alle status-typer (success, notInterested, etc.)
   - Verificer `dialer_sync_state` har korrekt `last_success_at` for dataset="sessions"
3. **Idempotens**: Koer samme sync igen -> ingen duplikater (UNIQUE constraint)
4. **Enreach sessions**: `POST integration-engine { integration_id: "<enreach-id>", actions: ["sessions"], days: 1 }`
   - Verificer alle closure-typer logget og gemt
5. **buildLeadDataMap**: Koer `actions: ["sales"]` for Relatel/Adversus, verificer `leadResultData` ikke-tom for store kampagner
6. **View test**: `SELECT * FROM dialer_session_daily_metrics WHERE date = CURRENT_DATE LIMIT 10`
7. **Fuld sync**: `POST integration-engine { action: "sync", integration_id: "<id>", days: 1 }` -> backward compatible med sessions inkluderet
8. **Rate limit monitoring**: Check logs for 429-fejl under kombineret sessions+sales sync

## H) KENDTE RISICI + ROLLBACK

| Risiko | Mitigering | Rollback |
|--------|------------|----------|
| `buildLeadDataMap` refactor bryder OPP-extraction | Output-format er identisk, `fetchLeadById` er allerede testet (linje 616-661) | Revert adversus.ts til foer-version |
| `integration_id` backfill matcher forkert | Match via `dialer_name` (unik per integration), verify med COUNT query | Kolonne er nullable, kan ignoreres |
| Rate limits overskredes med sessions+sales | Central limiter (55/min, 900/hr), sessions koerer EFTER sales | Fjern "sessions" fra actionList fallback |
| Enreach closure-vaerdier er ukendte | Alle vaerdier gemmes som-er (TEXT felt), diagnostic logging | Intet datatab - bare ukendte status-vaerdier |
| Cron payload-aendring bryder eksisterende jobs | `action: "sync"` fallback inkluderer sessions automatisk | Revert cron payload |

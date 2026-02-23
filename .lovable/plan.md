

# Endelig Implementeringsplan: Provider-Sync + Auto-Healing

Review-dokumentet er valideret mod live driftsdata. Alle anbefalinger holder.

## Validerede driftstal (sidste 48 timer)

| Provider | Runs | Avg runtime | p95 runtime | API calls/hr | 429-fejl | Budget brugt |
|---|---|---|---|---|---|---|
| Adversus | 854 | 50.4s | 141s | 428 | 206 | 43% af 1000/hr |
| Enreach | 1440 | 22.1s | 45.4s | 314 | 2364 | 3% af 10000/hr |

**Sekventiel p95 (estimeret):**
- Adversus: 141s + 52s = 193s (passer i 5-min vindue med 35% buffer)
- Enreach: 45.5s + 45.5s + 0.4s = 91s (passer i 3-min vindue -- men 429s forsvinder med sekventiel koersel, realistisk ~60s)

## Intervaller (datadrevne)

- **Adversus provider-sync: 5 minutter** (fasthold)
- **Enreach provider-sync: 3 minutter** (kontrolleret pilot, revert til 5 min hvis ustabil)
- **Enrichment-healer: 15 minutter** (offset 3 min)

## Go/No-Go for Enreach 3-min (efter 7 dage)

1. p95 runtime < 45s
2. Timelig budgetforbrug < 25%
3. 429-rate i 22:00-02:00 uaendret eller faldende
4. Lock-skip-rate < 1%

Alle 4 skal holde i 7 sammenhaengende dage. Ellers revert til 5 min.

## Implementeringsraekkefoelge

### Trin 1: Database migration

```sql
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enrichment_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrichment_last_attempt timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_error text;

CREATE INDEX IF NOT EXISTS idx_sales_enrichment_pending
  ON public.sales (enrichment_status, enrichment_attempts, sale_datetime DESC)
  WHERE enrichment_status IN ('pending', 'failed');

CREATE TABLE IF NOT EXISTS public.provider_sync_locks (
  provider text PRIMARY KEY,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);
ALTER TABLE public.provider_sync_locks ENABLE ROW LEVEL SECURITY;
```

### Trin 2: Backfill eksisterende data (via insert tool, idempotent)

```sql
-- Adversus: tjek leadResultFields
UPDATE public.sales SET enrichment_status = CASE
  WHEN raw_payload->'leadResultFields' IS NOT NULL
    AND jsonb_typeof(raw_payload->'leadResultFields') = 'object'
    AND raw_payload->'leadResultFields' != '{}'::jsonb
  THEN 'complete' ELSE 'pending'
END WHERE integration_type = 'adversus';

-- Enreach: tjek raw_payload->'data' + webhook-detection
UPDATE public.sales SET enrichment_status = CASE
  WHEN adversus_external_id LIKE 'enreach-%' THEN 'pending'
  WHEN raw_payload->'data' IS NOT NULL
    AND jsonb_typeof(raw_payload->'data') = 'object'
    AND raw_payload->'data' != '{}'::jsonb
  THEN 'complete' ELSE 'pending'
END WHERE integration_type = 'enreach';

-- Alt andet (FM, manual): altid complete
UPDATE public.sales SET enrichment_status = 'complete'
WHERE integration_type NOT IN ('adversus', 'enreach') OR integration_type IS NULL;
```

### Trin 3: `integration-engine/index.ts` -- Provider-sync action

Tilfoej dedikeret `if (action === "provider-sync")` branch FOER den generiske sync-logik:

1. Modtag `{ action: "provider-sync", source: "adversus"|"enreach", background: true }`
2. Acquire lock i `provider_sync_locks` (INSERT ... ON CONFLICT DO NOTHING, check expires_at)
3. Hent ALLE aktive integrationer for den provider fra `dialer_integrations`
4. Beregn samlet API-forbrug fra `integration_sync_runs` (SUM api_calls_made WHERE sidste 60 min)
5. Sorter integrationer efter aeldste `last_sync_at`
6. For hver integration: kald eksisterende `syncIntegration()` med korrekte actions:
   - Adversus: `["campaigns", "users", "sales", "calls"]`, maxRecords=150, days=2
   - Enreach: `["campaigns", "users", "sales", "sessions"]`, maxRecords=200, days=1-3
7. Mellem hver integration: tjek budget. Stop ved 70% (Adversus) / 80% (Enreach) kapacitet
8. Release lock
9. Return aggregeret resultat

Eksisterende per-integration sync bevares for manuelle koersler og backfills.

### Trin 4: `core/sales.ts` -- Track enrichment ved upsert

I `processSalesBatch`, efter saleData-konstruktion:

- Adversus: `enrichment_status = 'complete'` hvis `leadResultFields` har indhold, ellers `'pending'`
- Enreach: `enrichment_status = 'complete'` hvis `raw_payload.data` har indhold og IKKE webhook (`enreach-*`), ellers `'pending'`
- Andre typer: altid `'complete'`
- Nulstil `enrichment_attempts = 0`, `enrichment_error = null`

### Trin 5: Ny edge function `enrichment-healer/index.ts`

To provider-specifikke healing-strategier:

**Faelles flow:**
1. Hent max 20 salg med `enrichment_status IN ('pending','failed')` og `enrichment_attempts < 5`
2. Grupper efter `integration_type`
3. Tjek API-budget separat per provider (maks 15% af time-kapacitet)
4. Koer provider-specifik healing
5. Post-heal: genkoer normalisering (`applyDataMappings`) + prisregel-matching paa sale_items
6. Log til `integration_logs` og `integration_sync_runs`

**Adversus-strategi:**
- Udtrak `leadId` fra `raw_payload.leadId` eller `raw_payload.metadata.leadId`
- Kald Adversus API: `GET /v1/leads/{leadId}`
- Opdater `raw_payload.leadResultFields` og `raw_payload.leadResultData`
- Saat `enrichment_status = 'healed'`

**Enreach-strategi:**
- Webhook-salg (`enreach-*` ID): marker som `skipped`, `enrichment_error = 'no_lead_identifier'`
- API-salg: hent via `GET /simpleleads?UniqueId={id}`
- Opdater `raw_payload.data`
- Saat `enrichment_status = 'healed'`

**Fejlhaandtering:**
- API-fejl: `enrichment_attempts++`, `enrichment_status = 'failed'`, `enrichment_error = fejlbesked`
- Budget opbrugt: stop, log "budget exhausted"
- Manglende lead ID: `enrichment_status = 'skipped'`, `enrichment_error = 'no_lead_identifier'`
- Max 5 forsog per salg

### Trin 6: Config

Tilfoej til `supabase/config.toml`:
```toml
[functions.enrichment-healer]
verify_jwt = false
```

### Trin 7: Cron jobs (via insert tool)

Opret 3 nye jobs:
- `provider-adversus-sync`: `*/5 * * * *` -- payload: `{ "action": "provider-sync", "source": "adversus", "background": true }`
- `provider-enreach-sync`: `*/3 * * * *` -- payload: `{ "action": "provider-sync", "source": "enreach", "background": true }`
- `enrichment-healer`: `3,18,33,48 * * * *` -- payload: `{ "maxBatch": 20 }`

Reducere 4 gamle jobs til `*/30 * * * *` i 48-timers overgangsperiode. Derefter slet.

### Trin 8: UI-opdateringer

**`update-cron-schedule/index.ts`:**
- Tilfoej `mode: "provider"` parameter der opretter provider-level jobs
- Bevar bagudkompatibilitet med eksisterende `mode: "integration"` (default)

**`LiveCronStatus.tsx`:**
- Genkend `provider-adversus-sync`, `provider-enreach-sync`, `enrichment-healer` som kendte jobs
- Vis provider-gruppering i stedet for "Ukendt" status

**`ScheduleEditor.tsx`:**
- Provider-baseret visning (Adversus-gruppen, Enreach-gruppen)
- Vis samlet budget-forbrug per provider
- Frekvensvalg paer provider (ikke per integration)

**`DataHealthChecks.tsx`:**
- "Adversus manglende enrichment": count WHERE enrichment_status NOT IN ('complete','healed') AND integration_type = 'adversus'
- "Enreach manglende enrichment": samme for enreach
- "Healer success rate": healed / (healed + failed + skipped) * 100 per provider

## Filoversigt

| Fil | Type | Aendring |
|---|---|---|
| Migration SQL | Ny | enrichment-kolonner + index + provider_sync_locks |
| Backfill SQL (insert tool) | Ny | Klassificer eksisterende salg |
| `integration-engine/index.ts` | Aendring | Ny `provider-sync` action med lock + budget + sekventiel koersel |
| `enrichment-healer/index.ts` | Ny | Auto-healing med Adversus + Enreach strategier |
| `core/sales.ts` | Aendring | Set enrichment_status ved upsert |
| `supabase/config.toml` | Aendring | Tilfoej enrichment-healer |
| `update-cron-schedule/index.ts` | Aendring | Provider-mode support |
| `LiveCronStatus.tsx` | Aendring | Genkend nye job-navne |
| `ScheduleEditor.tsx` | Aendring | Provider-gruppering |
| `DataHealthChecks.tsx` | Aendring | Enrichment health metriker |
| Cron SQL (insert tool) | Ny | 3 nye jobs + reducere 4 gamle |

## Risikominimering

- **Sync locking**: 10 min auto-expire forhindrer overlap og permanente locks
- **Budget-gate**: Provider-sync stopper ved 70%, healer ved 15%
- **Max 5 forsog** per salg i healeren forhindrer uendelige loops
- **48-timers parallel overgang**: Gamle jobs koerer med lav frekvens som safety net
- **Enreach 3-min pilot**: Revert til 5 min hvis go/no-go kriterier ikke opfyldes efter 7 dage
- **Bagudkompatibilitet**: Per-integration sync bevares for manuelle koersler
- **Idempotent backfill**: Kan genkores uden sideeffekter


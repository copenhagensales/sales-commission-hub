

# Lovablecph: Smart Sync med automatisk backfill (stopper ved 15. januar)

## Oversigt

To cron-jobs der begge bruger samme integration-engine, men med forskellig opgave:

1. **Standard-sync (hvert 5. minut)**: Henter nye salg med `days:1, maxRecords:30` -- ultralet (~3-5 API-kald)
2. **Smart backfill (hver time)**: Arbejder sig dag-for-dag fra 15. januar 2026 frem til i dag. Tjekker API-budget foerst, reserverer kapacitet til standard-sync, og **stopper automatisk naar den naar dags dato**.

## Backfill-logik i detaljer

Backfill-jobbet goer foelgende ved hver koersel:

1. Laeser `dialer_sync_state` (dataset: `"backfill"`) for at finde senest behandlede dato via `cursor`-feltet
2. Hvis ingen cursor: starter fra `2026-01-15`
3. Hvis cursor >= i dag: **stopper** -- al data er hentet, jobbet goer ingenting
4. Laeser `integration_sync_runs` for seneste 10 minutter for at se hvor mange API-kald der er brugt
5. Beregner sikkert antal dage at hente: `(60 - brugt_pr_min - 15_reserveret) / ~8_kald_pr_dag`
6. Henter sales + calls for naeste N dage via `fetchSalesRange` og `fetchCallsRange` (fra/til)
7. Opdaterer cursor til senest behandlede dato
8. Logger resultater til `integration_sync_runs`

Naar cursor naar dags dato, returnerer backfill blot `{ processed: 0, message: "Backfill complete" }` og goer ingenting -- sikkert at lade jobbet koere videre uden spild.

## Teknisk implementering

### Ny fil: `supabase/functions/integration-engine/actions/smart-backfill.ts`

Indeholder en eksporteret funktion `smartBackfill(supabase, integrationId, log)` der:
- Laeser cursor fra `dialer_sync_state` (dataset `"backfill"`, default startdato `2026-01-15`)
- Returnerer tidligt hvis cursor >= i dag (backfill faerdig)
- Beregner API-budget fra `integration_sync_runs` (seneste 10 min)
- Reserverer 15 kald til standard-sync
- Kalder `syncIntegration()` med `from`/`to` for hver dag inden for budgettet
- Opdaterer cursor efter hver succesfuld dag

### AEndring: `supabase/functions/integration-engine/index.ts`

Tilfoej routing for `action === "backfill"`:
- Importerer `smartBackfill` fra actions
- Koerer i baggrunden via `EdgeRuntime.waitUntil()`
- Returnerer straks med status

### Database-aendringer (SQL, ingen migrering)

```text
-- 1. Slet det tunge Job 87
SELECT cron.unschedule(87);

-- 2. Opret standard-sync (hvert 5. min, offset minut 3)
SELECT cron.schedule(
  'dialer-26fac751-sync',
  '3,8,13,18,23,28,33,38,43,48,53,58 * * * *',
  -- payload: actions:["sales"], days:1, maxRecords:30
);

-- 3. Opret smart backfill (hver time, minut 35)
SELECT cron.schedule(
  'dialer-26fac751-backfill',
  '35 * * * *',
  -- payload: action:"backfill", background:true
);

-- 4. Opdater integration config
UPDATE dialer_integrations SET config = config || '{
  "sync_actions": ["sales"],
  "backfill_start_date": "2026-01-15",
  "excluded_actions": ["sessions"]
}'::jsonb
WHERE id = '26fac751-c2d8-4b5b-a6df-e33a32e3c6e7';
```

## Stopmekanisme

Backfill tracker sin fremgang i `dialer_sync_state`:
- `dataset`: `"backfill"`
- `cursor`: den senest behandlede dato som ISO-streng (fx `"2026-01-22"`)
- Naar cursor >= dags dato -> return tidligt, ingen API-kald

Naar backfill er faerdig, kan jobbet enten:
- Forblive aktivt (koerer hver time, finder 0 nye poster, bruger 0 API-kald)
- Fjernes manuelt via `SELECT cron.unschedule('dialer-26fac751-backfill');`

## Filer der aendres/oprettes

| Fil | Type | Beskrivelse |
|-----|------|-------------|
| `actions/smart-backfill.ts` | Ny | Backfill-logik med budgetberegning og cursor-tracking |
| `index.ts` | AEndring | Tilfoej `action === "backfill"` routing |
| Database (SQL) | AEndring | Slet Job 87, opret 2 nye jobs, opdater config |

## Tidslinje

```text
Nu -> Slet Job 87 (stopper belastning)
+3 min:  Standard-sync starter (kun sales, days:1)
+35 min: Foerste backfill koerer
         Tjekker budget -> henter fx 5 dage (15-19 jan)
+95 min: Anden backfill -> henter 20-24 jan
...
+8-12 timer: Cursor naar dags dato -> backfill stopper automatisk
Derefter: Standard-sync koerer normalt, backfill er passivt
```

## Risiko

- **Lav**: Standard-sync med `days:1` og `maxRecords:30` er ~3-5 API-kald
- **Rate limit**: Backfill reserverer altid 15 kald til standard-sync -- kan aldrig blokere den
- **Idempotent**: Upsert-logik forhindrer duplikater
- **Auto-stop**: Cursor-check sikrer at backfill stopper naar den naar i dag
- **Startforsinkelse**: Minut 3 og 35 giver rate limit tid til at nulstille


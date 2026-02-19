

# Fix: Lovablecph cron-job -- ret UUID, payload og tilfoej calls

## Baggrund og kendte udfordringer

Vi har haft flere problemer med Lovablecph-synkroniseringen:

1. **Forkert UUID**: Job 86 bruger `26fac751-f4b2-...` som ikke matcher den faktiske integration (`26fac751-c2d8-...`)
2. **Forkert payload-noegle**: `integrationId` i stedet for `integration_id` (med underscore)
3. **Sessions-crash**: Adversus returnerer HTTP 403 for sessions-endpointet for denne integration
4. **Calls stoppet**: Sidste kald synkroniseret 5. januar 2026 (7.397 historiske kald)

**Nuvaerende tilstand (bekraeftet lige nu):**
- Job 86 koerer hvert 5. minut, men pga. forkert UUID rammer den ALDRIG Lovablecph
- Integration-engine falder tilbage til en generisk provider-soegning og synkroniserer kun campaigns + users (80 poster pr. koersel)
- **0 salg** og **0 kald** synkroniseres for Lovablecph
- Sidste kald i databasen: 5. januar 2026

## Plan

### Trin 1: Slet Job 86

Fjern det fejlbeheftede cron-job.

```text
SELECT cron.unschedule(86);
```

### Trin 2: Opret nyt korrekt cron-job

Nyt job med alle rettelser:
- Korrekt UUID: `26fac751-c2d8-4b5b-a6df-e33a32e3c6e7`
- Korrekt noegle: `integration_id` (underscore)
- Actions: `["campaigns", "users", "sales", "calls"]`
- Sessions bevidst udeladt (Adversus returnerer 403)
- `days: 21` for at indhente manglende data fra de seneste uger
- Schedule: hvert 5. minut, staggered paa minut 1,6,11... (undgaar overlap med Relatel paa 0,10,20...)

```text
SELECT cron.schedule(
  'dialer-26fac751-sync',
  '1,6,11,16,21,26,31,36,41,46,51,56 * * * *',
  $$
  SELECT net.http_post(
    url := '<edge-function-url>/integration-engine',
    headers := '<auth-headers>'::jsonb,
    body := '{"source":"adversus","actions":["campaigns","users","sales","calls"],"days":21,"integration_id":"26fac751-c2d8-4b5b-a6df-e33a32e3c6e7"}'::jsonb
  ) AS request_id;
  $$
);
```

### Trin 3: Verifikation

1. Koer integration-engine manuelt med korrekt payload for at bekraefte at salg og kald hentes
2. Tjek `integration_sync_runs` -- actions skal nu vise `["campaigns","users","sales","calls"]` i stedet for kun `["campaigns","users"]`
3. Tjek `dialer_calls` for nye poster efter 5. januar
4. Tjek `sales` for nye Lovablecph-poster

## Ingen kodeaendringer

Koden i `sync-integration.ts` haandterer allerede alt korrekt:
- `LOVABLE_ACTIONS` inkluderer "calls"
- Sessions filtreres automatisk fra for Lovablecph via `excluded_actions`
- Calls-adapteren har fungeret historisk (7.397 kald bevist)

Kun cron-jobbet i databasen skal rettes.

## Risiko

- **Lav**: Calls-endpointet virkede frem til januar -- det stoppede kun fordi cron-jobbet gik i stykker
- **Beskyttelse**: Sessions-403-crashet kan ikke ske, da koden automatisk filtrerer sessions fra
- **Backfill**: `days: 21` sikrer at vi faar manglende data med. Kan saettes hoejere ved foerste koersel for at indhente mere historik


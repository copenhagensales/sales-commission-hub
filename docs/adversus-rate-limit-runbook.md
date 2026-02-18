# Runbook: Adversus rate-limit stabilisering + ASE sync-vindue

## Formål
Denne runbook beskriver driftstrin for at reducere 429-fejl på Adversus og sikre at ASE-sync kan hente data udenfor 24 timers-vinduet.

## Implementerede ændringer
1. `integration-engine` bruger nu:
   - `Retry-After` header hvis tilgængelig.
   - eksponentiel backoff fallback (5s base, 3 retries).
   - jitter (±20%) for at undgå samtidige retry-kollisioner.
2. `update-cron-schedule` beregner `days` per integration:
   - default: `1`
   - ASE: `3`
   - evt. override via `dialer_integrations.config.sync_days`
3. Migration opdaterer cron-forskydning og persisterer `config.sync_schedule` for de navngivne integrationer samt `sync_days = 3` for ASE.

## Deploy-sekvens
1. Deploy edge functions:
   - `supabase/functions/integration-engine`
   - `supabase/functions/update-cron-schedule`
2. Kør migration:
   - `supabase/migrations/20260218101500_9d4d9d2f-ops-cron-stagger-and-ase-sync-window.sql`
3. Verificér at cron schedules er opdateret i `cron.job` og at `dialer_integrations.config.sync_schedule` er sat for de berørte integrationer.

## Manuel backfill (efter deploy)
Kør manuel sync for kritiske integrationer (især Lovablecph, Relatel_CPHSALES, ASE):

```sql
select net.http_post(
  url := 'https://<project-ref>.supabase.co/functions/v1/integration-engine',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || '<SUPABASE_ANON_KEY>'
  ),
  body := jsonb_build_object(
    'source', 'adversus',
    'integration_id', '<integration-uuid>',
    'actions', jsonb_build_array('campaigns','users','sales','sessions'),
    'days', 3
  )
);
```

> For ikke-ASE integrationer kan `days` sættes til 1.

## Verifikation (24-48 timer)
Overvåg følgende pr. integration:
- 429-rate i edge function logs (`integration-engine` / Adversus calls)
- antal importerede sales per sync-run
- runtime per sync-run og antal retries

Anbefalet SQL/observability checks:
- tæl fejl med `status_code = 429` i relevante log-tabeller (hvis tilgængelig)
- sammenlign antal nye sales før/efter deploy
- verificér at cron jobs ikke starter i samme minut for delte credentials

## Rollback
1. Revert commit og deploy tidligere funktionsversion.
2. Sæt cron schedules tilbage i `cron.job` for berørte jobnavne.
3. Fjern `config.sync_schedule` for berørte integrationer og `config.sync_days` override hvis nødvendigt:

```sql
update public.dialer_integrations
set config = (coalesce(config, '{}'::jsonb) - 'sync_schedule') - 'sync_days',
    updated_at = now()
where lower(name) in ('lovablecph', 'relatel_cphsales', 'eesy', 'tryg', 'ase');
```

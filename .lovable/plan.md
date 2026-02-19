

# Implementer manglende dele fra Adversus rate-limit runbook

## Status

Stoerstedelen af runbook'en er allerede implementeret:
- Rate-limiting med Retry-After, exponential backoff og jitter er i adapterne
- update-cron-schedule har al logik for staggering, days-beregning og split-jobs
- Cron schedules er allerede staggerede korrekt i databasen
- Lovablecph har split jobs (sync + meta)

## Manglende del

ASE-integrationen mangler `sync_days: 3` i sin config. Selvom `update-cron-schedule` koden beregner `days=3` for ASE via navn-matching, er vaerdien ikke persisteret i `config`-kolonnen. Dette boer goeres for at sikre at vaerdien er eksplicit og ikke kun afhaengig af navne-konventionen.

## Tekniske detaljer

### 1. SQL data-opdatering (via insert tool, IKKE migration)

Opdater ASE-integrationens config til at inkludere `sync_days: 3`:

```sql
UPDATE public.dialer_integrations
SET config = jsonb_set(
  COALESCE(config, '{}'::jsonb),
  '{sync_days}',
  '3'::jsonb
),
updated_at = now()
WHERE lower(name) = 'ase';
```

### 2. Verificer cron job payloads

Trig en genberegning af ASE's cron job saa payload'en faar `days: 3` ved at kalde update-cron-schedule edge function med ASE's aktuelle indstillinger. Dette sikrer at det koerenede cron job bruger den korrekte vaerdi.

Ingen kodeaendringer er noedvendige -- al logik er allerede paa plads i edge functions.

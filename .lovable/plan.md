

# Koer Adversus Schedule Spacing Plan

## Hvad der skal goeres

Migrationen `20260218113000_adjust_adversus_schedule_spacing.sql` er klar og indeholder alt det noedvendige:

1. **Forskyd cron-jobs** med 5 minutters mellemrum:
   - Lovablecph: `1,11,21,31,41,51 * * * *` (koerer minut :01, :11, :21...)
   - Relatel_CPHSALES: `6,16,26,36,46,56 * * * *` (koerer minut :06, :16, :26...)

2. **Opdater `dialer_integrations.config.sync_schedule`** saa fremtidige cron-genskabelser bruger de nye schedules.

## Retry-delays

Retry-delays er **allerede rettet** til 5000ms base delay (linje 601 og 778 i `adversus.ts`). Ingen yderligere kodeaendringer er noedvendige.

## Teknisk sekvens

1. Koer migrationen (opdaterer `cron.job` og `dialer_integrations.config`)
2. Deploy `integration-engine` edge function (allerede opdateret med 5s retry)
3. Koer manuel backfill for Lovablecph med `days: 3` for at hente manglende TDC-salg
4. Koer manuel backfill for Relatel med `days: 1`

## Manuel backfill (efter deploy)

Trigger sync via edge function kald:
- Lovablecph: `POST integration-engine` med `{ source: "adversus", integration_id: "<lovablecph-uuid>", actions: ["campaigns","users","sales","sessions"], days: 3 }`
- Relatel: `POST integration-engine` med `{ source: "adversus", integration_id: "<relatel-uuid>", actions: ["campaigns","users","sales","sessions"], days: 1 }`

## Forventet resultat

- 5 minutters pause mellem Lovablecph og Relatel sync eliminerer samtidige API-kald
- 5s exponential backoff haandterer eventuelle resterende 429-fejl
- TDC-salg (Lovablecph) begynder at synkronisere igen


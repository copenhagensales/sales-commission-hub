

# Oprydning af Relatel cron jobs

## Problem
Relatel (657c2050) har 3 aktive cron jobs, hvor 2 af dem overlapper og sales synkroniseres hvert 5. minut i stedet for hvert 15. minut. Dette forårsager:
- Dobbelte API-kald (combined job + dedikeret sales job)
- `skipped_locked`-fejl fra samtidige kørsler
- Unødvendigt forbrug af det delte Adversus API-budget

## Plan

### 1. Fjern det kombinerede job (jobid 135)
Slet `dialer-657c2050-sync` som kører alle actions hvert 15. minut. Det er overflødigt, da sales og meta allerede har dedikerede jobs.

### 2. Ret sales-job til hvert 15. minut (jobid 117)
Ændr `dialer-657c2050-sync-sales` fra `0,5,10,...,55` (hvert 5. min) til `0,15,30,45` (hvert 15. min), staggered fra Lovablecph (som kører :03,:18,:33,:48).

### 3. Behold meta-job uændret (jobid 118)
`dialer-657c2050-sync-meta` kører allerede korrekt på `10,40` (hvert 30. min).

## Resultat efter oprydning

| Job | Schedule | Actions |
|---|---|---|
| `dialer-657c2050-sync-sales` | `0,15,30,45 * * * *` | sales |
| `dialer-657c2050-sync-meta` | `10,40 * * * *` | campaigns, users, calls |

## Tekniske detaljer
- Udføres via SQL: `SELECT cron.unschedule(135)` for at fjerne combined job
- Sales-job opdateres via `cron.alter_job(117, schedule := '0,15,30,45 * * * *')`
- Stagger-mønster: Relatel :00, Lovablecph :03 -- 3 minutters mellemrum forhindrer kollisioner
- Opdatering af `dialer_integrations.config` for Relatel med den nye `sync_schedule`


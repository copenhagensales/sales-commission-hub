

# Genstart Lovablecph backfill (2026-02-12 til i dag)

## Status
- Smart-backfill cursor sidder på **2026-02-12** (stoppet 20. feb)
- 11 dages calls-data mangler (sales synkroniseres allerede via normal cron)
- Adversus API-forbrug er lavt: **291/1000 pr. time** -- perfekt vindue
- Cron jobs 89/94 er slettet og skal ikke genskabes (smart-backfill var midlertidigt)

## Plan

### Trin 1: Kør safe-backfill manuelt
Trigger `safe-backfill` via edge function med:
- **integration_id**: `26fac751-c2d8-4b5b-a6df-e33a32e3c6e7`
- **from**: `2026-02-12`
- **to**: `2026-02-23`
- **background**: `true` (kører dag-for-dag uden at blokere)

Safe-backfill tjekker budget automatisk og stopper tidligt hvis grænsen nærmer sig.

### Trin 2: Verificer
Tjek `integration_logs` og `integration_sync_runs` for at bekræfte at alle 11 dage er processeret.

### Trin 3: Opdater smart-backfill cursor
Opdater sync_state cursoren til `2026-02-23` så smart-backfill ved at alt er hentet.

## Teknisk detalje
- Safe-backfill reserverer 30% kapacitet til løbende synkronisering
- Med kun 291 kald brugt er der ~409 kald tilgængelige til backfill
- 11 dage kræver ca. 88 API-kald (8 pr. dag) -- langt inden for budget

## Risiko
Ingen -- safe-backfill stopper automatisk ved budgetgrænsen.

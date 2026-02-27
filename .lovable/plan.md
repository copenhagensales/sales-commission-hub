

# Forskyd Relatel sales-sync for at undgå 429-kollisioner

## Problem
Relatel og Lovablecph deler samme Adversus API rate-limit (60 req/min). Med Relatel på `:00` og Lovablecph på `:03` er der kun 3 minutters mellemrum, hvilket foraarsager 429-fejl naar begge rammer API'et naesten samtidig.

## Lsning
Flyt Relatel sales-sync fra `0,15,30,45` til `8,23,38,53` saa der er mindst 5 minutters afstand til Lovablecph og 2 minutter fra Relatel's egen meta-job.

### Nyt schedule-overblik (kun Adversus)

| Job | Nuvaerende | Nyt | 
|---|---|---|
| Lovablecph sales | :03, :18, :33, :48 | (uaendret) |
| Lovablecph meta | :05, :35 | (uaendret) |
| Relatel sales | :00, :15, :30, :45 | :08, :23, :38, :53 |
| Relatel meta | :10, :40 | (uaendret) |

### Tidslinjevisning (minut i timen)
```text
:00  :03  :05  :08  :10     :18  :23     :33  :35  :38  :40     :48  :53  :55
      LC   LM   RS   RM      LC   RS      LC   LM   RS   RM      LC   RS
```
LC = Lovablecph sales, LM = Lovablecph meta, RS = Relatel sales, RM = Relatel meta

Minimum afstand mellem Adversus-kald: 2 minutter (meta og sales kolliderer ikke funktionelt da meta kun laver 2 API-kald).

## Tekniske trin

1. **Opdater cron job 117** med nyt schedule:
   - `SELECT cron.alter_job(117, schedule := '8,23,38,53 * * * *')`

2. **Opdater integration config** saa metadata matcher:
   - `UPDATE dialer_integrations SET config = jsonb_set(config, '{sync_schedule}', '"8,23,38,53 * * * *"') WHERE id = '657c2050-...'`

3. **Verificer** at jobbet er korrekt opdateret via `cron.job`


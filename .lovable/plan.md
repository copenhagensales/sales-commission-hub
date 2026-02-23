

# Komplet KPI-rettelse: NULL backfill + filter fix + FM dobbelt-tælling

## Oversigt
Tre sammenhængende problemer løses i ét sweep, så alle dashboards matcher Dagsrapporter.

---

## Del 1: Database — Backfill NULL og sæt default

**Migration SQL:**
```sql
-- Backfill eksisterende NULL-rækker til 'pending'
UPDATE sales SET validation_status = 'pending' WHERE validation_status IS NULL;

-- Sæt default så fremtidige rækker aldrig er NULL
ALTER TABLE sales ALTER COLUMN validation_status SET DEFAULT 'pending';
```

Dette eliminerer NULL-problemet permanent (1.845 rækker opdateres).

---

## Del 2: Edge Functions — Fjern FM dobbelt-tælling

I `calculate-kpi-values/index.ts`, fjern redundant FM-processing fra:

1. **Employee-scoped KPIs** (~linje 614-618): Fjern `empFmSales`-loop
2. **Team-scoped KPIs** (~linje 699-704): Fjern FM commission-addition til `teamCommission`
3. **Global leaderboard** (~linje 1221-1243): Fjern "Process FM sales" blok
4. **Client leaderboard** (~linje 1413-1426): Fjern FM sales processing
5. **Team leaderboard** (~linje 1590-1593): Fjern FM sales processing

---

## Del 3: Genberegn og genaktiver

1. Deploy alle 3 edge functions
2. Trigger `calculate-kpi-values` (chunk: kpis) og (chunk: leaderboards)
3. Trigger `calculate-kpi-incremental` og `calculate-leaderboard-incremental`
4. Genaktiver Lovablecph cron jobs (89 og 94)
5. Verificer at dashboards matcher Dagsrapporter

---

## Rækkefølge
1. Kør migration (backfill + default)
2. Implementer FM dobbelt-tællings-fix i calculate-kpi-values
3. Deploy alle edge functions
4. Genberegn KPIs
5. Genaktiver cron jobs


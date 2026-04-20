

## Problem

Runde 4 sluttede **2026-04-20 00:00** men er stadig markeret `active`. Runde 5 er aldrig blevet oprettet.

**Årsag**: Edge-funktionen `league-process-round` (som lukker udløbne runder, beregner point/op-/nedrykninger, og opretter næste runde) findes og virker — men der er **INTET cron-job** der kalder den automatisk.

Det eneste cron-job for ligaen er `league-standings-refresh` (hver 15. min) som kun opdaterer kvalifikations-standings, ikke runde-processering.

## Plan

### 1. Manuel kørsel for at få runde 5 i gang NU
Kald `league-process-round` én gang via curl for at:
- Lukke runde 4 (status `active` → `completed`)
- Beregne point, op-/nedrykninger, playoff for runde 4
- Persistere `league_round_standings`
- Oprette runde 5 (7 dages varighed, status `active`)

### 2. Tilføj cron-job så det aldrig sker igen
SQL-migration der opretter pg_cron job:

```sql
SELECT cron.schedule(
  'league-process-round-hourly',
  '5 * * * *',  -- hver time kl. xx:05
  $$
  SELECT net.http_post(
    url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/league-process-round',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <anon>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

Hver time tjekker den om en runde er udløbet. Funktionen er idempotent — returnerer "No expired rounds" hvis intet skal ske.

### 3. Verificering
- Kør `SELECT * FROM league_rounds ORDER BY round_number DESC` → bekræft runde 4 = `completed`, runde 5 = `active`
- Tjek `/commission-league` UI → øverst skal vise "RUNDE 5 (i gang)"
- Tjek at top 3 fra runde 4 fryses i historik

### Hvad jeg IKKE rører
- `league-process-round` koden (virker som den skal)
- `league-calculate-standings` cron (virker som det skal)
- Sæson-konfiguration (6 multiplikatorer = 6 runder, korrekt)




## Opsæt cron-job for process-booking-flow

Opretter et pg_cron job der kalder `process-booking-flow` edge-funktionen hvert 5. minut.

### Trin

1. **Aktiver extensions** – Sørg for `pg_cron` og `pg_net` er aktive (sandsynligvis allerede aktive baseret på eksisterende cron-jobs i systemet).

2. **Indsæt cron-job via insert-tool** – Kør SQL der scheduler jobbet:
```sql
SELECT cron.schedule(
  'process-booking-flow-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/process-booking-flow',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <anon_key>"}'::jsonb
  ) AS request_id;
  $$
);
```

### Resultat
Pending touchpoints med `scheduled_at <= now()` vil automatisk blive behandlet inden for 5 minutter.




## Plan: Opsæt ugentligt cron-job for compliance-notifikationer

### Hvad der bygges

Et pg_cron job der kalder `check-compliance-reviews` edge function én gang om ugen (mandag kl. 08:00). Funktionen eksisterer allerede og sender emails via M365 til de modtagere der er konfigureret under `/compliance/notifications`.

### Ændring

**1. Opret cron-job via SQL insert**

Bruger `pg_cron` + `pg_net` til at kalde edge function hver mandag kl. 08:00:

```sql
select cron.schedule(
  'weekly-compliance-review',
  '0 8 * * 1',
  $$
  select net.http_post(
    url:='https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/check-compliance-reviews',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

**2. Tilføj "Send nu"-knap i ComplianceNotifications.tsx**

En knap så admins kan trigge compliance-mailen manuelt (kalder `supabase.functions.invoke("check-compliance-reviews")`). Giver mulighed for at teste inden cron kører.

### Filer

| Fil | Handling |
|-----|---------|
| SQL insert (cron) | Nyt cron-job via insert-tool |
| `src/pages/compliance/ComplianceNotifications.tsx` | Tilføj "Send nu"-knap |

### Teknisk detalje

- Cron-jobbet oprettes via insert-tool (ikke migration) da det indeholder projekt-specifikke værdier (URL + anon key).
- `verify_jwt` er allerede `false` for denne funktion i config.toml, så cron-kaldet virker uden JWT.
- Edge function checker: udløbende dokumenter, APV-deadlines, overskredne opgaver — og sender kun mail hvis der er alerts.




## Fix: Stagger Relatel cron-schedule for at undga Adversus API-kollision

### Problem
Lovablecph og Relatel har begge cron-jobs pa **identiske minutter**: `3,8,13,18,23,28,33,38,43,48,53,58`. De starter samtidigt og rammer Adversus API'et parallelt, hvilket udloser sporadiske 429-fejl pa Relatel (ca. hver 25. minut).

Fail-fast guarden virker korrekt (aborterer pa ~5s), men de sporadiske fejl giver "Kritisk" status i dashboardet.

### Losning
Flyt Relatel's cron-schedule 2 minutter frem, sa den altid korer EFTER Lovablecph er startet og har passeret sine foerste API-kald.

### Aendring

**Database migration** - opdater Relatel's cron job:

```sql
SELECT cron.unschedule('dialer-657c2050-sync');

SELECT cron.schedule(
  'dialer-657c2050-sync',
  '0,5,10,15,20,25,30,35,40,45,50,55 * * * *',
  $$SELECT net.http_post(
    url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/integration-engine',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ..."}'::jsonb,
    body := '{"days": 1, "source": "adversus", "actions": ["campaigns", "users", "sales", "sessions"], "integration_id": "657c2050-1faa-4233-a964-900fb9e7b8c6"}'::jsonb
  ) AS request_id$$
);
```

### Tidsplan efter fix

| Minut | Lovablecph (sales) | Lovablecph (meta) | Relatel |
|-------|-------------------|-------------------|---------|
| :00 | | | Relatel sync |
| :03 | Sales sync | | |
| :05 | | Meta sync (halv-times) | Relatel sync |
| :08 | Sales sync | | |
| :10 | | | Relatel sync |

Der er nu altid mindst 2 minutters mellemrum, sa Adversus API'et nar at nulstille burst-limiten.

### Ingen kodeaendringer
Kun en database cron-justering. Ingen aendringer i edge functions eller frontend.

### Forventet resultat
- Relatel stopper med at fa sporadiske 429-fejl
- "Kritisk" status forsvinder fra dashboardet
- Begge Adversus-integrationer korer stabilt med 5-minutters interval, bare forskudt


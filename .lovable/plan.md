

## Fix: Forskyd Lovablecph sync-meta job så det ikke kolliderer med sync-sales

### Problem
Lovablecph har to cron-jobs der begge korer pa nojagtig de samme minutter:
- `dialer-26fac751-sync-sales`: `3,8,13,18,23,28,33,38,43,48,53,58`
- `dialer-26fac751-sync-meta`: `3,8,13,18,23,28,33,38,43,48,53,58`

Begge rammer den samme Adversus API-konto pa samme tid, hvilket giver 429 rate-limit fejl (19 fejl i dag). Det har intet med andre integrationer at gore -- Lovablecph rate-limiter sig selv.

### Losning
Forskyd `sync-meta` jobbet til hvert 30. minut med 2 minutters offset, sa det aldrig overlapper med `sync-sales`:

| Job | Nuvarende schedule | Nyt schedule |
|---|---|---|
| `sync-sales` | `3,8,13,18,23,28,33,38,43,48,53,58 * * * *` | Uandret |
| `sync-meta` | `3,8,13,18,23,28,33,38,43,48,53,58 * * * *` | `5,35 * * * *` |

Meta-data (campaigns, users, calls) andrer sig sjaldent og behover ikke synkroniseres hvert 5. minut.

### Teknisk andring

**1. Opdater `update-cron-schedule` edge function** (`supabase/functions/update-cron-schedule/index.ts`)

Andringen sikrer at `sync-meta` automatisk far et forskudt schedule nar det oprettes. I `LOVABLE_META_FIVE_MINUTE_SCHEDULE` konstanten (linje 37) andres til et 30-minutters interval med offset:

```
// Fra:
const LOVABLE_META_FIVE_MINUTE_SCHEDULE = "3,8,13,18,23,28,33,38,43,48,53,58 * * * *";

// Til:
const LOVABLE_META_FIVE_MINUTE_SCHEDULE = "5,35 * * * *";
```

Ogsa opdater `getMetaSyncSchedule()` funktionen sa den returnerer 30-minutters schedule for alle Lovable/TDC integrationer (ikke kun lovablecph):

```
// Fra (linje 131-132):
if ((integrationName || "").trim().toLowerCase() === "lovablecph") {
  return LOVABLE_META_FIVE_MINUTE_SCHEDULE;
}

// Til:
return LOVABLE_META_FIVE_MINUTE_SCHEDULE;
```

**2. Database: Opdater det aktive cron-job**

Kor en SQL-opdatering for at andre det eksisterende cron-job med det samme (sa vi ikke skal vente pa at nogen trigger `update-cron-schedule`):

```sql
SELECT cron.schedule(
  'dialer-26fac751-sync-meta',
  '5,35 * * * *',
  -- (eksisterende command forbliver uandret)
);
```

Alternativt: kald `update-cron-schedule` edge function for Lovablecph, som vil gen-oprette begge jobs med de korrekte schedules.

### Filer der andres

| Fil | Andring |
|---|---|
| `supabase/functions/update-cron-schedule/index.ts` | Opdater `LOVABLE_META_FIVE_MINUTE_SCHEDULE` og `getMetaSyncSchedule()` |
| Database (cron.job) | Opdater schedule for `dialer-26fac751-sync-meta` |

### Resultat
- Sales-sync korer uforstyrret hvert 5. minut (minut 3,8,13,...)
- Meta-sync korer hvert 30. minut (minut 5,35), aldrig samtidig med sales
- Forventet reduktion fra ~19 fejl/dag til 0
- Campaigns/users/calls opdateres stadig regelmaessigt


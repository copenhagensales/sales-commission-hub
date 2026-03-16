

## Fix: Eesy `skipped_locked` ved :15 hvert time

### Root cause

Eesy har to cron jobs:
- **Meta** (users, campaigns, sessions): kører `:10` hver time
- **Sales**: kører `:00, :15, :30, :45`

Begge bruger **samme per-integration run lock** (`integration_run_locks` keyed by `integration_id`). Meta sync starter `:10`, men i tilfælde hvor den crasher/timer ud, frigives låsen **ikke** — og TTL er 10 minutter. Sales-synkroniseringen ved `:15` finder låsen stadig aktiv og springer over.

Data bekræfter: der er ingen meta sync completion records efter kl. 11:10 i dag, men låsen bliver erhvervet. Sales ved `:30` og `:45` kører fint (låsen er udløbet).

### Plan (2 ændringer)

**1. Reducer lock TTL fra 10 min til 3 min** (`run-lock.ts`)

Meta sync tager normalt 40-60 sek. En 3-minutters TTL giver rigeligt headroom, men sikrer at en crashed sync ikke blokerer næste sales window.

```
LOCK_TTL_MS: 10 * 60 * 1000  →  3 * 60 * 1000
```

**2. Flyt Eesy meta cron fra `:10` til `:05`**

Giver 10 min headroom til sales ved `:15` i stedet for 5 min. Selv med en langsom meta sync (60 sek) vil låsen være frigivet i god tid.

```sql
-- Fjern gammel
SELECT cron.unschedule(130);
-- Tilføj ny med :05 schedule
SELECT cron.schedule('enreach-eesy-meta', '5 * * * *', $$ ... $$);
```

### Resultat
- Selv hvis meta sync crasher, udløber låsen efter 3 min (inden `:15` sales)
- Normal meta (:05 → :06) frigiver låsen 9 min før sales (:15)
- Ingen kodeændringer i sync-integration.ts nødvendige


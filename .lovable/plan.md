

## Fix: Weekend-cleanup mail skal sendes kl. 16:00 dansk tid

### Problem
Cron-jobbet kører `0 15 * * 5` (15:00 UTC). Det giver:
- **Vintertid (CET):** 16:00 ✅
- **Sommertid (CEST):** 17:00 ❌ ← vi er her nu

### Løsning
Ændre cron-schedule til `0 14 * * 5` (14:00 UTC) så det rammer 16:00 i sommertid.

**Bemærk:** I vintertid vil det så blive kl. 15:00 dansk tid. pg_cron kører i UTC og understøtter ikke automatisk DST-justering. Der er to muligheder:

1. **Simpel:** Sæt til `0 14 * * 5` — kl. 16:00 om sommeren, kl. 15:00 om vinteren. Tæt nok på.
2. **Præcis:** Lade edge-funktionen selv tjekke dansk klokkeslæt og skippe hvis det ikke er tæt på kl. 16, og køre cron hvert kvarter fredag eftermiddag. Overkill for en påmindelse.

### Anbefaling: Mulighed 1
Opdater cron-jobbet med SQL:
```sql
SELECT cron.alter_job(53, '0 14 * * 5');
```

Det er én SQL-kommando — ingen kodeændringer.


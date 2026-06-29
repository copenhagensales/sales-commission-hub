## Problem

Noah Juul B vises som #2 med 800 kr fordi:

1. Han er tilmeldt sæsonen som **tilskuer** (`league_enrollments.is_spectator = true`).
2. Edge functionen `league-calculate-standings` skipper tilskuere (`.eq("is_spectator", false)` i `index.ts:96`), så hans `league_qualification_standings`-række er frosset fra 24. juni kl. 06:50 (hvor han faktisk var nr. 2 blandt de få med salg på det tidspunkt).
3. Frontend sorterer på `overall_rank ASC` i `useQualificationStandings`, så han bliver hængende på rank 2 selvom alle andre i dag har langt højere provision.

Hans reelle kvalifikation (22.–28. juni) er 26 salg / 2.600 kr — han hører ikke til i top 3.

## Løsning (valgt: skjul tilskuere i UI)

Filtrér tilskuer-rækker fra i selve standings-listen, og renummerér visningen så ranks bliver sammenhængende.

### Ændringer

**`src/hooks/useLeagueData.ts`** (grøn zone — data-hook, ingen DB-skema, ingen pricing/løn)

- I `useQualificationStandings(seasonId)`:
  - Efter standings-fetch, hent `league_enrollments` for sæsonen med `employee_id, is_spectator`.
  - Byg `Set<string>` af `employee_id` hvor `is_spectator = true`.
  - Filtrér standings: behold kun rækker hvis `employee_id` IKKE er i tilskuer-sættet.
  - Renummerér `overall_rank` baseret på array-position (1-indexed) efter filter, så `CompactLeagueView` og medaljer/badges (Top 3, Playoff, Nedrykker) fortsat virker korrekt. Behold `current_provision` urørt.
- Samme filter + renummerering i `useQualificationStandingsRealtime` (linje 465) så realtime-varianten matcher.

`useMyQualificationStanding` rører vi ikke — hvis en tilskuer selv åbner siden, må de gerne se deres egen (stale) status. `CompactLeagueView` bruger ikke den hook.

### Ingen ændringer til

- `league-calculate-standings` edge function (uændret — fortsætter med at springe tilskuere over).
- DB-skema (ingen migration).
- Noahs eksisterende række i `league_qualification_standings` (lades stå; den vises bare ikke længere).

### Verifikation

Efter ændring: åbn `/commission-league` og bekræft at Noah Juul B (United) ikke længere er synlig i Superligaen, og at ranks går 1, 2, 3, … uden huller. Bekræft at de andre 9 synlige spillere matcher rækkefølgen efter `current_provision DESC`.

### Bivirkning at være opmærksom på

Hvis en tilskuer senere konverteres til fuld deltager (`is_spectator = false`), starter de uden standings-række indtil næste edge function-kørsel — det er allerede status quo og uændret.

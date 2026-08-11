# Auto-tilmelding af sælgere til Superligaen

I dag skal hver medarbejder selv trykke "Tilmeld mig nu" på ligasiden. Derfor står Sæson 4 med 0 spillere, mens Sæson 3 havde 101. Planen gør tilmelding automatisk ved hver ny sæson og fylder Sæson 4 op nu.

## Hvem bliver tilmeldt

Aktive medarbejdere, hvis rolle ikke er på listen over ikke-deltagende roller (ejer, fm_leder, assisterende teamleder FM, SOME, rekruttering).

Det giver i dag: Salgskonsulent (86), Fieldmarketing (25), Teamleder (4), Assisterende Teamleder TM (3) = 118 spillere.

Medlemmer af teamet "Stab" tilmeldes som fans (tilskuere) — samme regel som i dag ved manuel tilmelding.

## Regler for automatikken

- Opretter kun manglende tilmeldinger. Har man selv afmeldt sig, bliver man **ikke** tilmeldt igen.
- Man kan fortsat selv afmelde eller skifte til fan bagefter.
- Nye medarbejdere, der oprettes midt i en sæson, tilmeldes ved næste automatiske kørsel.

## Sådan bygges det

1. **Databasefunktion** `public.league_auto_enroll_season(p_season_id uuid)` (SECURITY DEFINER):
   - finder aktive medarbejdere med deltagende rolle via `job_positions.system_role_key`
   - indsætter rækker i `league_enrollments`, der ikke findes i forvejen, med `is_spectator = true` for Stab-medlemmer
   - returnerer antal oprettede spillere/fans
2. **Kobling til sæson-automatikken:** `league_auto_advance_seasons()` kalder funktionen, når en sæson går ind i kvalifikationsfasen, så hver ny sæson fyldes automatisk.
3. **Daglig opsamling:** samme funktion kaldes for den aktive sæson i den eksisterende KPI-cron, så nyansatte kommer med.
4. **Engangs-kørsel for Sæson 4:** funktionen kaldes én gang nu, så kvalifikationen (10.–16. august) har alle spillere med fra start.
5. **Ligasiden:** landingskortet med "Tilmeld mig nu" bevares uændret som fallback for dem, der har afmeldt sig.

## Teknisk

- Rød zone: rolle-/rettighedsopslag og ny SECURITY DEFINER-funktion med `set search_path = public`. Ingen ændring i `permissionKeys.ts` eller pointberegning.
- `league_enrollments` får ingen skemaændring; rolle-listen (`NON_PARTICIPATING_ROLES`) spejles i SQL-funktionen og dokumenteres, så frontend og DB holdes 1:1.
- Efter kørsel invalideres `league-enrollment-count` og `league-qualification-standings` ved næste standings-beregning.

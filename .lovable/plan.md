

## Plan: Behold team_members ved deaktivering

### Problem
Når en medarbejder deaktiveres, sletter triggeren `remove_deactivated_employee_from_teams` deres `team_members`-række. Selvom `last_team_id` sættes som fallback, er det ikke altid tilstrækkeligt — fx hvis medarbejderen aldrig havde en team_members-post, eller hvis andre dele af systemet kun kigger på `team_members`.

### Løsning
Fjern `DELETE FROM team_members` fra triggeren, så inaktive medarbejdere beholder deres team-tilknytning. Da alle relevante queries allerede filtrerer på `is_active` fra `employee_master_data`, vil inaktive medarbejdere ikke "forurene" aktive teamoversigter, men de vil fortsat fremgå korrekt i dagsrapporter og lønrapporter.

### Trin

1. **Opdater trigger-funktionen** via migration:
   - Fjern linjen `DELETE FROM public.team_members WHERE employee_id = NEW.id;`
   - Behold alt andet (historical_employment, league cleanup, contract cancel, referral reject)

2. **Verificér dagsrapporter**: Sikr at inaktive medarbejdere med team_members nu vises korrekt under deres team i dagsrapporter.

### Teknisk detalje
- Én SQL-migration der erstatter trigger-funktionen
- Ingen kodeændringer i frontend — dagsrapporter bruger allerede `team_members` + `last_team_id` fallback
- `last_team_id` sættes stadig som backup


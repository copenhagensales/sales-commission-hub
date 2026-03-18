

## Fix: Multi-email mapping i league-process-round

`league-calculate-standings` blev rettet korrekt med `Record<string, string[]>`, men `league-process-round` bruger stadig `Record<string, string>` — den gamle single-email logik.

### Ændring

**Fil:** `supabase/functions/league-process-round/index.ts` (linje 155-278)

Samme fix som blev lavet i `league-calculate-standings`:

| Linje | Nu | Skal være |
|-------|-----|-----------|
| 155 | `employeeToEmail: Record<string, string>` | `employeeToEmails: Record<string, string[]>` |
| 156-158 | Overskriver med `= email` | Push til array, undgå duplikater |
| 166-168 | Overskriver med `= work_email` | Push til array, undgå duplikater |
| 262-270 | Slår op på én email | Itererer over alle emails og summerer |

Logikken skal matche præcis det der allerede virker i `league-calculate-standings` linje 114-147 og 249-268.


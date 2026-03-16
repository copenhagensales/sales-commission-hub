

## Overfør tilmeldinger fra Sæson 1 til Sæson 2

### Status nu
- **Sæson 1**: 55 aktive spillere + 3 fans = 58 aktive tilmeldinger (+ 21 inaktive)
- **Sæson 2** (id: `1413d941...`): 0 tilmeldinger

### Plan

Kør én SQL-migration der kopierer alle **aktive** tilmeldinger fra Sæson 1 til Sæson 2:

```sql
INSERT INTO league_enrollments (season_id, employee_id, is_active, is_spectator, enrolled_at)
SELECT 
  '1413d941-ed9f-4c55-a7ff-d1bc948eb5da',  -- Sæson 2
  employee_id,
  true,
  is_spectator,
  now()
FROM league_enrollments
WHERE season_id = 'dd9d9404-0a8c-4ed7-9c7a-2a446d54ff78'
  AND is_active = true;
```

Dette overfører:
- **55 aktive spillere** (beholder `is_spectator = false`)
- **3 fans** (beholder `is_spectator = true`)
- Inaktive/afmeldte kopieres **ikke**

Derefter køres `league-calculate-standings` for at generere kvalifikationsstandings for de overførte spillere.

Ingen kodeændringer nødvendige — kun databaseopdatering.


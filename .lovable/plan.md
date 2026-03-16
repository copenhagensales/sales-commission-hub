

## Auto-fjern fra liga ved deaktivering

### Hvad skal ændres

Udvid den eksisterende `remove_deactivated_employee_from_teams()` trigger-funktion med 2 ekstra operationer når `is_active` går fra `true` → `false`:

1. **Soft-delete league enrollment**: `UPDATE league_enrollments SET is_active = false WHERE employee_id = NEW.id`
2. **Fjern standings**: `DELETE FROM league_qualification_standings WHERE employee_id = NEW.id`

### Teknisk plan

**1 database-migration** — tilføj liga-oprydning til den eksisterende trigger-funktion:

```sql
CREATE OR REPLACE FUNCTION public.remove_deactivated_employee_from_teams()
-- Eksisterende logik bevares (historical_employment, team_members, contracts)
-- NYT: efter linje 71, tilføj:
    UPDATE public.league_enrollments SET is_active = false WHERE employee_id = NEW.id;
    DELETE FROM public.league_qualification_standings WHERE employee_id = NEW.id;
```

Ingen kodeændringer i frontend — triggeren kører automatisk i databasen.


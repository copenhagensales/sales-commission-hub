
# Plan: Tilføj Rekruttering til is_teamleder_or_above()

## Baggrund
Oscar Belcher med job_title "Rekruttering" kan ikke se sit teams indstemplinger fordi `is_teamleder_or_above()` funktionen kun tillader disse job_titles:
- ejer
- teamleder
- assisterende teamleder
- fieldmarketing leder

## Løsning
Opdater database-funktionen til at inkludere 'rekruttering' i whitelisten.

## Database migration

```sql
CREATE OR REPLACE FUNCTION public.is_teamleder_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role IN ('teamleder', 'ejer')
  )
  OR EXISTS (
    SELECT 1 FROM public.employee_master_data
    WHERE auth_user_id = _user_id 
      AND is_active = true
      AND LOWER(job_title) IN (
        'ejer', 
        'teamleder', 
        'assisterende teamleder', 
        'fieldmarketing leder',
        'rekruttering'  -- Ny tilføjelse
      )
  )
$$;
```

## Påvirkede områder
Denne ændring giver rekrutteringsmedarbejdere adgang til team-data i:

| Tabel | Policy |
|-------|--------|
| `time_stamps` | Teamledere can manage team time stamps |
| Andre tabeller der bruger `is_teamleder_or_above()` | Alle RLS policies der kalder funktionen |

## Risiko
Lav risiko - tilføjer kun én ny titel til en eksisterende whitelist. Ingen breaking changes.

## Teknisk sektion
- Funktionen bruger `LOWER()` så case-sensitivity er ikke et problem
- `SECURITY DEFINER` sikrer at funktionen kører med tilstrækkelige rettigheder
- Ændringen træder i kraft øjeblikkeligt efter migration

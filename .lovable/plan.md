
# Fix: Thomas Wehage kan ikke melde folk syge

## Problem identificeret
Thomas Wehage (Assisterende Teamleder FM) får RLS-fejl ved oprettelse af fravær fordi database-funktionen `is_teamleder_or_above()` **mangler hans job title** i whitelisten.

## Teknisk årsag

### Nuværende `is_teamleder_or_above()` funktion:
```sql
LOWER(job_title) IN (
  'ejer', 
  'teamleder', 
  'assisterende teamleder',  -- ✅ uden FM
  'fieldmarketing leder',
  'rekruttering'
)
```

### Thomas Wehages data:
- **job_title**: "Assisterende Teamleder FM" ❌ (matcher ikke)
- **system_role_key**: "assisterende_teamleder_fm"
- Ingen entry i `system_roles` tabellen

## Løsning
Opdater `is_teamleder_or_above()` funktionen til at inkludere "assisterende teamleder fm" i job title listen.

### SQL Migration:
```sql
CREATE OR REPLACE FUNCTION public.is_teamleder_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
        'assisterende teamleder fm',  -- NY TILFØJELSE
        'fieldmarketing leder',
        'rekruttering'
      )
  )
$$;
```

## Påvirkede tabeller
Denne funktion bruges i RLS-politikker for:
- `absence_request_v2` (fraværsanmodninger)
- Muligvis andre tabeller der kræver leder-adgang

## Forventet resultat
Efter ændringen vil Thomas Wehage kunne:
- Oprette fraværsanmodninger for teammedlemmer
- Opdatere eksisterende fravær
- Slette fravær

## Alternativ løsning
Tilføj Thomas til `system_roles` tabellen med rollen 'teamleder':
```sql
INSERT INTO system_roles (user_id, role)
VALUES ('cb0eb55a-f2dc-476a-b09a-f8e7cb2e3f45', 'teamleder');
```
Men den primære løsning (opdatering af funktionen) er bedre da den gælder alle fremtidige "Assisterende Teamleder FM" ansatte.

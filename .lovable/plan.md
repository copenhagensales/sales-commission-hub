

## Problem: 'some' rollen kan ikke se kandidat-data (RLS blokerer)

### Årsag

Problemet er **ikke** i UI-rettigheder — det er i databasens Row Level Security (RLS). 

`candidates` tabellen har disse SELECT-policies:
- `is_rekruttering()` — tjekker for rolle `rekruttering`
- `is_teamleder_or_above()` — tjekker for `teamleder`, `ejer`, og specifikke jobtitler

**Rollen `some` er ikke inkluderet i nogen af disse funktioner**, så databasen returnerer 0 rækker — uanset hvad der står i permission-editoren.

### Løsning

Tilføj en ny RLS-policy på `candidates` tabellen der giver `some`-rollen SELECT-adgang:

```sql
CREATE POLICY "Some role can view candidates"
ON public.candidates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = auth.uid() AND role = 'some'
  )
  OR EXISTS (
    SELECT 1 FROM public.employee_master_data
    WHERE auth_user_id = auth.uid()
      AND is_active = true
      AND LOWER(job_title) = 'some'
  )
);
```

**Alternativt** (mere fremtidssikret): Opdatér `is_rekruttering` eller opret en ny helper-funktion `is_some()` og tilføj den til den eksisterende policy, så man slipper for at lave en ny policy for hver rolle.

### Ingen kodeændringer nødvendige

Kun én database-migration. UI-koden og hooks virker allerede korrekt — det er kun RLS der blokerer.


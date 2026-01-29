
# Fix: Event Invitation Popup - RLS Policy

## Problem
Medarbejdere kan ikke trykke "Deltager" på event invitationer, og får fejlen "Der opstod en fejl".

## Årsag
RLS-policyen på `event_invitation_views` tabellen bruger en forældet `employee` tabel (med kun 2 poster) i stedet for `employee_master_data` (134 medarbejdere).

**Nuværende policy:**
```sql
WHERE employee_id IN (SELECT id FROM employee WHERE email = auth.jwt()->>'email')
```

**Korrekt policy:**
```sql
WHERE employee_id IN (
  SELECT id FROM employee_master_data 
  WHERE LOWER(private_email) = LOWER(auth.jwt()->>'email') 
     OR LOWER(work_email) = LOWER(auth.jwt()->>'email')
)
```

## Løsning

### Database ændring
Opdater RLS-policyen på `event_invitation_views`:

```sql
-- Drop den fejlagtige policy
DROP POLICY IF EXISTS "Users can manage own invitation views" ON event_invitation_views;

-- Opret korrekt policy med employee_master_data
CREATE POLICY "Users can manage own invitation views"
ON event_invitation_views
FOR ALL
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM employee_master_data 
    WHERE LOWER(private_email) = LOWER(auth.jwt()->>'email') 
       OR LOWER(work_email) = LOWER(auth.jwt()->>'email')
  )
)
WITH CHECK (
  employee_id IN (
    SELECT id FROM employee_master_data 
    WHERE LOWER(private_email) = LOWER(auth.jwt()->>'email') 
       OR LOWER(work_email) = LOWER(auth.jwt()->>'email')
  )
);
```

## Tekniske detaljer

| Tabel | Antal poster |
|-------|--------------|
| `employee` (forældet) | 2 |
| `employee_master_data` | 134 |

Policyen matcher brugerens email fra JWT mod tabellens emails. Da næsten alle medarbejdere kun findes i `employee_master_data`, fejler INSERT for alle undtagen de 2 i `employee`.

## Påvirkning
- Ingen kodeændringer nødvendige
- Kun én database migration
- Alle medarbejdere vil kunne bruge popup'en efter ændringen

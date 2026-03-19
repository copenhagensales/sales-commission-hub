

# Problem: Oscar kan ikke slette Benjamin Mora Sørensen

## Årsag
Benjamin Mora Sørensen er koblet til en medarbejder-referral (fra Anders Schjødt Kristensen, referral-kode AND6A140). Tabellen `employee_referrals` har en foreign key `converted_to_candidate_id` → `candidates(id)` **uden** `ON DELETE CASCADE` eller `SET NULL`. Databasen blokerer derfor sletningen med en FK-violation.

Oscars rettigheder er fine — `is_teamleder_or_above` returnerer `true` for hans bruger. Problemet er rent en database-constraint.

## Løsning
Opdater foreign key constrainten på `employee_referrals.converted_to_candidate_id` til `ON DELETE SET NULL`, så referral-posten bevares (historik), men kandidaten kan slettes.

## Teknisk ændring

**Database migration** (én SQL-sætning):
```sql
ALTER TABLE public.employee_referrals
  DROP CONSTRAINT employee_referrals_converted_to_candidate_id_fkey,
  ADD CONSTRAINT employee_referrals_converted_to_candidate_id_fkey
    FOREIGN KEY (converted_to_candidate_id)
    REFERENCES public.candidates(id)
    ON DELETE SET NULL;
```

Ingen kodeændringer nødvendige — frontend-koden fungerer allerede korrekt.


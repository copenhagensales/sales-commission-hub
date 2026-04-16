

# Plan: Flyt auto-enrollment trigger til `candidates`-tabellen

## Problem
Triggeren `trg_auto_enroll_application` sidder på `applications`, men webhook'en kun inserter i `candidates`. Derfor sker der ingenting automatisk.

## Løsning
Én database-migration der:

1. Dropper den eksisterende trigger og funktion på `applications`
2. Opretter ny funktion `auto_enroll_new_candidate()` på `candidates`-tabellen
3. Opretter trigger `trg_auto_enroll_candidate` AFTER INSERT på `candidates`

```sql
DROP TRIGGER IF EXISTS trg_auto_enroll_application ON public.applications;
DROP FUNCTION IF EXISTS public.auto_enroll_new_application();

CREATE OR REPLACE FUNCTION public.auto_enroll_new_candidate()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.booking_flow_enrollments (
    candidate_id, tier, status, approval_status
  ) VALUES (
    NEW.id, 'A', 'pending_approval', 'pending'
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE TRIGGER trg_auto_enroll_candidate
AFTER INSERT ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.auto_enroll_new_candidate();
```

## Ingen kodeændringer
BookingFlow.tsx håndterer allerede `application_id = NULL` korrekt.

## Fil der ændres
- Ny database-migration (SQL)


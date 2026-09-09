CREATE OR REPLACE FUNCTION public.prevent_duplicate_employee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  existing RECORD;
BEGIN
  IF NEW.work_email IS NOT NULL AND btrim(NEW.work_email) <> '' THEN
    SELECT id, first_name, last_name, is_active INTO existing
    FROM public.employee_master_data
    WHERE lower(btrim(work_email)) = lower(btrim(NEW.work_email))
    ORDER BY is_active DESC, created_at ASC
    LIMIT 1;

    IF existing.id IS NOT NULL THEN
      IF existing.is_active THEN
        RAISE EXCEPTION 'Denne medarbejder findes allerede: % % (aktiv). Ret det eksisterende stamkort i stedet for at oprette nyt.',
          existing.first_name, existing.last_name;
      ELSE
        RAISE EXCEPTION 'Denne medarbejder findes allerede (inaktiv): % % — genaktivér i stedet for at oprette ny.',
          existing.first_name, existing.last_name;
      END IF;
    END IF;
  END IF;

  IF NEW.private_email IS NOT NULL AND btrim(NEW.private_email) <> '' THEN
    SELECT id, first_name, last_name, is_active INTO existing
    FROM public.employee_master_data
    WHERE lower(btrim(private_email)) = lower(btrim(NEW.private_email))
    ORDER BY is_active DESC, created_at ASC
    LIMIT 1;

    IF existing.id IS NOT NULL THEN
      IF existing.is_active THEN
        RAISE EXCEPTION 'Denne medarbejder findes allerede: % % (aktiv). Ret det eksisterende stamkort i stedet for at oprette nyt.',
          existing.first_name, existing.last_name;
      ELSE
        RAISE EXCEPTION 'Denne medarbejder findes allerede (inaktiv): % % — genaktivér i stedet for at oprette ny.',
          existing.first_name, existing.last_name;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_employee ON public.employee_master_data;
CREATE TRIGGER trg_prevent_duplicate_employee
BEFORE INSERT ON public.employee_master_data
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_employee();
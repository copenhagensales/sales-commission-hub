CREATE OR REPLACE FUNCTION public.prevent_duplicate_employee()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  existing RECORD;
  status_txt text;
BEGIN
  -- Arbejdsmail: én mail = ét kort, uanset status. Ved UPDATE kun når mailen reelt ændres.
  IF NEW.work_email IS NOT NULL AND btrim(NEW.work_email) <> ''
     AND (TG_OP = 'INSERT' OR lower(btrim(coalesce(OLD.work_email, ''))) <> lower(btrim(NEW.work_email))) THEN
    SELECT id, first_name, last_name, is_active, employment_start_date INTO existing
    FROM public.employee_master_data
    WHERE lower(btrim(work_email)) = lower(btrim(NEW.work_email))
      AND id <> NEW.id
    ORDER BY is_active DESC, created_at ASC
    LIMIT 1;

    IF existing.id IS NOT NULL THEN
      status_txt := CASE WHEN existing.is_active THEN 'aktiv' ELSE 'deaktiveret' END;
      RAISE EXCEPTION 'Arbejdsmailen findes allerede på medarbejderkortet % % (%, ansat %). %',
        existing.first_name, existing.last_name, status_txt,
        coalesce(to_char(existing.employment_start_date, 'DD-MM-YYYY'), 'ukendt dato'),
        CASE WHEN existing.is_active THEN 'Ret det eksisterende kort i stedet.'
             ELSE 'Genaktivér det kort i stedet for at oprette et nyt.' END
        USING HINT = 'duplicate_work_email:' || existing.id::text;
    END IF;
  END IF;

  -- Privat e-mail: uændret adfærd, kun ved oprettelse.
  IF TG_OP = 'INSERT' AND NEW.private_email IS NOT NULL AND btrim(NEW.private_email) <> '' THEN
    SELECT id, first_name, last_name, is_active INTO existing
    FROM public.employee_master_data
    WHERE lower(btrim(private_email)) = lower(btrim(NEW.private_email))
    ORDER BY is_active DESC, created_at ASC
    LIMIT 1;

    IF existing.id IS NOT NULL THEN
      IF existing.is_active THEN
        RAISE EXCEPTION 'Denne medarbejder findes allerede: % % (aktiv). Ret det eksisterende stamkort i stedet for at oprette nyt.',
          existing.first_name, existing.last_name
          USING HINT = 'duplicate_private_email:' || existing.id::text;
      ELSE
        RAISE EXCEPTION 'Denne medarbejder findes allerede (inaktiv): % % — genaktivér i stedet for at oprette ny.',
          existing.first_name, existing.last_name
          USING HINT = 'duplicate_private_email:' || existing.id::text;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_employee_update ON public.employee_master_data;
CREATE TRIGGER trg_prevent_duplicate_employee_update
  BEFORE UPDATE OF work_email ON public.employee_master_data
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_employee();
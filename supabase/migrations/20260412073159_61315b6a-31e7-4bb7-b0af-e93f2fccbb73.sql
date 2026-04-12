
CREATE OR REPLACE FUNCTION public.auto_set_position_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_position_id uuid;
BEGIN
  -- Only act if position_id is NULL and job_title is set
  IF NEW.position_id IS NULL AND NEW.job_title IS NOT NULL AND BTRIM(NEW.job_title) != '' THEN
    SELECT id INTO v_position_id
    FROM public.job_positions
    WHERE LOWER(BTRIM(name)) = LOWER(BTRIM(NEW.job_title))
    LIMIT 1;

    IF v_position_id IS NOT NULL THEN
      NEW.position_id := v_position_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists to avoid duplicate
DROP TRIGGER IF EXISTS trg_auto_set_position_id ON public.employee_master_data;

CREATE TRIGGER trg_auto_set_position_id
BEFORE INSERT OR UPDATE ON public.employee_master_data
FOR EACH ROW
EXECUTE FUNCTION public.auto_set_position_id();

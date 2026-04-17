-- 1. RPC: check valid (non-expired) Code of Conduct completion via auth.uid OR email-matched employees
CREATE OR REPLACE FUNCTION public.has_valid_code_of_conduct_completion(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = _user_id LIMIT 1;

  RETURN EXISTS (
    SELECT 1
    FROM public.code_of_conduct_completions c
    WHERE c.passed_at > now() - interval '60 days'
      AND c.employee_id IN (
        SELECT id FROM public.employee_master_data WHERE auth_user_id = _user_id
        UNION
        SELECT id FROM public.employee_master_data
        WHERE v_email IS NOT NULL
          AND (lower(private_email) = lower(v_email) OR lower(work_email) = lower(v_email))
      )
  );
END;
$$;

-- 2. Trigger: when a completion is inserted/updated, auto-acknowledge any open reminder for that employee
CREATE OR REPLACE FUNCTION public.auto_acknowledge_coc_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.code_of_conduct_reminders
  SET acknowledged_at = now()
  WHERE employee_id = NEW.employee_id
    AND acknowledged_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_acknowledge_coc_reminders ON public.code_of_conduct_completions;
CREATE TRIGGER trg_auto_acknowledge_coc_reminders
AFTER INSERT OR UPDATE ON public.code_of_conduct_completions
FOR EACH ROW
EXECUTE FUNCTION public.auto_acknowledge_coc_reminders();

-- 3. Heal: auto-acknowledge any open reminder where employee already has a valid completion
UPDATE public.code_of_conduct_reminders r
SET acknowledged_at = now()
WHERE r.acknowledged_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.code_of_conduct_completions c
    WHERE c.employee_id = r.employee_id
      AND c.passed_at > now() - interval '60 days'
  );
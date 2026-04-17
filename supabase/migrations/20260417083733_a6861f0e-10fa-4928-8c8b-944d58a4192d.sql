CREATE OR REPLACE FUNCTION public.has_completed_pulse_survey(_survey_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_email text;
BEGIN
  IF _survey_id IS NULL OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid() LIMIT 1;

  RETURN EXISTS (
    SELECT 1
    FROM public.pulse_survey_completions c
    WHERE c.survey_id = _survey_id
      AND c.employee_id IN (
        SELECT id FROM public.employee_master_data WHERE auth_user_id = auth.uid()
        UNION
        SELECT id FROM public.employee_master_data
        WHERE v_email IS NOT NULL
          AND (lower(private_email) = lower(v_email) OR lower(work_email) = lower(v_email))
      )
  );
END;
$function$;

INSERT INTO public.pulse_survey_completions (survey_id, employee_id, completed_at)
SELECT DISTINCT d.survey_id, d.employee_id, COALESCE(d.created_at, now())
FROM public.pulse_survey_dismissals d
JOIN public.pulse_surveys s ON s.id = d.survey_id AND s.is_active = true
JOIN public.employee_master_data e ON e.id = d.employee_id AND e.is_active = true
WHERE NOT EXISTS (
  SELECT 1 FROM public.pulse_survey_completions c
  WHERE c.survey_id = d.survey_id AND c.employee_id = d.employee_id
)
ON CONFLICT DO NOTHING;
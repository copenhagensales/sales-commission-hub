CREATE OR REPLACE FUNCTION public.log_salary_access_bulk(
  p_employee_ids uuid[],
  p_field text DEFAULT 'salary',
  p_access_type text DEFAULT 'view'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR p_employee_ids IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.sensitive_data_access_log (user_id, employee_id, field_accessed, access_type)
  SELECT auth.uid(), eid, COALESCE(p_field, 'salary'), COALESCE(p_access_type, 'view')
  FROM unnest(p_employee_ids) AS eid
  WHERE eid IS NOT NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.log_salary_access_bulk(uuid[], text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_salary_access_bulk(uuid[], text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_salary_access_bulk(uuid[], text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_salary_access_bulk(uuid[], text, text) TO service_role;
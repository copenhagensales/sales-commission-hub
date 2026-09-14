ALTER TABLE public.employee_master_data
  ADD COLUMN IF NOT EXISTS display_name_short text NULL;

COMMENT ON COLUMN public.employee_master_data.display_name_short IS 'Optional short display name override for leaderboards/TV boards. NULL = derive "Firstname L." from first_name/last_name.';

UPDATE public.employee_master_data
SET display_name_short = 'William S.'
WHERE id = '362c2441-4ee3-4c42-a12e-5b657fee4dcb';

CREATE OR REPLACE FUNCTION public.get_display_name_overrides()
RETURNS TABLE(full_name text, display_name_short text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT btrim(concat_ws(' ', btrim(e.first_name), btrim(e.last_name))) AS full_name,
         btrim(e.display_name_short) AS display_name_short
  FROM public.employee_master_data e
  WHERE e.display_name_short IS NOT NULL
    AND btrim(e.display_name_short) <> ''
$$;

GRANT EXECUTE ON FUNCTION public.get_display_name_overrides() TO authenticated, anon, service_role;
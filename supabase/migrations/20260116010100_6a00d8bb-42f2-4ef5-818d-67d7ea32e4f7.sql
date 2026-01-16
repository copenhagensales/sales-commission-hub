-- Drop legacy manager columns from job_positions
ALTER TABLE job_positions DROP COLUMN IF EXISTS is_manager;
ALTER TABLE job_positions DROP COLUMN IF EXISTS manager_data_scope;

-- Update is_manager_or_above to use is_teamleder_or_above (they do the same thing)
CREATE OR REPLACE FUNCTION public.is_manager_or_above(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_teamleder_or_above(_user_id)
$function$;

-- Drop the function that relied on removed columns
DROP FUNCTION IF EXISTS get_user_manager_scope(uuid);

-- Update is_manager_position to also use is_teamleder_or_above
CREATE OR REPLACE FUNCTION public.is_manager_position(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_teamleder_or_above(_user_id)
$function$;
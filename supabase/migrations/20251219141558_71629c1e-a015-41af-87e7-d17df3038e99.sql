
-- Update is_owner to also check job_title
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role = 'ejer'
  )
  OR EXISTS (
    SELECT 1 FROM public.employee_master_data
    WHERE auth_user_id = _user_id 
      AND is_active = true
      AND job_title = 'Ejer'
  )
$$;

-- Update is_teamleder_or_above to also check job_title
CREATE OR REPLACE FUNCTION public.is_teamleder_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role IN ('teamleder', 'ejer')
  )
  OR EXISTS (
    SELECT 1 FROM public.employee_master_data
    WHERE auth_user_id = _user_id 
      AND is_active = true
      AND job_title IN ('Ejer', 'Teamleder', 'Assisterende Teamleder', 'Fieldmarketing leder')
  )
$$;

-- Update is_rekruttering to also check job_title
CREATE OR REPLACE FUNCTION public.is_rekruttering(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role = 'rekruttering'
  )
  OR EXISTS (
    SELECT 1 FROM public.employee_master_data
    WHERE auth_user_id = _user_id 
      AND is_active = true
      AND job_title = 'Rekruttering'
  )
$$;

-- Update is_some to also check job_title
CREATE OR REPLACE FUNCTION public.is_some(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role = 'some'
  )
  OR EXISTS (
    SELECT 1 FROM public.employee_master_data
    WHERE auth_user_id = _user_id 
      AND is_active = true
      AND job_title = 'SOME'
  )
$$;

-- Update is_owner_only to also check job_title
CREATE OR REPLACE FUNCTION public.is_owner_only(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = _user_id AND role = 'ejer'
  )
  OR EXISTS (
    SELECT 1 FROM public.employee_master_data
    WHERE auth_user_id = _user_id 
      AND is_active = true
      AND job_title = 'Ejer'
  )
$$;

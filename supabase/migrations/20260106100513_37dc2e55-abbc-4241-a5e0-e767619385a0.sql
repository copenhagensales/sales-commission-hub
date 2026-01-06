-- Drop the dangerous anon policy that exposes all employee data
DROP POLICY IF EXISTS "Public can view referrer by referral code" ON public.employee_master_data;

-- Create a secure view for public referral lookups with only necessary columns
CREATE OR REPLACE VIEW public.employee_referral_lookup 
WITH (security_invoker = true)
AS
SELECT 
  id,
  first_name,
  last_name,
  referral_code
FROM public.employee_master_data
WHERE is_active = true AND referral_code IS NOT NULL;

-- Grant access to the view for anon users
GRANT SELECT ON public.employee_referral_lookup TO anon;

-- Create RLS policy on the view's underlying table that allows anon to read through this specific view
-- Since views with security_invoker use the caller's permissions, we need a more targeted approach
-- Instead, let's create a security definer function for looking up referrers

CREATE OR REPLACE FUNCTION public.get_referrer_by_code(p_referral_code text)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  referral_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.first_name,
    e.last_name,
    e.referral_code
  FROM public.employee_master_data e
  WHERE e.referral_code = upper(p_referral_code)
    AND e.is_active = true;
END;
$$;

-- Grant execute on the function to anon
GRANT EXECUTE ON FUNCTION public.get_referrer_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_referrer_by_code(text) TO authenticated;
-- Drop the overly permissive policy that exposes all emails
DROP POLICY IF EXISTS "Anyone can read invitation with valid token" ON employee_invitations;

-- Create a security definer function to safely lookup invitation by token
-- This returns only the matching invitation without exposing the entire table
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE (
  id uuid,
  employee_id uuid,
  email text,
  status text,
  expires_at timestamptz,
  first_name text,
  last_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ei.id,
    ei.employee_id,
    ei.email,
    ei.status,
    ei.expires_at,
    emd.first_name,
    emd.last_name
  FROM employee_invitations ei
  LEFT JOIN employee_master_data emd ON emd.id = ei.employee_id
  WHERE ei.token = _token
  LIMIT 1
$$;
-- Add invitation status tracking to employee_master_data
ALTER TABLE public.employee_master_data 
ADD COLUMN IF NOT EXISTS invitation_status TEXT DEFAULT 'none' CHECK (invitation_status IN ('none', 'pending', 'completed'));

-- Add auth_user_id to link employee with auth.users
ALTER TABLE public.employee_master_data 
ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- Update employee_invitations to track both onboarding and password setup
ALTER TABLE public.employee_invitations
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMP WITH TIME ZONE;

-- Create function to get invitation by token (public, no auth needed)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token_v2(_token TEXT)
RETURNS TABLE (
  id UUID,
  employee_id UUID,
  email TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  first_name TEXT,
  last_name TEXT,
  cpr_number TEXT,
  address_street TEXT,
  address_postal_code TEXT,
  address_city TEXT,
  bank_reg_number TEXT,
  bank_account_number TEXT,
  onboarding_completed_at TIMESTAMPTZ,
  password_set_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.employee_id,
    i.email,
    i.status,
    i.expires_at,
    e.first_name,
    e.last_name,
    e.cpr_number,
    e.address_street,
    e.address_postal_code,
    e.address_city,
    e.bank_reg_number,
    e.bank_account_number,
    i.onboarding_completed_at,
    i.password_set_at
  FROM employee_invitations i
  JOIN employee_master_data e ON e.id = i.employee_id
  WHERE i.token = _token;
END;
$$;

-- Create function to complete onboarding (update employee data)
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  _token TEXT,
  _first_name TEXT,
  _last_name TEXT,
  _cpr_number TEXT,
  _address_street TEXT,
  _address_postal_code TEXT,
  _address_city TEXT,
  _bank_reg_number TEXT,
  _bank_account_number TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation RECORD;
  _result JSON;
BEGIN
  -- Get invitation
  SELECT * INTO _invitation FROM employee_invitations WHERE token = _token;
  
  IF _invitation IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;
  
  IF _invitation.expires_at < NOW() THEN
    RETURN json_build_object('success', false, 'error', 'Token expired');
  END IF;
  
  -- Update employee data
  UPDATE employee_master_data SET
    first_name = _first_name,
    last_name = _last_name,
    cpr_number = _cpr_number,
    address_street = _address_street,
    address_postal_code = _address_postal_code,
    address_city = _address_city,
    address_country = 'Danmark',
    bank_reg_number = _bank_reg_number,
    bank_account_number = _bank_account_number,
    updated_at = NOW()
  WHERE id = _invitation.employee_id;
  
  -- Mark onboarding as completed
  UPDATE employee_invitations SET
    onboarding_completed_at = NOW()
  WHERE id = _invitation.id;
  
  RETURN json_build_object('success', true, 'employee_id', _invitation.employee_id);
END;
$$;

-- Create function to mark password as set
CREATE OR REPLACE FUNCTION public.complete_invitation_password(
  _token TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation RECORD;
BEGIN
  -- Get invitation
  SELECT * INTO _invitation FROM employee_invitations WHERE token = _token;
  
  IF _invitation IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;
  
  -- Mark password as set and invitation as completed
  UPDATE employee_invitations SET
    password_set_at = NOW(),
    status = 'completed',
    completed_at = NOW()
  WHERE id = _invitation.id;
  
  -- Update employee invitation status
  UPDATE employee_master_data SET
    invitation_status = 'completed'
  WHERE id = _invitation.employee_id;
  
  RETURN json_build_object('success', true);
END;
$$;
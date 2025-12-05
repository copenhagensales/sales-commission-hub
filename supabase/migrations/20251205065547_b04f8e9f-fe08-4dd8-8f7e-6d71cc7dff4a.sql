-- Create new role enum for the updated permission system
CREATE TYPE public.system_role AS ENUM ('medarbejder', 'teamleder', 'ejer');

-- Create system_roles table to store user role assignments
CREATE TABLE public.system_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role system_role NOT NULL DEFAULT 'medarbejder',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.system_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS system_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.system_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Check if user is owner
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
$$;

-- Check if user is teamleder or higher
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
$$;

-- Get employee_id for current user based on email
CREATE OR REPLACE FUNCTION public.get_employee_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employee_master_data 
  WHERE private_email = (SELECT email FROM auth.users WHERE id = _user_id)
  LIMIT 1
$$;

-- Check if an employee is in user's team (for teamleders)
CREATE OR REPLACE FUNCTION public.is_in_my_team(_employee_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employee_master_data
    WHERE id = _employee_id 
    AND manager_id = public.get_employee_id_for_user(_user_id)
  )
$$;

-- RLS policies for system_roles table
CREATE POLICY "Owners can manage all roles"
ON public.system_roles
FOR ALL
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Users can view their own role"
ON public.system_roles
FOR SELECT
USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_system_roles_updated_at
BEFORE UPDATE ON public.system_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
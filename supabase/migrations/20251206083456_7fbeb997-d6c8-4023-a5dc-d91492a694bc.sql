-- Create enum for team change wish
CREATE TYPE public.team_change_wish AS ENUM ('yes', 'no');

-- Create enum for leadership interest
CREATE TYPE public.leadership_interest AS ENUM ('yes', 'maybe', 'no');

-- Create enum for leadership role type
CREATE TYPE public.leadership_role_type AS ENUM ('junior_teamleder', 'teamleder', 'coach', 'other');

-- Create career wishes table
CREATE TABLE public.career_wishes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  wants_team_change public.team_change_wish NOT NULL,
  desired_team TEXT,
  team_change_motivation TEXT,
  leadership_interest public.leadership_interest NOT NULL,
  leadership_role_type public.leadership_role_type,
  leadership_motivation TEXT,
  other_comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.career_wishes ENABLE ROW LEVEL SECURITY;

-- Employees can insert their own wishes
CREATE POLICY "Employees can insert own career wishes"
ON public.career_wishes
FOR INSERT
TO authenticated
WITH CHECK (employee_id = public.get_current_employee_id());

-- Employees can view their own wishes
CREATE POLICY "Employees can view own career wishes"
ON public.career_wishes
FOR SELECT
TO authenticated
USING (employee_id = public.get_current_employee_id());

-- Teamledere and above can view all career wishes
CREATE POLICY "Teamledere can view all career wishes"
ON public.career_wishes
FOR SELECT
TO authenticated
USING (public.is_teamleder_or_above(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_career_wishes_updated_at
BEFORE UPDATE ON public.career_wishes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
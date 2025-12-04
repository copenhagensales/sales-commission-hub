-- Create enum for salary type
CREATE TYPE public.salary_type AS ENUM ('provision', 'fixed', 'hourly');

-- Create enum for vacation type
CREATE TYPE public.vacation_type AS ENUM ('vacation_pay', 'vacation_bonus');

-- Create employee_master_data table for comprehensive employee records
CREATE TABLE public.employee_master_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Identity
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  cpr_number TEXT, -- Sensitive field, encrypted/restricted access
  
  -- Contact
  address_street TEXT,
  address_postal_code TEXT,
  address_city TEXT,
  address_country TEXT DEFAULT 'Danmark',
  private_phone TEXT,
  private_email TEXT,
  
  -- Employment
  employment_start_date DATE,
  employment_end_date DATE,
  job_title TEXT,
  department TEXT,
  work_location TEXT,
  manager_id UUID REFERENCES public.employee_master_data(id),
  contract_id TEXT,
  contract_version TEXT,
  
  -- Salary (sensitive)
  salary_type salary_type DEFAULT 'provision',
  salary_amount NUMERIC,
  bank_reg_number TEXT,
  bank_account_number TEXT,
  
  -- System role
  system_role_id UUID REFERENCES public.user_roles(id),
  
  -- Vacation
  vacation_type vacation_type DEFAULT 'vacation_pay',
  vacation_bonus_percent NUMERIC DEFAULT 1,
  
  -- Employee-paid arrangements
  has_parking BOOLEAN DEFAULT false,
  parking_spot_id TEXT,
  parking_monthly_cost NUMERIC,
  
  -- Working hours
  working_hours_model TEXT,
  weekly_hours NUMERIC,
  standard_start_time TIME,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_master_data ENABLE ROW LEVEL SECURITY;

-- Create index for common lookups
CREATE INDEX idx_employee_master_data_active ON public.employee_master_data(is_active);
CREATE INDEX idx_employee_master_data_department ON public.employee_master_data(department);

-- RLS Policies
-- Only managers/admins can view all employee data
CREATE POLICY "Managers can view all employee data"
ON public.employee_master_data
FOR SELECT
USING (is_manager_or_above(auth.uid()));

-- Only managers/admins can manage employee data
CREATE POLICY "Managers can manage employee data"
ON public.employee_master_data
FOR ALL
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_employee_master_data_updated_at
BEFORE UPDATE ON public.employee_master_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
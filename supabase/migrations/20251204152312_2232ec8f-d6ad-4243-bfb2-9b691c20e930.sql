-- Create master employee table
CREATE TABLE public.master_employee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  primary_email text,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure primary_email is unique when present
ALTER TABLE public.master_employee
ADD CONSTRAINT master_employee_primary_email_key UNIQUE (primary_email);

-- Create employee identity mapping table
CREATE TABLE public.employee_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_employee_id uuid NOT NULL REFERENCES public.master_employee(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_employee_id text NOT NULL,
  source_email text,
  source_name text,
  created_at timestamptz DEFAULT now()
);

-- Ensure each source employee is only mapped once per source system
ALTER TABLE public.employee_identity
ADD CONSTRAINT employee_identity_source_uniq UNIQUE (source, source_employee_id);

CREATE INDEX idx_employee_identity_master_employee_id
  ON public.employee_identity(master_employee_id);

-- Enable RLS
ALTER TABLE public.master_employee ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_identity ENABLE ROW LEVEL SECURITY;

-- RLS policies for master_employee
CREATE POLICY "Authenticated users can view master_employee"
ON public.master_employee
FOR SELECT
USING (true);

CREATE POLICY "Managers can manage master_employee"
ON public.master_employee
FOR ALL
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

-- RLS policies for employee_identity
CREATE POLICY "Authenticated users can view employee_identity"
ON public.employee_identity
FOR SELECT
USING (true);

CREATE POLICY "Managers can manage employee_identity"
ON public.employee_identity
FOR ALL
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));
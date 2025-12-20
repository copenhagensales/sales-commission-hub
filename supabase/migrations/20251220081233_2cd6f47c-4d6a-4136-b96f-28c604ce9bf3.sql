-- Add freelance consultant fields to employee_master_data
ALTER TABLE public.employee_master_data
ADD COLUMN is_freelance_consultant boolean DEFAULT false,
ADD COLUMN freelance_company_name text,
ADD COLUMN freelance_cvr text,
ADD COLUMN freelance_company_address text;
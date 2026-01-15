-- Create salary_types table
CREATE TABLE public.salary_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.salary_types ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view salary types
CREATE POLICY "Authenticated users can view salary types"
ON public.salary_types
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert salary types
CREATE POLICY "Authenticated users can insert salary types"
ON public.salary_types
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update salary types
CREATE POLICY "Authenticated users can update salary types"
ON public.salary_types
FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to delete salary types
CREATE POLICY "Authenticated users can delete salary types"
ON public.salary_types
FOR DELETE
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_salary_types_updated_at
BEFORE UPDATE ON public.salary_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
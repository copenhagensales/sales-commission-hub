-- Create table for storing employee dashboard designs
CREATE TABLE public.employee_dashboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Mit Dashboard',
  design_id TEXT DEFAULT 'minimal',
  widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.employee_dashboards ENABLE ROW LEVEL SECURITY;

-- Create policy: Employees can view their own dashboards
CREATE POLICY "Employees can view their own dashboards"
ON public.employee_dashboards
FOR SELECT
USING (employee_id IN (
  SELECT id FROM public.employee_master_data 
  WHERE auth_user_id = auth.uid()
));

-- Create policy: Employees can create their own dashboards
CREATE POLICY "Employees can create their own dashboards"
ON public.employee_dashboards
FOR INSERT
WITH CHECK (employee_id IN (
  SELECT id FROM public.employee_master_data 
  WHERE auth_user_id = auth.uid()
));

-- Create policy: Employees can update their own dashboards
CREATE POLICY "Employees can update their own dashboards"
ON public.employee_dashboards
FOR UPDATE
USING (employee_id IN (
  SELECT id FROM public.employee_master_data 
  WHERE auth_user_id = auth.uid()
));

-- Create policy: Employees can delete their own dashboards
CREATE POLICY "Employees can delete their own dashboards"
ON public.employee_dashboards
FOR DELETE
USING (employee_id IN (
  SELECT id FROM public.employee_master_data 
  WHERE auth_user_id = auth.uid()
));

-- Create index for faster lookups
CREATE INDEX idx_employee_dashboards_employee_id ON public.employee_dashboards(employee_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_employee_dashboards_updated_at
BEFORE UPDATE ON public.employee_dashboards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
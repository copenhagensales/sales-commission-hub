-- Create positions table
CREATE TABLE public.positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view positions"
  ON public.positions FOR SELECT
  USING (true);

CREATE POLICY "Owners can manage positions"
  ON public.positions FOR ALL
  USING (is_owner(auth.uid()))
  WITH CHECK (is_owner(auth.uid()));

-- Add position_id column to employee_master_data
ALTER TABLE public.employee_master_data 
  ADD COLUMN position_id UUID REFERENCES public.positions(id);

-- Insert existing positions from current job_titles
INSERT INTO public.positions (name, sort_order)
SELECT DISTINCT job_title, ROW_NUMBER() OVER (ORDER BY job_title)
FROM public.employee_master_data 
WHERE job_title IS NOT NULL AND job_title != ''
ON CONFLICT (name) DO NOTHING;

-- Update employees with their position_id based on current job_title
UPDATE public.employee_master_data e
SET position_id = p.id
FROM public.positions p
WHERE e.job_title = p.name;

-- Create trigger to update updated_at
CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON public.positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
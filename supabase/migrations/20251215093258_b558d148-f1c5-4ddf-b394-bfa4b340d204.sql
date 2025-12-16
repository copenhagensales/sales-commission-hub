-- Create closing_shifts table for tracking who closes the office each day
CREATE TABLE public.closing_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  weekday INTEGER NOT NULL CHECK (weekday >= 1 AND weekday <= 5), -- 1=Monday, 5=Friday
  employee_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(weekday)
);

-- Enable RLS
ALTER TABLE public.closing_shifts ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can view closing shifts"
ON public.closing_shifts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers can manage closing shifts"
ON public.closing_shifts FOR ALL
TO authenticated
USING (public.is_teamleder_or_above(auth.uid()))
WITH CHECK (public.is_teamleder_or_above(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_closing_shifts_updated_at
BEFORE UPDATE ON public.closing_shifts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default rows for each weekday
INSERT INTO public.closing_shifts (weekday) VALUES (1), (2), (3), (4), (5);
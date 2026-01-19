-- Create booking_diet table for tracking diet allowances per employee per day
CREATE TABLE public.booking_diet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.booking(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  salary_type_id UUID NOT NULL REFERENCES public.salary_types(id),
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(booking_id, employee_id, date)
);

-- Enable RLS
ALTER TABLE public.booking_diet ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users can manage diets
CREATE POLICY "Authenticated users can read diets" 
  ON public.booking_diet FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert diets" 
  ON public.booking_diet FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update diets" 
  ON public.booking_diet FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete diets" 
  ON public.booking_diet FOR DELETE TO authenticated USING (true);

-- Add index for faster lookups
CREATE INDEX idx_booking_diet_booking_id ON public.booking_diet(booking_id);
CREATE INDEX idx_booking_diet_employee_id ON public.booking_diet(employee_id);

CREATE TABLE public.booking_startup_bonus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.booking(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  salary_type_id UUID NOT NULL REFERENCES public.salary_types(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.employee_master_data(id)
);

ALTER TABLE public.booking_startup_bonus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read booking_startup_bonus"
  ON public.booking_startup_bonus FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert booking_startup_bonus"
  ON public.booking_startup_bonus FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update booking_startup_bonus"
  ON public.booking_startup_bonus FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete booking_startup_bonus"
  ON public.booking_startup_bonus FOR DELETE TO authenticated USING (true);

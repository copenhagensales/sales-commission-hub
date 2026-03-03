
CREATE TABLE public.vehicle_return_confirmation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_vehicle_id UUID REFERENCES public.booking_vehicle(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES public.employee_master_data(id) NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  vehicle_name TEXT,
  booking_date DATE
);

ALTER TABLE public.vehicle_return_confirmation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert own confirmations"
ON public.vehicle_return_confirmation
FOR INSERT
TO authenticated
WITH CHECK (employee_id = public.get_current_employee_id());

CREATE POLICY "Authenticated users can select own confirmations"
ON public.vehicle_return_confirmation
FOR SELECT
TO authenticated
USING (employee_id = public.get_current_employee_id());

CREATE POLICY "FM leaders can view all confirmations"
ON public.vehicle_return_confirmation
FOR SELECT
TO authenticated
USING (public.is_fieldmarketing_leder(auth.uid()));

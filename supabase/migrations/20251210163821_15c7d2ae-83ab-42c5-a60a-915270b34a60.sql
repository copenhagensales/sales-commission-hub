-- Add market application fields to booking table
ALTER TABLE public.booking 
ADD COLUMN IF NOT EXISTS open_for_applications boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS application_deadline date,
ADD COLUMN IF NOT EXISTS visible_from date;

-- Create market application status enum
CREATE TYPE public.market_application_status AS ENUM ('pending', 'approved', 'rejected');

-- Create market_application table for employee applications
CREATE TABLE public.market_application (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.booking(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  status public.market_application_status NOT NULL DEFAULT 'pending',
  applied_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid REFERENCES public.employee_master_data(id),
  note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(booking_id, employee_id)
);

-- Create booking_vehicle table for vehicle assignments (prevents double-booking)
CREATE TABLE public.booking_vehicle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.booking(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicle(id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(vehicle_id, date) -- Prevents same vehicle being booked twice on same day
);

-- Enable RLS on new tables
ALTER TABLE public.market_application ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_vehicle ENABLE ROW LEVEL SECURITY;

-- RLS policies for market_application
CREATE POLICY "Employees can view their own applications"
ON public.market_application FOR SELECT
USING (employee_id = get_current_employee_id());

CREATE POLICY "Employees can create applications for open bookings"
ON public.market_application FOR INSERT
WITH CHECK (
  employee_id = get_current_employee_id()
  AND EXISTS (
    SELECT 1 FROM public.booking b
    WHERE b.id = booking_id
    AND b.open_for_applications = true
    AND (b.visible_from IS NULL OR b.visible_from <= CURRENT_DATE)
    AND (b.application_deadline IS NULL OR b.application_deadline >= CURRENT_DATE)
  )
);

CREATE POLICY "Teamledere can view all applications"
ON public.market_application FOR SELECT
USING (is_teamleder_or_above(auth.uid()));

CREATE POLICY "Teamledere can manage applications"
ON public.market_application FOR ALL
USING (is_teamleder_or_above(auth.uid()))
WITH CHECK (is_teamleder_or_above(auth.uid()));

-- RLS policies for booking_vehicle
CREATE POLICY "All authenticated can view booking vehicles"
ON public.booking_vehicle FOR SELECT
USING (true);

CREATE POLICY "Teamledere can manage booking vehicles"
ON public.booking_vehicle FOR ALL
USING (is_teamleder_or_above(auth.uid()))
WITH CHECK (is_teamleder_or_above(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_market_application_booking ON public.market_application(booking_id);
CREATE INDEX idx_market_application_employee ON public.market_application(employee_id);
CREATE INDEX idx_market_application_status ON public.market_application(status);
CREATE INDEX idx_booking_vehicle_date ON public.booking_vehicle(date);
CREATE INDEX idx_booking_vehicle_vehicle ON public.booking_vehicle(vehicle_id);

-- Enable realtime for market_application (for notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_application;
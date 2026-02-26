
-- Hotel registry table
CREATE TABLE public.hotel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  address text,
  phone text,
  email text,
  notes text,
  times_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hotel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view hotels"
  ON public.hotel FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can insert hotels"
  ON public.hotel FOR INSERT TO authenticated
  WITH CHECK (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "Managers can update hotels"
  ON public.hotel FOR UPDATE TO authenticated
  USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "Managers can delete hotels"
  ON public.hotel FOR DELETE TO authenticated
  USING (public.is_teamleder_or_above(auth.uid()));

-- Booking-hotel junction table
CREATE TABLE public.booking_hotel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.booking(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotel(id) ON DELETE RESTRICT,
  check_in date NOT NULL,
  check_out date NOT NULL,
  rooms integer NOT NULL DEFAULT 1,
  confirmation_number text,
  status text NOT NULL DEFAULT 'pending',
  price_per_night numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_hotel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view booking_hotel"
  ON public.booking_hotel FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can insert booking_hotel"
  ON public.booking_hotel FOR INSERT TO authenticated
  WITH CHECK (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "Managers can update booking_hotel"
  ON public.booking_hotel FOR UPDATE TO authenticated
  USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "Managers can delete booking_hotel"
  ON public.booking_hotel FOR DELETE TO authenticated
  USING (public.is_teamleder_or_above(auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_booking_hotel_booking_id ON public.booking_hotel(booking_id);
CREATE INDEX idx_booking_hotel_hotel_id ON public.booking_hotel(hotel_id);
CREATE INDEX idx_hotel_city ON public.hotel(city);

-- Function to auto-increment times_used on hotel when a booking_hotel is inserted
CREATE OR REPLACE FUNCTION public.increment_hotel_times_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.hotel SET times_used = times_used + 1 WHERE id = NEW.hotel_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_increment_hotel_usage
  AFTER INSERT ON public.booking_hotel
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_hotel_times_used();

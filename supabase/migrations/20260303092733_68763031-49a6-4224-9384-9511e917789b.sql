
-- Add booking_id and vehicle_id columns to vehicle_return_confirmation
ALTER TABLE public.vehicle_return_confirmation
  ADD COLUMN booking_id UUID REFERENCES public.booking(id),
  ADD COLUMN vehicle_id UUID REFERENCES public.vehicle(id);

-- Add unique constraint to prevent duplicate confirmations per booking+vehicle+date
ALTER TABLE public.vehicle_return_confirmation
  ADD CONSTRAINT uq_vehicle_return_booking_vehicle_date UNIQUE (booking_id, vehicle_id, booking_date);

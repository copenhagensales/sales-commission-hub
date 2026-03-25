ALTER TABLE public.vehicle_return_confirmation
  DROP CONSTRAINT IF EXISTS vehicle_return_confirmation_booking_id_fkey,
  ADD CONSTRAINT vehicle_return_confirmation_booking_id_fkey
    FOREIGN KEY (booking_id) REFERENCES public.booking(id) ON DELETE CASCADE;
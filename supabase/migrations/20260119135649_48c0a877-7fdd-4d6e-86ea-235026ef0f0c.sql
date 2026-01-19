-- Fjern status-kolonnen fra booking-tabellen
ALTER TABLE public.booking DROP COLUMN IF EXISTS status;

-- Fjern booking_status enum typen
DROP TYPE IF EXISTS public.booking_status;
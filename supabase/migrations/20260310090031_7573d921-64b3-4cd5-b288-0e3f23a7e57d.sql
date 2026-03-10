
ALTER TABLE public.booking ADD COLUMN status text NOT NULL DEFAULT 'draft';

-- Set all existing bookings to confirmed so they remain visible/billable
UPDATE public.booking SET status = 'confirmed';

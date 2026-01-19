-- Add daily_rate_override column to booking table
ALTER TABLE public.booking
ADD COLUMN daily_rate_override numeric DEFAULT NULL;

COMMENT ON COLUMN public.booking.daily_rate_override IS 'Overskriver lokationens standard dagspris for denne specifikke booking. NULL betyder brug lokationens pris.';
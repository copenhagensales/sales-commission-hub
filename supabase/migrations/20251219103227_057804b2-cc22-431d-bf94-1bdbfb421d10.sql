-- Change default status from 'Planlagt' to 'Bekræftet'
ALTER TABLE public.booking 
ALTER COLUMN status SET DEFAULT 'Bekræftet'::booking_status;
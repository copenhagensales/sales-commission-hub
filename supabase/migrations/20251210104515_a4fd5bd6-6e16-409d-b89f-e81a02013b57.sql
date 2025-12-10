-- Add booked_days column to store specific selected days (0=Monday, 1=Tuesday, etc.)
ALTER TABLE public.booking 
ADD COLUMN booked_days integer[] DEFAULT ARRAY[0,1,2,3,4];
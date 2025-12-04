-- Add unique constraint to prevent duplicate employee assignments on the same booking and date
ALTER TABLE public.booking_assignment
ADD CONSTRAINT booking_assignment_unique_employee_booking_date 
UNIQUE (booking_id, employee_id, date);
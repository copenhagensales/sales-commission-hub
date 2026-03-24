
ALTER TABLE public.booking_diet DROP CONSTRAINT IF EXISTS booking_diet_booking_id_employee_id_date_key;
ALTER TABLE public.booking_diet ADD CONSTRAINT booking_diet_booking_id_employee_id_date_salary_type_key UNIQUE (booking_id, employee_id, date, salary_type_id);

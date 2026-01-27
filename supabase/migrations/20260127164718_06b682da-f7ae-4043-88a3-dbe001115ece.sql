-- Trin 1: Fjern eksisterende dubletter (behold den ældste per medarbejder/dato)
DELETE FROM public.booking_assignment a
WHERE a.id NOT IN (
  SELECT (array_agg(id ORDER BY created_at ASC))[1]
  FROM public.booking_assignment
  GROUP BY employee_id, date
);

-- Trin 2: Tilføj unik constraint på employee_id + date
ALTER TABLE public.booking_assignment
ADD CONSTRAINT booking_assignment_unique_employee_date 
UNIQUE (employee_id, date);
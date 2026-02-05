-- Add hours_source column to personnel_salaries for per-employee configuration
ALTER TABLE personnel_salaries 
ADD COLUMN hours_source TEXT DEFAULT 'shift' 
CHECK (hours_source IN ('shift', 'timestamp'));

-- Set Alfred Rud and William Hoé Seiding to use timestamps
UPDATE personnel_salaries 
SET hours_source = 'timestamp' 
WHERE employee_id IN (
  'f66edb4c-7649-4617-94a3-ba02b7aea02f',  -- Alfred Rud
  '712e71af-bcc4-4988-b525-2d32f53b69b1'   -- William Hoé Seiding
)
AND salary_type = 'staff'
AND is_active = true;

-- Jeppe Buster Munk will remain 'shift' (default)
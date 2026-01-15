-- Add system_role_key column to job_positions
ALTER TABLE job_positions 
ADD COLUMN system_role_key TEXT REFERENCES system_role_definitions(key);

-- Migrate existing positions to roles
UPDATE job_positions SET system_role_key = 'ejer' WHERE LOWER(name) = 'ejer';
UPDATE job_positions SET system_role_key = 'teamleder' 
  WHERE LOWER(name) IN ('teamleder', 'fieldmarketing leder', 'assisterende teamleder');
UPDATE job_positions SET system_role_key = 'medarbejder' 
  WHERE LOWER(name) IN ('salgskonsulent', 'fieldmarketing', 'backoffice');
UPDATE job_positions SET system_role_key = 'rekruttering' WHERE LOWER(name) = 'rekruttering';
UPDATE job_positions SET system_role_key = 'some' WHERE LOWER(name) = 'some';
-- Add system_role column to positions table
ALTER TABLE positions ADD COLUMN IF NOT EXISTS system_role text;

-- Map existing positions to their system roles
UPDATE positions SET system_role = 'ejer' WHERE LOWER(name) = 'ejer';
UPDATE positions SET system_role = 'teamleder' WHERE LOWER(name) IN ('teamleder', 'assisterende teamleder', 'fieldmarketing leder');
UPDATE positions SET system_role = 'rekruttering' WHERE LOWER(name) = 'rekruttering';
UPDATE positions SET system_role = 'some' WHERE LOWER(name) = 'some';
UPDATE positions SET system_role = 'medarbejder' WHERE system_role IS NULL;
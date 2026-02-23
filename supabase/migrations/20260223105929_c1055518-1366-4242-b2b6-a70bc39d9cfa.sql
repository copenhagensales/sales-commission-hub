-- Backfill eksisterende NULL-rækker til 'pending'
UPDATE sales SET validation_status = 'pending' WHERE validation_status IS NULL;

-- Sæt default så fremtidige rækker aldrig er NULL
ALTER TABLE sales ALTER COLUMN validation_status SET DEFAULT 'pending';
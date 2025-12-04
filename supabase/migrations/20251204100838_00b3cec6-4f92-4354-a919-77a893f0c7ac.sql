-- Drop the foreign key constraint on employee.id to auth.users
ALTER TABLE public.employee DROP CONSTRAINT IF EXISTS employee_id_fkey;

-- Make id auto-generated with gen_random_uuid() as default
ALTER TABLE public.employee ALTER COLUMN id SET DEFAULT gen_random_uuid();
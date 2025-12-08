-- Drop the old unique constraint on user_id only
ALTER TABLE public.system_roles DROP CONSTRAINT IF EXISTS system_roles_user_id_key;

-- Add new unique constraint on (user_id, role) combination to allow multiple roles per user
ALTER TABLE public.system_roles ADD CONSTRAINT system_roles_user_id_role_key UNIQUE (user_id, role);
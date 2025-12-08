-- Add permission_type column to distinguish between grants and denials
ALTER TABLE public.user_menu_permissions 
ADD COLUMN permission_type text NOT NULL DEFAULT 'grant' 
CHECK (permission_type IN ('grant', 'deny'));

-- Add comment for clarity
COMMENT ON COLUMN public.user_menu_permissions.permission_type IS 'grant = user gets access, deny = user is explicitly blocked from access';
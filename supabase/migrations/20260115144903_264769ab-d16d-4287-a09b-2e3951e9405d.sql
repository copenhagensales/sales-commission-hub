-- Add parent_key and permission_type to role_page_permissions for hierarchical structure
ALTER TABLE public.role_page_permissions 
ADD COLUMN IF NOT EXISTS parent_key TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS permission_type TEXT DEFAULT 'page' CHECK (permission_type IN ('page', 'tab', 'action'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_role_page_permissions_parent_key ON public.role_page_permissions(parent_key);

-- Add a comment explaining the structure
COMMENT ON COLUMN public.role_page_permissions.parent_key IS 'Reference to parent permission_key for tabs/actions belonging to a page';
COMMENT ON COLUMN public.role_page_permissions.permission_type IS 'Type of permission: page (main menu), tab (sub-tab), action (button/operation)';
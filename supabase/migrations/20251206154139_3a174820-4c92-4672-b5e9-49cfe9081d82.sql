-- Create table for individual user menu permissions (additions beyond role)
CREATE TABLE public.user_menu_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id, menu_item_id)
);

-- Enable RLS
ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;

-- Only owners can manage permissions
CREATE POLICY "Owners can manage user menu permissions"
ON public.user_menu_permissions
FOR ALL
USING (is_owner(auth.uid()))
WITH CHECK (is_owner(auth.uid()));

-- Users can view their own permissions
CREATE POLICY "Users can view their own menu permissions"
ON public.user_menu_permissions
FOR SELECT
USING (user_id = auth.uid());

-- Add index for fast lookups
CREATE INDEX idx_user_menu_permissions_user_id ON public.user_menu_permissions(user_id);
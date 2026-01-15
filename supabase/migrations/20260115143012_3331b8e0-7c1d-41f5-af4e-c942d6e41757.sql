-- Create role_page_permissions table to replace JSONB permissions
CREATE TABLE IF NOT EXISTS public.role_page_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL REFERENCES public.system_role_definitions(key) ON DELETE CASCADE,
  permission_key text NOT NULL,
  can_view boolean DEFAULT false,
  can_edit boolean DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(role_key, permission_key)
);

-- Enable RLS
ALTER TABLE public.role_page_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies - all authenticated users can read
CREATE POLICY "Anyone can read role_page_permissions"
  ON public.role_page_permissions FOR SELECT
  TO authenticated
  USING (true);

-- Only owners can modify
CREATE POLICY "Owners can manage role_page_permissions"
  ON public.role_page_permissions FOR ALL
  TO authenticated
  USING (public.is_owner(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_role_page_permissions_updated_at
  BEFORE UPDATE ON public.role_page_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
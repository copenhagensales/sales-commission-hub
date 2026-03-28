
-- Create data_retention_policies table
CREATE TABLE public.data_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type text NOT NULL UNIQUE,
  display_name text NOT NULL,
  retention_days integer,
  is_active boolean NOT NULL DEFAULT false,
  cleanup_mode text NOT NULL DEFAULT 'delete_all',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

-- RLS policies: same pattern as campaign_retention_policies
CREATE POLICY "Owners and managers can view data retention policies"
  ON public.data_retention_policies FOR SELECT TO authenticated
  USING (public.is_owner(auth.uid()) OR public.is_manager_position(auth.uid()));

CREATE POLICY "Owners and managers can insert data retention policies"
  ON public.data_retention_policies FOR INSERT TO authenticated
  WITH CHECK (public.is_owner(auth.uid()) OR public.is_manager_position(auth.uid()));

CREATE POLICY "Owners and managers can update data retention policies"
  ON public.data_retention_policies FOR UPDATE TO authenticated
  USING (public.is_owner(auth.uid()) OR public.is_manager_position(auth.uid()));

-- Seed customer_inquiries row
INSERT INTO public.data_retention_policies (data_type, display_name, cleanup_mode)
VALUES ('customer_inquiries', 'Kundehenvendelser', 'delete_all');

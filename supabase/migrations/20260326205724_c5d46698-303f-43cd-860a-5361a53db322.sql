
-- Create access control table
CREATE TABLE public.system_feedback_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employee_master_data(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id)
);

ALTER TABLE public.system_feedback_access ENABLE ROW LEVEL SECURITY;

-- All authenticated can read (needed for sidebar check)
CREATE POLICY "Authenticated users can read access list"
  ON public.system_feedback_access
  FOR SELECT TO authenticated
  USING (true);

-- Only owners can manage access
CREATE POLICY "Owners can insert access"
  ON public.system_feedback_access
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Owners can delete access"
  ON public.system_feedback_access
  FOR DELETE TO authenticated
  USING (public.is_owner(auth.uid()));

-- Update insert policy on system_feedback to restrict to access list + owners
DROP POLICY IF EXISTS "Authenticated users can insert own feedback" ON public.system_feedback;

CREATE POLICY "Users with access can insert feedback"
  ON public.system_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.system_feedback_access sfa
      JOIN public.employee_master_data emd ON emd.id = sfa.employee_id
      WHERE emd.auth_user_id = auth.uid()
    )
  );

-- Add admin_response column for visible replies to submitters
ALTER TABLE public.system_feedback ADD COLUMN IF NOT EXISTS admin_response text;

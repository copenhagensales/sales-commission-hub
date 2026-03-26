
-- System feedback table
CREATE TABLE public.system_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid REFERENCES public.employee_master_data(id) ON DELETE SET NULL,
  affected_employee_name text,
  category text NOT NULL DEFAULT 'bug',
  priority text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  description text,
  system_area text,
  screenshot_url text,
  status text NOT NULL DEFAULT 'new',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_feedback ENABLE ROW LEVEL SECURITY;

-- All authenticated users can insert
CREATE POLICY "Authenticated users can insert feedback"
  ON public.system_feedback FOR INSERT TO authenticated
  WITH CHECK (true);

-- Users can read their own feedback
CREATE POLICY "Users can read own feedback"
  ON public.system_feedback FOR SELECT TO authenticated
  USING (
    submitted_by = (SELECT id FROM public.employee_master_data WHERE auth_user_id = auth.uid() LIMIT 1)
    OR public.is_owner(auth.uid())
    OR public.is_teamleder_or_above(auth.uid())
  );

-- Only owners can update (change status, add notes)
CREATE POLICY "Owners can update feedback"
  ON public.system_feedback FOR UPDATE TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

-- Storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('feedback-screenshots', 'feedback-screenshots', true);

-- Allow authenticated users to upload screenshots
CREATE POLICY "Authenticated users can upload feedback screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'feedback-screenshots');

-- Public read access for screenshots
CREATE POLICY "Public read access for feedback screenshots"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'feedback-screenshots');

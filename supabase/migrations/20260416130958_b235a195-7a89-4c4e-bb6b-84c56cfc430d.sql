
CREATE TABLE public.system_feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES public.system_feedback(id) ON DELETE CASCADE,
  author_employee_id UUID REFERENCES public.employee_master_data(id),
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_feedback_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on own feedback"
  ON public.system_feedback_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.system_feedback sf
      WHERE sf.id = feedback_id AND sf.submitted_by = (
        SELECT emd.id FROM public.employee_master_data emd
        WHERE emd.auth_user_id = auth.uid() LIMIT 1
      )
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Authenticated users can insert comments"
  ON public.system_feedback_comments FOR INSERT TO authenticated
  WITH CHECK (true);

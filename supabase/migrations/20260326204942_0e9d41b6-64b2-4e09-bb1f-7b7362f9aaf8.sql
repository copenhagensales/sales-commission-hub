
CREATE TABLE public.system_feedback_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employee_master_data(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id)
);

ALTER TABLE public.system_feedback_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read recipients"
  ON public.system_feedback_recipients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage recipients"
  ON public.system_feedback_recipients FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

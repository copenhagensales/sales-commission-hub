
CREATE TABLE public.compliance_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(employee_id)
);

ALTER TABLE public.compliance_notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage compliance recipients"
  ON public.compliance_notification_recipients FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

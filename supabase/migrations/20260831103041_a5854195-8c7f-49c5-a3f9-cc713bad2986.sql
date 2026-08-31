CREATE OR REPLACE FUNCTION public.can_edit_report_templates(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_owner(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.employee_master_data e
      WHERE e.auth_user_id = _user_id
        AND e.is_active = true
        AND lower(coalesce(e.work_email, '')) IN (
          'fk@copenhagensales.dk',
          'anni@copenhagensales.dk'
        )
    )
    OR EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = _user_id
        AND lower(coalesce(u.email, '')) IN (
          'fk@copenhagensales.dk',
          'filipkirketerp@gmail.com',
          'anni@copenhagensales.dk',
          'sondergaardannika@gmail.com'
        )
    )
$$;

GRANT EXECUTE ON FUNCTION public.can_edit_report_templates(uuid) TO authenticated;

CREATE TABLE public.report_text_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  body text NOT NULL,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.report_text_templates TO authenticated;
GRANT ALL ON public.report_text_templates TO service_role;

ALTER TABLE public.report_text_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active employees can read report templates"
  ON public.report_text_templates
  FOR SELECT
  TO authenticated
  USING (public.is_active_employee(auth.uid()));

CREATE POLICY "Template editors can insert report templates"
  ON public.report_text_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_report_templates(auth.uid()));

CREATE POLICY "Template editors can update report templates"
  ON public.report_text_templates
  FOR UPDATE
  TO authenticated
  USING (public.can_edit_report_templates(auth.uid()))
  WITH CHECK (public.can_edit_report_templates(auth.uid()));

CREATE TRIGGER update_report_text_templates_updated_at
  BEFORE UPDATE ON public.report_text_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.report_text_templates (key, body)
VALUES (
  'tryg_cancel_meeting',
  E'Hej Tryg,\n\nVil i annullerer mødet på [Telefonnummer].'
)
ON CONFLICT (key) DO NOTHING;
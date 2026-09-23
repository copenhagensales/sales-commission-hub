CREATE TABLE public.ramp_feedback_exclusion (
  employee_id uuid PRIMARY KEY REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  reason text,
  excluded_by uuid REFERENCES public.employee_master_data(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ramp_feedback_exclusion TO authenticated;
GRANT ALL ON public.ramp_feedback_exclusion TO service_role;

ALTER TABLE public.ramp_feedback_exclusion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ramp leaders can view feedback exclusions"
ON public.ramp_feedback_exclusion FOR SELECT TO authenticated
USING (public.can_view_ramp_team());

CREATE POLICY "Ramp leaders can add feedback exclusions"
ON public.ramp_feedback_exclusion FOR INSERT TO authenticated
WITH CHECK (public.can_view_ramp_team());

CREATE POLICY "Ramp leaders can update feedback exclusions"
ON public.ramp_feedback_exclusion FOR UPDATE TO authenticated
USING (public.can_view_ramp_team()) WITH CHECK (public.can_view_ramp_team());

CREATE POLICY "Ramp leaders can remove feedback exclusions"
ON public.ramp_feedback_exclusion FOR DELETE TO authenticated
USING (public.can_view_ramp_team());

CREATE TRIGGER update_ramp_feedback_exclusion_updated_at
BEFORE UPDATE ON public.ramp_feedback_exclusion
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
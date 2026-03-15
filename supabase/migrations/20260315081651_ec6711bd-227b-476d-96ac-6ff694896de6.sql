
CREATE TABLE public.pulse_survey_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES public.pulse_surveys(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES public.employee_master_data(id) ON DELETE CASCADE NOT NULL,
  dismissed_until timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(survey_id, employee_id)
);

ALTER TABLE public.pulse_survey_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own dismissals"
  ON public.pulse_survey_dismissals
  FOR SELECT TO authenticated
  USING (employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE lower(private_email) = lower(auth.email()) 
       OR lower(work_email) = lower(auth.email())
  ));

CREATE POLICY "Users can insert own dismissals"
  ON public.pulse_survey_dismissals
  FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE lower(private_email) = lower(auth.email()) 
       OR lower(work_email) = lower(auth.email())
  ));

CREATE POLICY "Users can update own dismissals"
  ON public.pulse_survey_dismissals
  FOR UPDATE TO authenticated
  USING (employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE lower(private_email) = lower(auth.email()) 
       OR lower(work_email) = lower(auth.email())
  ))
  WITH CHECK (employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE lower(private_email) = lower(auth.email()) 
       OR lower(work_email) = lower(auth.email())
  ));

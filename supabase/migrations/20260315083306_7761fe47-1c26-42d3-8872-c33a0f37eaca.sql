
-- Create pulse_survey_drafts table
CREATE TABLE public.pulse_survey_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES public.pulse_surveys(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  draft_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (survey_id, employee_id)
);

-- Enable RLS
ALTER TABLE public.pulse_survey_drafts ENABLE ROW LEVEL SECURITY;

-- RLS: employees can read their own drafts
CREATE POLICY "Employees can read own drafts"
ON public.pulse_survey_drafts
FOR SELECT
TO authenticated
USING (employee_id = public.get_current_employee_id());

-- RLS: employees can insert their own drafts
CREATE POLICY "Employees can insert own drafts"
ON public.pulse_survey_drafts
FOR INSERT
TO authenticated
WITH CHECK (employee_id = public.get_current_employee_id());

-- RLS: employees can update their own drafts
CREATE POLICY "Employees can update own drafts"
ON public.pulse_survey_drafts
FOR UPDATE
TO authenticated
USING (employee_id = public.get_current_employee_id());

-- RLS: employees can delete their own drafts
CREATE POLICY "Employees can delete own drafts"
ON public.pulse_survey_drafts
FOR DELETE
TO authenticated
USING (employee_id = public.get_current_employee_id());

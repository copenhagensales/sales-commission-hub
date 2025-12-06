-- Create pulse survey tables

-- Table for monthly survey instances
CREATE TABLE public.pulse_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(year, month)
);

-- Table for anonymous survey responses
CREATE TABLE public.pulse_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.pulse_surveys(id) ON DELETE CASCADE,
  department TEXT, -- Team/department for aggregation, stored without personal identifier
  
  -- Question responses
  nps_score INTEGER NOT NULL CHECK (nps_score BETWEEN 1 AND 10),
  nps_comment TEXT,
  tenure TEXT NOT NULL CHECK (tenure IN ('under_1_month', '1_3_months', '3_6_months', 'over_6_months')),
  development_score INTEGER NOT NULL CHECK (development_score BETWEEN 1 AND 10),
  leadership_score INTEGER NOT NULL CHECK (leadership_score BETWEEN 1 AND 10),
  recognition_score INTEGER NOT NULL CHECK (recognition_score BETWEEN 1 AND 10),
  energy_score INTEGER NOT NULL CHECK (energy_score BETWEEN 1 AND 10),
  seriousness_score INTEGER NOT NULL CHECK (seriousness_score BETWEEN 1 AND 10),
  leader_availability_score INTEGER NOT NULL CHECK (leader_availability_score BETWEEN 1 AND 10),
  wellbeing_score INTEGER NOT NULL CHECK (wellbeing_score BETWEEN 1 AND 10),
  psychological_safety_score INTEGER NOT NULL CHECK (psychological_safety_score BETWEEN 1 AND 10),
  improvement_suggestions TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to track who has completed the survey (separate from responses for anonymity)
CREATE TABLE public.pulse_survey_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.pulse_surveys(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(survey_id, employee_id)
);

-- Enable RLS
ALTER TABLE public.pulse_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pulse_survey_completions ENABLE ROW LEVEL SECURITY;

-- Policies for pulse_surveys
CREATE POLICY "Everyone can view active surveys"
ON public.pulse_surveys
FOR SELECT
USING (true);

CREATE POLICY "Managers can manage surveys"
ON public.pulse_surveys
FOR ALL
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

-- Policies for pulse_survey_responses (anonymous - only managers can view aggregated)
CREATE POLICY "Anyone can insert responses"
ON public.pulse_survey_responses
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Managers can view responses for reporting"
ON public.pulse_survey_responses
FOR SELECT
USING (is_manager_or_above(auth.uid()));

-- Policies for pulse_survey_completions
CREATE POLICY "Employees can view own completions"
ON public.pulse_survey_completions
FOR SELECT
USING (employee_id = get_current_employee_id());

CREATE POLICY "Anyone can insert completions"
ON public.pulse_survey_completions
FOR INSERT
WITH CHECK (employee_id = get_current_employee_id());

CREATE POLICY "Managers can view all completions"
ON public.pulse_survey_completions
FOR SELECT
USING (is_manager_or_above(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_pulse_surveys_year_month ON public.pulse_surveys(year, month);
CREATE INDEX idx_pulse_survey_responses_survey_id ON public.pulse_survey_responses(survey_id);
CREATE INDEX idx_pulse_survey_responses_department ON public.pulse_survey_responses(department);
CREATE INDEX idx_pulse_survey_completions_survey_id ON public.pulse_survey_completions(survey_id);
CREATE INDEX idx_pulse_survey_completions_employee_id ON public.pulse_survey_completions(employee_id);
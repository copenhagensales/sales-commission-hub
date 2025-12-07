
-- Create applications table for tracking candidate applications
CREATE TABLE public.applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ny_ansoegning',
  application_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline DATE,
  next_step TEXT,
  source TEXT,
  team_id UUID REFERENCES public.teams(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sub_teams table
CREATE TABLE public.sub_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  team_id UUID REFERENCES public.teams(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create communication_logs table for SMS/Email/Call tracking
CREATE TABLE public.communication_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sms', 'email', 'call')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT,
  outcome TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  twilio_sid TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sms_templates table
CREATE TABLE public.sms_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  template_key TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  template_key TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recruitment_employees table (separate from main employee system)
CREATE TABLE public.recruitment_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  team_id UUID REFERENCES public.teams(id),
  sub_team TEXT,
  hired_date DATE,
  deadline DATE,
  employment_ended_date DATE,
  employment_end_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create revenue_data table for employee performance tracking
CREATE TABLE public.revenue_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recruitment_employee_id UUID NOT NULL REFERENCES public.recruitment_employees(id) ON DELETE CASCADE,
  period INTEGER NOT NULL CHECK (period IN (30, 60, 90)),
  revenue NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create performance_reviews table
CREATE TABLE public.performance_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recruitment_employee_id UUID NOT NULL REFERENCES public.recruitment_employees(id) ON DELETE CASCADE,
  review_period INTEGER NOT NULL,
  rating TEXT NOT NULL,
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

-- RLS policies for applications
CREATE POLICY "Rekruttering and owners can manage applications"
ON public.applications FOR ALL
USING (is_owner(auth.uid()) OR is_rekruttering(auth.uid()));

CREATE POLICY "Teamledere can view applications"
ON public.applications FOR SELECT
USING (is_teamleder_or_above(auth.uid()));

-- RLS policies for sub_teams
CREATE POLICY "Rekruttering and owners can manage sub_teams"
ON public.sub_teams FOR ALL
USING (is_owner(auth.uid()) OR is_rekruttering(auth.uid()));

CREATE POLICY "Authenticated users can view sub_teams"
ON public.sub_teams FOR SELECT
USING (true);

-- RLS policies for communication_logs
CREATE POLICY "Rekruttering and owners can manage communication_logs"
ON public.communication_logs FOR ALL
USING (is_owner(auth.uid()) OR is_rekruttering(auth.uid()));

CREATE POLICY "Teamledere can view communication_logs"
ON public.communication_logs FOR SELECT
USING (is_teamleder_or_above(auth.uid()));

-- RLS policies for sms_templates
CREATE POLICY "Rekruttering and owners can manage sms_templates"
ON public.sms_templates FOR ALL
USING (is_owner(auth.uid()) OR is_rekruttering(auth.uid()));

CREATE POLICY "Authenticated users can view sms_templates"
ON public.sms_templates FOR SELECT
USING (true);

-- RLS policies for email_templates
CREATE POLICY "Rekruttering and owners can manage email_templates"
ON public.email_templates FOR ALL
USING (is_owner(auth.uid()) OR is_rekruttering(auth.uid()));

CREATE POLICY "Authenticated users can view email_templates"
ON public.email_templates FOR SELECT
USING (true);

-- RLS policies for recruitment_employees
CREATE POLICY "Rekruttering and owners can manage recruitment_employees"
ON public.recruitment_employees FOR ALL
USING (is_owner(auth.uid()) OR is_rekruttering(auth.uid()));

CREATE POLICY "Teamledere can view recruitment_employees"
ON public.recruitment_employees FOR SELECT
USING (is_teamleder_or_above(auth.uid()));

-- RLS policies for revenue_data
CREATE POLICY "Rekruttering and owners can manage revenue_data"
ON public.revenue_data FOR ALL
USING (is_owner(auth.uid()) OR is_rekruttering(auth.uid()));

CREATE POLICY "Teamledere can view revenue_data"
ON public.revenue_data FOR SELECT
USING (is_teamleder_or_above(auth.uid()));

-- RLS policies for performance_reviews
CREATE POLICY "Rekruttering and owners can manage performance_reviews"
ON public.performance_reviews FOR ALL
USING (is_owner(auth.uid()) OR is_rekruttering(auth.uid()));

CREATE POLICY "Teamledere can view performance_reviews"
ON public.performance_reviews FOR SELECT
USING (is_teamleder_or_above(auth.uid()));

-- Create indexes
CREATE INDEX idx_applications_candidate_id ON public.applications(candidate_id);
CREATE INDEX idx_applications_status ON public.applications(status);
CREATE INDEX idx_communication_logs_application_id ON public.communication_logs(application_id);
CREATE INDEX idx_communication_logs_direction ON public.communication_logs(direction);
CREATE INDEX idx_recruitment_employees_candidate_id ON public.recruitment_employees(candidate_id);

-- Create updated_at triggers
CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_templates_updated_at
  BEFORE UPDATE ON public.sms_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recruitment_employees_updated_at
  BEFORE UPDATE ON public.recruitment_employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_logs;

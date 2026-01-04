
-- Table for deactivation reminder configuration
CREATE TABLE public.deactivation_reminder_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  recipients text NOT NULL DEFAULT '',
  email_subject text NOT NULL DEFAULT 'Medarbejder deaktiveret - Handling påkrævet',
  email_body text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(team_id)
);

-- Table for tracking sent deactivation reminders
CREATE TABLE public.deactivation_reminders_sent (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  initial_sent_at timestamp with time zone NOT NULL DEFAULT now(),
  followup_sent_at timestamp with time zone,
  recipients text[] NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deactivation_reminder_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deactivation_reminders_sent ENABLE ROW LEVEL SECURITY;

-- RLS policies using existing helper functions
CREATE POLICY "Authenticated can view deactivation config" ON public.deactivation_reminder_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage deactivation config" ON public.deactivation_reminder_config
  FOR ALL TO authenticated USING (public.is_owner(auth.uid()));

CREATE POLICY "Authenticated can view sent reminders" ON public.deactivation_reminders_sent
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage sent reminders" ON public.deactivation_reminders_sent
  FOR ALL TO authenticated USING (public.is_owner(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_deactivation_reminder_config_updated_at
  BEFORE UPDATE ON public.deactivation_reminder_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

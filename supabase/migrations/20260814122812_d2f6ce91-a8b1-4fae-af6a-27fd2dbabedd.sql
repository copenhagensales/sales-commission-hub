-- Central settings for deactivation notifications (replaces hardcoded recipient logic)
CREATE TABLE public.deactivation_notification_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_singleton boolean NOT NULL DEFAULT true UNIQUE CHECK (is_singleton),
  is_enabled boolean NOT NULL DEFAULT true,
  include_team_leaders boolean NOT NULL DEFAULT true,
  include_assistant_leaders boolean NOT NULL DEFAULT true,
  include_owners boolean NOT NULL DEFAULT true,
  include_recruitment boolean NOT NULL DEFAULT true,
  recipient_job_titles text[] NOT NULL DEFAULT '{}',
  extra_recipients text[] NOT NULL DEFAULT '{}',
  excluded_emails text[] NOT NULL DEFAULT '{}',
  followup_enabled boolean NOT NULL DEFAULT true,
  followup_delay_hours integer NOT NULL DEFAULT 24,
  followup_exclude_owners boolean NOT NULL DEFAULT true,
  email_subject text NOT NULL DEFAULT 'Medarbejder deaktiveret - Handling påkrævet',
  email_body text NOT NULL DEFAULT 'Kære modtager,

En medarbejder er blevet deaktiveret i systemet.

Medarbejder: {{employee_name}}
Team: {{team_name}}
Email: {{employee_email}}
Dato: {{deactivation_date}}
Deaktiveret af: {{actor_name}}

Venligst sørg for at følgende opgaver udføres:
- Fjern adgange til systemer
- Opdater relevante lister
- Informer relevante parter

Med venlig hilsen,
CPH Sales System',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.deactivation_notification_settings TO authenticated;
GRANT ALL ON public.deactivation_notification_settings TO service_role;
ALTER TABLE public.deactivation_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees can view deactivation notification settings"
ON public.deactivation_notification_settings FOR SELECT TO authenticated
USING (public.is_active_employee(auth.uid()));

CREATE POLICY "Owners can insert deactivation notification settings"
ON public.deactivation_notification_settings FOR INSERT TO authenticated
WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Owners can update deactivation notification settings"
ON public.deactivation_notification_settings FOR UPDATE TO authenticated
USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

GRANT INSERT, UPDATE ON public.deactivation_notification_settings TO authenticated;

INSERT INTO public.deactivation_notification_settings (is_singleton) VALUES (true);

CREATE TRIGGER trg_deactivation_notification_settings_updated_at
BEFORE UPDATE ON public.deactivation_notification_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit fields on the existing send log
ALTER TABLE public.deactivation_reminders_sent
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS triggered_by uuid,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
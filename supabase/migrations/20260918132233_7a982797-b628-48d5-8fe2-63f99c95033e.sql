-- Ugentlig mødebook-rapport (Tryg): kun aggregerede tal, ingen lead-data.

CREATE TABLE public.lead_closing_statuses (
  status text PRIMARY KEY,
  is_closing boolean NOT NULL DEFAULT true,
  label_da text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lead_closing_statuses TO authenticated;
GRANT ALL ON public.lead_closing_statuses TO service_role;
ALTER TABLE public.lead_closing_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_closing_statuses_view" ON public.lead_closing_statuses
  FOR SELECT TO authenticated USING (public.effective_is_teamleder_or_above());
CREATE POLICY "lead_closing_statuses_manage" ON public.lead_closing_statuses
  FOR ALL TO authenticated
  USING (public.effective_is_owner() OR public.effective_is_superadmin())
  WITH CHECK (public.effective_is_owner() OR public.effective_is_superadmin());

CREATE TABLE public.weekly_lead_report_lines (
  report_line text PRIMARY KEY,
  sort_order integer NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.weekly_lead_report_lines TO authenticated;
GRANT ALL ON public.weekly_lead_report_lines TO service_role;
ALTER TABLE public.weekly_lead_report_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_lead_report_lines_view" ON public.weekly_lead_report_lines
  FOR SELECT TO authenticated USING (public.effective_is_teamleder_or_above());
CREATE POLICY "weekly_lead_report_lines_manage" ON public.weekly_lead_report_lines
  FOR ALL TO authenticated
  USING (public.effective_is_owner() OR public.effective_is_superadmin())
  WITH CHECK (public.effective_is_owner() OR public.effective_is_superadmin());

CREATE TABLE public.weekly_lead_report_campaign_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account text NOT NULL CHECK (account IN ('main','lederne')),
  adversus_campaign_id text NOT NULL,
  adversus_campaign_name text,
  report_line text REFERENCES public.weekly_lead_report_lines(report_line) ON UPDATE CASCADE,
  is_confirmed boolean NOT NULL DEFAULT false,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account, adversus_campaign_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_lead_report_campaign_map TO authenticated;
GRANT ALL ON public.weekly_lead_report_campaign_map TO service_role;
ALTER TABLE public.weekly_lead_report_campaign_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_lead_report_campaign_map_view" ON public.weekly_lead_report_campaign_map
  FOR SELECT TO authenticated USING (public.effective_is_teamleder_or_above());
CREATE POLICY "weekly_lead_report_campaign_map_manage" ON public.weekly_lead_report_campaign_map
  FOR ALL TO authenticated
  USING (public.effective_is_owner() OR public.effective_is_superadmin())
  WITH CHECK (public.effective_is_owner() OR public.effective_is_superadmin());

CREATE TABLE public.weekly_lead_closure_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  account text NOT NULL CHECK (account IN ('main','lederne')),
  adversus_campaign_id text NOT NULL,
  report_line text,
  agent_reference text NOT NULL,
  status text NOT NULL,
  lead_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_start, account, adversus_campaign_id, agent_reference, status)
);
CREATE INDEX weekly_lead_closure_stats_week_idx
  ON public.weekly_lead_closure_stats (week_start, account);
GRANT SELECT ON public.weekly_lead_closure_stats TO authenticated;
GRANT ALL ON public.weekly_lead_closure_stats TO service_role;
ALTER TABLE public.weekly_lead_closure_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_lead_closure_stats_view" ON public.weekly_lead_closure_stats
  FOR SELECT TO authenticated USING (public.effective_is_teamleder_or_above());

CREATE TABLE public.weekly_lead_closure_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  account text,
  campaigns_scanned integer NOT NULL DEFAULT 0,
  leads_scanned integer NOT NULL DEFAULT 0,
  weeks_covered integer NOT NULL DEFAULT 0,
  mail_sent boolean NOT NULL DEFAULT false,
  triggered_by text,
  error text
);
CREATE INDEX weekly_lead_closure_runs_started_idx
  ON public.weekly_lead_closure_runs (started_at DESC);
GRANT SELECT ON public.weekly_lead_closure_runs TO authenticated;
GRANT ALL ON public.weekly_lead_closure_runs TO service_role;
ALTER TABLE public.weekly_lead_closure_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_lead_closure_runs_view" ON public.weekly_lead_closure_runs
  FOR SELECT TO authenticated USING (public.effective_is_teamleder_or_above());

CREATE TABLE public.weekly_lead_closure_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.weekly_lead_closure_settings TO authenticated;
GRANT ALL ON public.weekly_lead_closure_settings TO service_role;
ALTER TABLE public.weekly_lead_closure_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_lead_closure_settings_view" ON public.weekly_lead_closure_settings
  FOR SELECT TO authenticated USING (public.effective_is_teamleder_or_above());
CREATE POLICY "weekly_lead_closure_settings_manage" ON public.weekly_lead_closure_settings
  FOR ALL TO authenticated
  USING (public.effective_is_owner() OR public.effective_is_superadmin())
  WITH CHECK (public.effective_is_owner() OR public.effective_is_superadmin());

CREATE TRIGGER lead_closing_statuses_updated_at
  BEFORE UPDATE ON public.lead_closing_statuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER weekly_lead_report_campaign_map_updated_at
  BEFORE UPDATE ON public.weekly_lead_report_campaign_map
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER weekly_lead_closure_stats_updated_at
  BEFORE UPDATE ON public.weekly_lead_closure_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER weekly_lead_closure_settings_updated_at
  BEFORE UPDATE ON public.weekly_lead_closure_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
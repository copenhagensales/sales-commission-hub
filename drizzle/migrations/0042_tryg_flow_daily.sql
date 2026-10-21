CREATE TABLE public.weekly_lead_flow_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  account text NOT NULL,
  adversus_campaign_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('received','closed')),
  agent_reference text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  lead_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (day, account, adversus_campaign_id, kind, agent_reference, status)
);
COMMENT ON TABLE public.weekly_lead_flow_daily IS 'Tryg leveringsstatus: kun antal pr. dag/kampagne. received = emner oprettet (lead.created), closed = samme status og saelgerfilter som weekly_lead_closure_stats, men pr. dag. Ingen lead-data.';
CREATE INDEX weekly_lead_flow_daily_day_idx ON public.weekly_lead_flow_daily (day);
GRANT SELECT ON public.weekly_lead_flow_daily TO authenticated;
GRANT ALL ON public.weekly_lead_flow_daily TO service_role;
ALTER TABLE public.weekly_lead_flow_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY weekly_lead_flow_daily_view ON public.weekly_lead_flow_daily
  FOR SELECT TO authenticated USING (public.effective_is_teamleder_or_above());
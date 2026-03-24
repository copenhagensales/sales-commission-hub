
CREATE TABLE public.fm_agent_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_db_pct numeric NOT NULL DEFAULT 30,
  seller_cost_pct numeric NOT NULL DEFAULT 12.5,
  data_window_weeks integer NOT NULL DEFAULT 12,
  min_observations integer NOT NULL DEFAULT 5,
  business_context text DEFAULT '',
  focus_priority text NOT NULL DEFAULT 'profitability',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.fm_agent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read fm_agent_settings"
  ON public.fm_agent_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update fm_agent_settings"
  ON public.fm_agent_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can insert fm_agent_settings"
  ON public.fm_agent_settings FOR INSERT TO authenticated WITH CHECK (true);

-- Insert singleton default row
INSERT INTO public.fm_agent_settings (target_db_pct, seller_cost_pct, data_window_weeks, min_observations, business_context, focus_priority)
VALUES (30, 12.5, 12, 5, '', 'profitability');

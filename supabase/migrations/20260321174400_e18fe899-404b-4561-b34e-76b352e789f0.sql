
-- Ramp profiles: how fast new hires reach full productivity
CREATE TABLE public.forecast_ramp_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_campaign_id uuid REFERENCES public.client_campaigns(id),
  day_1_7_factor numeric DEFAULT 0.15,
  day_8_14_factor numeric DEFAULT 0.35,
  day_15_30_factor numeric DEFAULT 0.60,
  day_31_60_factor numeric DEFAULT 0.85,
  steady_state_factor numeric DEFAULT 1.0,
  created_at timestamptz DEFAULT now()
);

-- Survival/churn profiles per campaign
CREATE TABLE public.forecast_survival_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_campaign_id uuid REFERENCES public.client_campaigns(id),
  survival_day_7 numeric DEFAULT 0.90,
  survival_day_14 numeric DEFAULT 0.82,
  survival_day_30 numeric DEFAULT 0.72,
  survival_day_60 numeric DEFAULT 0.65,
  created_at timestamptz DEFAULT now()
);

-- Forecast cohorts (manually added new starter groups)
CREATE TABLE public.client_forecast_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) NOT NULL,
  client_campaign_id uuid REFERENCES public.client_campaigns(id),
  start_date date NOT NULL,
  planned_headcount int NOT NULL DEFAULT 5,
  ramp_profile_id uuid REFERENCES public.forecast_ramp_profiles(id),
  survival_profile_id uuid REFERENCES public.forecast_survival_profiles(id),
  note text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Stored forecast snapshots
CREATE TABLE public.client_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) NOT NULL,
  client_campaign_id uuid REFERENCES public.client_campaigns(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  forecast_sales_low int,
  forecast_sales_expected int,
  forecast_sales_high int,
  forecast_hours numeric,
  forecast_heads numeric,
  churn_loss numeric,
  absence_loss numeric,
  drivers_json jsonb DEFAULT '{}',
  calculated_at timestamptz DEFAULT now()
);

ALTER TABLE public.forecast_ramp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_survival_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_forecast_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage ramp profiles" ON public.forecast_ramp_profiles
  FOR ALL TO authenticated USING (
    public.is_owner(auth.uid()) OR public.is_teamleder_or_above(auth.uid())
  );
CREATE POLICY "Managers can manage survival profiles" ON public.forecast_survival_profiles
  FOR ALL TO authenticated USING (
    public.is_owner(auth.uid()) OR public.is_teamleder_or_above(auth.uid())
  );
CREATE POLICY "Managers can manage forecast cohorts" ON public.client_forecast_cohorts
  FOR ALL TO authenticated USING (
    public.is_owner(auth.uid()) OR public.is_teamleder_or_above(auth.uid())
  );
CREATE POLICY "Managers can view forecasts" ON public.client_forecasts
  FOR ALL TO authenticated USING (
    public.is_owner(auth.uid()) OR public.is_teamleder_or_above(auth.uid())
  );

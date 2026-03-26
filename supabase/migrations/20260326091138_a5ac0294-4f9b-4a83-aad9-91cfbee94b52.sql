
CREATE TABLE public.forecast_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  month int NOT NULL CHECK (month >= 1 AND month <= 12),
  year int NOT NULL CHECK (year >= 2020 AND year <= 2100),
  client_goal int NOT NULL DEFAULT 0,
  sick_pct numeric NOT NULL DEFAULT 0,
  vacation_pct numeric NOT NULL DEFAULT 0,
  churn_new_pct numeric NOT NULL DEFAULT 0,
  churn_established_pct numeric NOT NULL DEFAULT 0,
  new_seller_weekly_target numeric NOT NULL DEFAULT 0,
  new_seller_threshold int NOT NULL DEFAULT 20,
  rolling_avg_shifts int NOT NULL DEFAULT 10,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, month, year)
);

ALTER TABLE public.forecast_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read forecast_settings"
  ON public.forecast_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert forecast_settings"
  ON public.forecast_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update forecast_settings"
  ON public.forecast_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete forecast_settings"
  ON public.forecast_settings FOR DELETE
  TO authenticated
  USING (true);

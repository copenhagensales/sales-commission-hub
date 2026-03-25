CREATE TABLE public.fm_weekly_forecast_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  year integer NOT NULL,
  override_sales integer,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, week_number, year)
);
ALTER TABLE public.fm_weekly_forecast_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth can manage fm weekly overrides"
  ON public.fm_weekly_forecast_overrides FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
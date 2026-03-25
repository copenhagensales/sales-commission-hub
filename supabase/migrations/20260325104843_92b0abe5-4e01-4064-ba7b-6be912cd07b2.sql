CREATE TABLE public.employee_forecast_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employee_master_data(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  override_sales integer NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, client_id, period_start)
);

ALTER TABLE public.employee_forecast_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage overrides"
  ON public.employee_forecast_overrides FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TABLE public.league_talent_exclusions (
  employee_id uuid PRIMARY KEY REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.league_talent_exclusions TO authenticated;
GRANT ALL ON public.league_talent_exclusions TO service_role;
ALTER TABLE public.league_talent_exclusions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read talent exclusions" ON public.league_talent_exclusions FOR SELECT TO authenticated USING (true);

-- 1. Powerdag events
CREATE TABLE public.powerdag_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.powerdag_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read powerdag_events"
  ON public.powerdag_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage powerdag_events"
  ON public.powerdag_events FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

-- 2. Powerdag point rules
CREATE TABLE public.powerdag_point_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.powerdag_events(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  sub_client_name text,
  points_per_sale numeric(6,2) NOT NULL DEFAULT 1.0,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.powerdag_point_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read powerdag_point_rules"
  ON public.powerdag_point_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can manage powerdag_point_rules"
  ON public.powerdag_point_rules FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

-- 3. Powerdag scores (manual input)
CREATE TABLE public.powerdag_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.powerdag_events(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.powerdag_point_rules(id) ON DELETE CASCADE,
  sales_count int NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, rule_id)
);

ALTER TABLE public.powerdag_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read powerdag_scores"
  ON public.powerdag_scores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can upsert powerdag_scores"
  ON public.powerdag_scores FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update powerdag_scores"
  ON public.powerdag_scores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime for scores
ALTER PUBLICATION supabase_realtime ADD TABLE public.powerdag_scores;

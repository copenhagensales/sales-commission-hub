
-- Allow anonymous (TV board) read access to powerdag tables
CREATE POLICY "Anon can read powerdag_events"
  ON public.powerdag_events FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can read powerdag_point_rules"
  ON public.powerdag_point_rules FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can read powerdag_scores"
  ON public.powerdag_scores FOR SELECT TO anon USING (true);

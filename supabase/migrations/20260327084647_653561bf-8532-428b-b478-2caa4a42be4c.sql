CREATE POLICY "Authenticated users with input access can update point rules"
  ON public.powerdag_point_rules FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can read eesy fm powerbi files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'eesy-fm-powerbi');

CREATE POLICY "Managers can upload eesy fm powerbi files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'eesy-fm-powerbi' AND public.is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can update eesy fm powerbi files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'eesy-fm-powerbi' AND public.is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can delete eesy fm powerbi files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'eesy-fm-powerbi' AND public.is_manager_or_above(auth.uid()));
CREATE POLICY "Owners can delete imports"
  ON public.economic_imports
  FOR DELETE
  USING (is_owner(auth.uid()));
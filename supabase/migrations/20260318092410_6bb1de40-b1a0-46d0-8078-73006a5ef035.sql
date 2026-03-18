CREATE POLICY "Teamledere can delete candidates"
ON public.candidates
FOR DELETE
TO authenticated
USING (is_teamleder_or_above(auth.uid()));
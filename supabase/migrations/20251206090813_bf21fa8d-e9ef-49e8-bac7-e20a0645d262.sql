-- Add reviewed status fields to career_wishes
ALTER TABLE public.career_wishes
ADD COLUMN reviewed_at timestamp with time zone,
ADD COLUMN reviewed_by uuid REFERENCES auth.users(id);

-- Allow managers and rekruttering to update career wishes (mark as reviewed)
CREATE POLICY "Managers and rekruttering can update career wishes"
ON public.career_wishes
FOR UPDATE
USING (is_teamleder_or_above(auth.uid()) OR is_rekruttering(auth.uid()))
WITH CHECK (is_teamleder_or_above(auth.uid()) OR is_rekruttering(auth.uid()));
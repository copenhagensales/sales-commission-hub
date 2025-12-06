-- Drop the existing policy for teamledere
DROP POLICY IF EXISTS "Teamledere can view all career wishes" ON public.career_wishes;

-- Create new policy that includes ejer and rekruttering
CREATE POLICY "Managers and rekruttering can view all career wishes" 
ON public.career_wishes 
FOR SELECT 
USING (
  is_teamleder_or_above(auth.uid()) OR is_rekruttering(auth.uid())
);
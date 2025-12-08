-- Add policy for rekruttering role to manage content_items
CREATE POLICY "Rekruttering can manage content_items" 
ON public.content_items 
FOR ALL 
USING (is_rekruttering(auth.uid()))
WITH CHECK (is_rekruttering(auth.uid()));
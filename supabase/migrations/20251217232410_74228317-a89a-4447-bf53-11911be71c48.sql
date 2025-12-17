-- Drop restrictive policy and allow all authenticated users to view products
DROP POLICY IF EXISTS "Only managers can view products" ON public.products;

CREATE POLICY "Authenticated users can view products" 
ON public.products 
FOR SELECT 
USING (true);
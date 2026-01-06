-- Fix critical RLS vulnerability on sales table
-- Drop the misconfigured policy that allows ALL authenticated users full access
DROP POLICY IF EXISTS "Managers can manage sales" ON public.sales;

-- The existing "Managers can view sales" policy with is_manager_or_above() is correct for SELECT
-- We just need to add proper policies for INSERT, UPDATE, DELETE

-- Only managers can insert sales
CREATE POLICY "Managers can insert sales"
ON public.sales
FOR INSERT
TO authenticated
WITH CHECK (is_manager_or_above(auth.uid()));

-- Only managers can update sales
CREATE POLICY "Managers can update sales"
ON public.sales
FOR UPDATE
TO authenticated
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

-- Only managers can delete sales
CREATE POLICY "Managers can delete sales"
ON public.sales
FOR DELETE
TO authenticated
USING (is_manager_or_above(auth.uid()));

-- Fix sale_items table as well
-- First check existing policies and fix them
DROP POLICY IF EXISTS "Managers can manage sale items" ON public.sale_items;

-- Only managers can view sale items
CREATE POLICY "Managers can view sale_items"
ON public.sale_items
FOR SELECT
TO authenticated
USING (is_manager_or_above(auth.uid()));

-- Only managers can insert sale items
CREATE POLICY "Managers can insert sale_items"
ON public.sale_items
FOR INSERT
TO authenticated
WITH CHECK (is_manager_or_above(auth.uid()));

-- Only managers can update sale items
CREATE POLICY "Managers can update sale_items"
ON public.sale_items
FOR UPDATE
TO authenticated
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

-- Only managers can delete sale items
CREATE POLICY "Managers can delete sale_items"
ON public.sale_items
FOR DELETE
TO authenticated
USING (is_manager_or_above(auth.uid()));
-- Drop the existing policy that restricts delete
DROP POLICY IF EXISTS "Rekruttering and owners can manage communication_logs" ON public.communication_logs;

-- Create new more permissive policies for delete operations
-- Allow authenticated users to delete communication_logs
CREATE POLICY "Authenticated users can delete communication_logs"
ON public.communication_logs
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Keep the insert/update for rekruttering
CREATE POLICY "Authenticated users can insert communication_logs"
ON public.communication_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update communication_logs"
ON public.communication_logs
FOR UPDATE
USING (auth.uid() IS NOT NULL);
-- Add RLS policy for kpi_definitions to allow authenticated users to read
CREATE POLICY "Allow authenticated users to read kpi_definitions"
ON public.kpi_definitions
FOR SELECT
TO authenticated
USING (true);
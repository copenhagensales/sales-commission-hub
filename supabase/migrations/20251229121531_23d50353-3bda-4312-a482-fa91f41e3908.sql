-- Add policy for authenticated users to view candidates
CREATE POLICY "Authenticated users can view candidates"
ON public.candidates
FOR SELECT
TO authenticated
USING (true);

-- Add policy for authenticated users to view applications  
CREATE POLICY "Authenticated users can view applications"
ON public.applications
FOR SELECT
TO authenticated
USING (true);

-- Add policy for authenticated users to view communication_logs
CREATE POLICY "Authenticated users can view communication_logs"
ON public.communication_logs
FOR SELECT
TO authenticated
USING (true);
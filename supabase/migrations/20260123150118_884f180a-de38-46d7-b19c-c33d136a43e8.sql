-- Allow public read access to KPI cached values for TV boards
-- This data is aggregated (sales counts, commissions) - not sensitive PII

-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "Authenticated users can read cached KPI values" ON kpi_cached_values;

-- Create public read policy
CREATE POLICY "Anyone can view cached KPI values"
ON kpi_cached_values FOR SELECT
TO public
USING (true);
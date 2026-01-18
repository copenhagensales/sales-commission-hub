-- Create function to get distinct cached KPI slugs (bypasses 1000 row limit)
CREATE OR REPLACE FUNCTION public.get_distinct_cached_kpi_slugs()
RETURNS TABLE(kpi_slug text) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT kpi_slug FROM kpi_cached_values ORDER BY kpi_slug;
$$;
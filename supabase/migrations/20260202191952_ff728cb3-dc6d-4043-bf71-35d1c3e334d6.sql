-- Create function to get distinct sales sources efficiently
CREATE OR REPLACE FUNCTION get_distinct_sales_sources()
RETURNS TABLE(source text) 
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT s.source 
  FROM sales s 
  WHERE s.source IS NOT NULL 
  ORDER BY s.source;
$$;
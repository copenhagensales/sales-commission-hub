
CREATE OR REPLACE FUNCTION public.search_sales(search_query text, max_results int DEFAULT 200)
RETURNS SETOF uuid AS $$
BEGIN
  RETURN QUERY
  SELECT s.id FROM sales s
  WHERE
    s.agent_name ILIKE '%' || search_query || '%'
    OR s.agent_email ILIKE '%' || search_query || '%'
    OR s.customer_phone ILIKE '%' || search_query || '%'
    OR s.customer_company ILIKE '%' || search_query || '%'
    OR s.internal_reference ILIKE '%' || search_query || '%'
    OR s.raw_payload::text ILIKE '%' || search_query || '%'
  ORDER BY s.sale_datetime DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public';

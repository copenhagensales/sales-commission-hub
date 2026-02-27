CREATE OR REPLACE FUNCTION public.get_sales_without_items_count(p_since timestamptz)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)
  FROM sales s
  LEFT JOIN sale_items si ON si.sale_id = s.id
  WHERE s.sale_datetime >= p_since
    AND si.id IS NULL;
$$;
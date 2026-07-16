CREATE OR REPLACE FUNCTION public.get_monthly_revenue(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(month_start date, revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT date_trunc('month', s.sale_datetime)::date AS month_start,
         COALESCE(SUM(si.mapped_revenue), 0)::numeric AS revenue
  FROM sales s
  JOIN sale_items si ON si.sale_id = s.id
  WHERE s.sale_datetime >= p_start
    AND s.sale_datetime < p_end
    AND COALESCE(s.validation_status, 'approved') != 'rejected'
  GROUP BY 1
  ORDER BY 1;
$$;
-- Create optimized function to get personal daily commission
-- Uses SECURITY DEFINER to bypass RLS for performance
CREATE OR REPLACE FUNCTION public.get_personal_daily_commission(
  p_employee_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  sale_date DATE,
  commission NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(s.sale_datetime) as sale_date,
    COALESCE(SUM(si.mapped_commission), 0) as commission
  FROM sale_items si
  INNER JOIN sales s ON s.id = si.sale_id
  INNER JOIN employee_agent_mapping eam ON eam.employee_id = p_employee_id
  INNER JOIN agents a ON a.id = eam.agent_id
  WHERE LOWER(s.agent_email) = LOWER(a.email)
    AND DATE(s.sale_datetime) BETWEEN p_start_date AND p_end_date
    AND (s.status IS NULL OR s.status != 'rejected')
  GROUP BY DATE(s.sale_datetime)
  ORDER BY sale_date;
END;
$$;

-- Add index to improve query performance
CREATE INDEX IF NOT EXISTS idx_sales_agent_email_lower_datetime 
ON sales (LOWER(agent_email), sale_datetime);
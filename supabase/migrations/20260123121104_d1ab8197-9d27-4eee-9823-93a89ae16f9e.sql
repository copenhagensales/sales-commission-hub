-- Create cleanup function that keeps only 5 newest entries per KPI combination
CREATE OR REPLACE FUNCTION public.cleanup_kpi_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM kpi_cached_values
  WHERE id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY kpi_slug, period_type, scope_type, COALESCE(scope_id::text, '__null__')
        ORDER BY calculated_at DESC
      ) as rn
      FROM kpi_cached_values
    ) ranked
    WHERE rn <= 5
  );
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RAISE LOG 'KPI cache cleanup: deleted % rows', v_deleted_count;
  
  RETURN v_deleted_count;
END;
$$;
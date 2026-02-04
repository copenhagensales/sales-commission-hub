-- ============================================
-- Task 1 & 2: Delete sales with invalid/missing emails
-- Task 4: Clear any remaining cache duplicates (safety)
-- ============================================

-- 1. Delete sale_items for sales with missing email (Enreach source)
DELETE FROM public.sale_items
WHERE sale_id IN (
  SELECT id FROM public.sales 
  WHERE (agent_email IS NULL OR agent_email = '')
);

-- 2. Delete sales with missing email
DELETE FROM public.sales 
WHERE agent_email IS NULL OR agent_email = '';

-- 3. Delete sale_items for sales with pseudo-emails (adversus.local pattern)
DELETE FROM public.sale_items
WHERE sale_id IN (
  SELECT id FROM public.sales 
  WHERE agent_email LIKE 'agent-%@adversus.local'
);

-- 4. Delete sales with pseudo-emails
DELETE FROM public.sales 
WHERE agent_email LIKE 'agent-%@adversus.local';

-- 5. Ensure kpi_leaderboard_cache has unique constraint on (period_type, scope_type, scope_id)
-- First check if it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'kpi_leaderboard_cache' 
    AND indexname = 'kpi_leaderboard_cache_unique'
  ) THEN
    CREATE UNIQUE INDEX kpi_leaderboard_cache_unique 
    ON public.kpi_leaderboard_cache (period_type, scope_type, scope_id) 
    NULLS NOT DISTINCT;
  END IF;
END $$;

-- 6. Create index on sales.agent_email for faster filtering
CREATE INDEX IF NOT EXISTS idx_sales_agent_email ON public.sales (agent_email);

-- 7. Create index on sales.source for faster dialer queries  
CREATE INDEX IF NOT EXISTS idx_sales_source ON public.sales (source);
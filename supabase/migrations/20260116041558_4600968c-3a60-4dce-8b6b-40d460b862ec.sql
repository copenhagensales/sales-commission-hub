-- =====================================================
-- Database Index Optimering for DailyReports
-- Fase 10: Composite indexes for hyppige query patterns
-- =====================================================

-- 1. Sales composite index (datetime + agent email)
CREATE INDEX IF NOT EXISTS idx_sales_datetime_agent_email 
ON public.sales (sale_datetime, lower(agent_email));

-- 2. Absence request composite index
CREATE INDEX IF NOT EXISTS idx_absence_request_v2_composite
ON public.absence_request_v2 (employee_id, status, start_date, end_date);

-- 3. Fieldmarketing sales composite indexes
CREATE INDEX IF NOT EXISTS idx_fieldmarketing_sales_seller_date
ON public.fieldmarketing_sales (seller_id, registered_at);

CREATE INDEX IF NOT EXISTS idx_fieldmarketing_sales_client_date
ON public.fieldmarketing_sales (client_id, registered_at);

-- 4. Time stamps index (uden date cast - bruger timestamp direkte)
CREATE INDEX IF NOT EXISTS idx_time_stamps_employee_clockin
ON public.time_stamps (employee_id, clock_in);

-- 5. Sale items covering index
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_covering
ON public.sale_items (sale_id) 
INCLUDE (quantity, mapped_commission, mapped_revenue, product_id);
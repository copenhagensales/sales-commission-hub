
-- Fix 1: Add search_path to get_distinct_sales_sources
CREATE OR REPLACE FUNCTION get_distinct_sales_sources()
RETURNS TABLE(source text) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT s.source FROM sales s WHERE s.source IS NOT NULL ORDER BY s.source;
$$;

-- Fix 2: Replace salary_additions USING(true) with proper RLS
DROP POLICY IF EXISTS "Auth users manage salary_additions" ON public.salary_additions;

CREATE POLICY "Managers can view salary_additions"
  ON public.salary_additions FOR SELECT TO authenticated
  USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Owners can manage salary_additions"
  ON public.salary_additions FOR INSERT TO authenticated
  WITH CHECK (is_owner(auth.uid()));

CREATE POLICY "Owners can update salary_additions"
  ON public.salary_additions FOR UPDATE TO authenticated
  USING (is_owner(auth.uid()))
  WITH CHECK (is_owner(auth.uid()));

CREATE POLICY "Owners can delete salary_additions"
  ON public.salary_additions FOR DELETE TO authenticated
  USING (is_owner(auth.uid()));

-- Fix 3: Replace agent_presence USING(true) with proper RLS
DROP POLICY IF EXISTS "Users can manage their own presence" ON public.agent_presence;

CREATE POLICY "Authenticated can view presence"
  ON public.agent_presence FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own presence"
  ON public.agent_presence FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = (SELECT id FROM employee_master_data WHERE auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can update own presence"
  ON public.agent_presence FOR UPDATE TO authenticated
  USING (
    employee_id = (SELECT id FROM employee_master_data WHERE auth_user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Users can delete own presence"
  ON public.agent_presence FOR DELETE TO authenticated
  USING (
    employee_id = (SELECT id FROM employee_master_data WHERE auth_user_id = auth.uid() LIMIT 1)
  );

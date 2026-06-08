
-- ============================================================
-- salary_types: read for all authenticated, write only for managers
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can delete salary types" ON public.salary_types;
DROP POLICY IF EXISTS "Authenticated users can insert salary types" ON public.salary_types;
DROP POLICY IF EXISTS "Authenticated users can update salary types" ON public.salary_types;

CREATE POLICY "Managers can insert salary types"
  ON public.salary_types FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can update salary types"
  ON public.salary_types FOR UPDATE TO authenticated
  USING (public.is_manager_or_above(auth.uid()))
  WITH CHECK (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can delete salary types"
  ON public.salary_types FOR DELETE TO authenticated
  USING (public.is_manager_or_above(auth.uid()));

-- ============================================================
-- booking_startup_bonus: read for all authenticated, write only for managers
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can delete booking_startup_bonus" ON public.booking_startup_bonus;
DROP POLICY IF EXISTS "Authenticated users can insert booking_startup_bonus" ON public.booking_startup_bonus;
DROP POLICY IF EXISTS "Authenticated users can update booking_startup_bonus" ON public.booking_startup_bonus;

CREATE POLICY "Managers can insert booking_startup_bonus"
  ON public.booking_startup_bonus FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can update booking_startup_bonus"
  ON public.booking_startup_bonus FOR UPDATE TO authenticated
  USING (public.is_manager_or_above(auth.uid()))
  WITH CHECK (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can delete booking_startup_bonus"
  ON public.booking_startup_bonus FOR DELETE TO authenticated
  USING (public.is_manager_or_above(auth.uid()));

-- ============================================================
-- employee_absence: employees self-manage their own; managers/planners manage all
-- (Existing "Admin and planners can manage absences" policy stays in place.)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can delete absences" ON public.employee_absence;
DROP POLICY IF EXISTS "Authenticated users can insert absences" ON public.employee_absence;
DROP POLICY IF EXISTS "Authenticated users can update absences" ON public.employee_absence;

CREATE POLICY "Employees can insert own absences"
  ON public.employee_absence FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.get_current_employee_id());

CREATE POLICY "Employees can update own absences"
  ON public.employee_absence FOR UPDATE TO authenticated
  USING (employee_id = public.get_current_employee_id())
  WITH CHECK (employee_id = public.get_current_employee_id());

CREATE POLICY "Employees can delete own absences"
  ON public.employee_absence FOR DELETE TO authenticated
  USING (employee_id = public.get_current_employee_id());

-- ============================================================
-- scheduled_team_changes: manager-only writes
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can delete scheduled changes" ON public.scheduled_team_changes;
DROP POLICY IF EXISTS "Authenticated users can insert scheduled changes" ON public.scheduled_team_changes;
DROP POLICY IF EXISTS "Authenticated users can update scheduled changes" ON public.scheduled_team_changes;
DROP POLICY IF EXISTS "Authenticated users can view scheduled changes" ON public.scheduled_team_changes;

CREATE POLICY "Authenticated can view scheduled changes"
  ON public.scheduled_team_changes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Managers can manage scheduled changes"
  ON public.scheduled_team_changes FOR ALL TO authenticated
  USING (public.is_manager_or_above(auth.uid()))
  WITH CHECK (public.is_manager_or_above(auth.uid()));

-- ============================================================
-- integration_circuit_breaker: writes service_role only; reads authenticated
-- ============================================================
DROP POLICY IF EXISTS "Service role full access" ON public.integration_circuit_breaker;

CREATE POLICY "Service role manages circuit breakers"
  ON public.integration_circuit_breaker FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view circuit breakers"
  ON public.integration_circuit_breaker FOR SELECT TO authenticated
  USING (true);

-- ============================================================
-- kpi_watermarks: writes service_role only; reads authenticated
-- ============================================================
DROP POLICY IF EXISTS "Service role full access" ON public.kpi_watermarks;

CREATE POLICY "Service role manages kpi watermarks"
  ON public.kpi_watermarks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can view kpi watermarks"
  ON public.kpi_watermarks FOR SELECT TO authenticated
  USING (true);

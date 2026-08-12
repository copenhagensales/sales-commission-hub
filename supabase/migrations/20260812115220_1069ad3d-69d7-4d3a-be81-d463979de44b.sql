-- 1. daily_bonus_payouts: fjern "alle autentificerede"-adgang
DROP POLICY IF EXISTS "Authenticated users can view daily bonus payouts" ON public.daily_bonus_payouts;
DROP POLICY IF EXISTS "Authenticated users can insert daily bonus payouts" ON public.daily_bonus_payouts;
DROP POLICY IF EXISTS "Authenticated users can delete daily bonus payouts" ON public.daily_bonus_payouts;

CREATE POLICY "Own or manager can view daily bonus payouts"
ON public.daily_bonus_payouts FOR SELECT TO authenticated
USING (employee_id = public.get_current_employee_id() OR public.is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can insert daily bonus payouts"
ON public.daily_bonus_payouts FOR INSERT TO authenticated
WITH CHECK (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can update daily bonus payouts"
ON public.daily_bonus_payouts FOR UPDATE TO authenticated
USING (public.is_manager_or_above(auth.uid()))
WITH CHECK (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can delete daily bonus payouts"
ON public.daily_bonus_payouts FOR DELETE TO authenticated
USING (public.is_manager_or_above(auth.uid()));

-- 2. employee_salary_schemes: kun egne eller ledere
DROP POLICY IF EXISTS "Authenticated users can view employee salary schemes" ON public.employee_salary_schemes;

CREATE POLICY "Own or manager can view employee salary schemes"
ON public.employee_salary_schemes FOR SELECT TO authenticated
USING (employee_id = public.get_current_employee_id() OR public.is_manager_or_above(auth.uid()));

-- 3. Bogføringsdata: kun ejer eller økonomi-adgang
DROP POLICY IF EXISTS "Authenticated can read posteringer" ON public.economic_posteringer;
DROP POLICY IF EXISTS "Authenticated can read kontoplan" ON public.economic_kontoplan;

CREATE POLICY "Finance access can read posteringer"
ON public.economic_posteringer FOR SELECT TO authenticated
USING (public.is_owner(auth.uid()) OR public.has_page_permission(auth.uid(), 'menu_economic', false));

CREATE POLICY "Finance access can read kontoplan"
ON public.economic_kontoplan FOR SELECT TO authenticated
USING (public.is_owner(auth.uid()) OR public.has_page_permission(auth.uid(), 'menu_economic', false));

-- 4. employee_master_data: kollega-opslag kræver at man selv er aktiv medarbejder
DROP POLICY IF EXISTS "Authenticated users can view active employees for h2h" ON public.employee_master_data;

CREATE POLICY "Employees can view active colleagues"
ON public.employee_master_data FOR SELECT TO authenticated
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.employee_master_data me
    WHERE me.auth_user_id = auth.uid() AND me.is_active = true
  )
);

-- Luk invitation-hullet: opdatering via invitation sker udelukkende via edge function (service role)
DROP POLICY IF EXISTS "Public can update employee via valid invitation" ON public.employee_master_data;

-- 5. Login-logs må kun skrives af systemet
DROP POLICY IF EXISTS "Service role can insert failed login attempts" ON public.failed_login_attempts;
DROP POLICY IF EXISTS "System can insert login events" ON public.login_events;

CREATE POLICY "Only service role can insert failed login attempts"
ON public.failed_login_attempts FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Only service role can insert login events"
ON public.login_events FOR INSERT TO service_role WITH CHECK (true);

REVOKE INSERT ON public.failed_login_attempts FROM anon, authenticated;
REVOKE INSERT ON public.login_events FROM anon, authenticated;

-- 6. Views følger kaldende brugers rettigheder
ALTER VIEW public.posteringer_enriched SET (security_invoker = true);
ALTER VIEW public.dialer_session_daily_metrics SET (security_invoker = true);

-- 7. Fjern anon EXECUTE på SECURITY DEFINER-funktioner (undtagen offentlige flows)
DO $$
DECLARE
  r record;
  allowlist text[] := ARRAY[
    'get_auth_email_by_work_email',
    'get_invitation_by_token',
    'get_invitation_by_token_v2',
    'complete_invitation_password',
    'consume_password_reset_token',
    'verify_tv_board_code',
    'record_tv_board_heartbeat',
    'get_referrer_by_code',
    'has_valid_code_of_conduct_completion'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT (p.proname = ANY (allowlist))
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;
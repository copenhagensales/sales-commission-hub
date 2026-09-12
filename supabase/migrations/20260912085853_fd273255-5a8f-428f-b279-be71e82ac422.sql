-- Kun brugere der er logget ind maa kalde de nye hjaelpere
REVOKE EXECUTE ON FUNCTION public.view_as_target() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_view_as_active() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.effective_employee_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.effective_auth_user_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.effective_roles() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.effective_is_superadmin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.effective_is_owner() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.effective_is_teamleder_or_above() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.effective_has_app_role(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.view_as_candidates() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.view_as_status() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.view_as_target() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_view_as_active() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_employee_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_auth_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_roles() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_is_superadmin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_is_owner() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_is_teamleder_or_above() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_has_app_role(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.view_as_candidates() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.view_as_status() TO authenticated, service_role;

-- ------------------------------------------------------------
-- LAESEADGANG KUN under "se som".
-- Statement-level trigger paa alle public-tabeller: naar en superadmin
-- ser systemet som en anden bruger, afvises enhver skrivning i databasen.
-- Rammer ikke service_role/cron/edge (auth.uid() er NULL der) og ikke
-- almindelige brugere (de har aldrig en aktiv "se som"-raekke).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_writes_during_view_as()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_view_as_active() THEN
    RAISE EXCEPTION 'Du ser systemet som en anden bruger. Afslut for at kunne ændre noget.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.block_writes_during_view_as() FROM anon, public, authenticated;

DO $do$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND c.relname NOT IN (
        'admin_view_as',
        'sensitive_data_access_log',
        'contract_access_log',
        'login_events',
        'failed_login_attempts',
        'agent_presence'
      )
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS zzz_block_writes_view_as ON public.%I', r.relname);
    EXECUTE format(
      'CREATE TRIGGER zzz_block_writes_view_as
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH STATEMENT EXECUTE FUNCTION public.block_writes_during_view_as()', r.relname);
  END LOOP;
END
$do$;
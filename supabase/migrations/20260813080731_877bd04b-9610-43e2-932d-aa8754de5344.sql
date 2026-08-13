-- 1. Settings table
CREATE TABLE public.contract_policy_settings (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.contract_policy_settings TO authenticated;
GRANT INSERT, UPDATE ON public.contract_policy_settings TO authenticated;
GRANT ALL ON public.contract_policy_settings TO service_role;

ALTER TABLE public.contract_policy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read contract policy"
  ON public.contract_policy_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners can insert contract policy"
  ON public.contract_policy_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Owners can update contract policy"
  ON public.contract_policy_settings FOR UPDATE TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

CREATE TRIGGER update_contract_policy_settings_updated_at
  BEFORE UPDATE ON public.contract_policy_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Audit table (append-only)
CREATE TABLE public.contract_policy_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  old_enabled boolean,
  new_enabled boolean,
  old_config jsonb,
  new_config jsonb,
  changed_by uuid,
  changed_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.contract_policy_audit TO authenticated;
GRANT ALL ON public.contract_policy_audit TO service_role;

ALTER TABLE public.contract_policy_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can read contract policy audit"
  ON public.contract_policy_audit FOR SELECT TO authenticated
  USING (public.is_manager_or_above(auth.uid()));

CREATE INDEX idx_contract_policy_audit_created_at
  ON public.contract_policy_audit (created_at DESC);

-- 3. Audit trigger
CREATE OR REPLACE FUNCTION public.log_contract_policy_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.enabled IS NOT DISTINCT FROM NEW.enabled
     AND OLD.config IS NOT DISTINCT FROM NEW.config THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.contract_policy_audit (
    key, old_enabled, new_enabled, old_config, new_config, changed_by, changed_by_email
  ) VALUES (
    NEW.key,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.enabled ELSE NULL END,
    NEW.enabled,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.config ELSE NULL END,
    NEW.config,
    auth.uid(),
    auth.jwt() ->> 'email'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_contract_policy_change
  AFTER INSERT OR UPDATE ON public.contract_policy_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_contract_policy_change();

-- 4. Seed defaults matching today's hardcoded behaviour
INSERT INTO public.contract_policy_settings (key, enabled, config) VALUES
  ('employee_reminder', true, '{"first_after_days": 3, "interval_days": 3, "max_reminders": 3}'::jsonb),
  ('pending_lock', true, '{"days": 5}'::jsonb),
  ('rejected_lock', true, '{}'::jsonb),
  ('management_digest', false, '{"recipients": [], "weekdays_only": true}'::jsonb),
  ('ui_warning', true, '{"warn_days_before_start": 7}'::jsonb);

-- 5. Compliance overview RPC
CREATE OR REPLACE FUNCTION public.get_contract_compliance()
RETURNS TABLE (
  employee_id uuid,
  first_name text,
  last_name text,
  job_title text,
  team_name text,
  employment_start_date date,
  contract_id uuid,
  contract_status text,
  contract_title text,
  sent_at timestamptz,
  reminder_count integer,
  last_reminder_at timestamptz,
  compliance_state text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _global boolean;
  _team boolean;
  _self uuid;
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  _global := public.is_owner(_uid)
    OR public.is_rekruttering(_uid)
    OR public.has_page_permission(_uid, 'menu_contracts', false);
  _team := public.is_teamleder_or_above(_uid);
  _self := public.get_current_employee_id();

  RETURN QUERY
  WITH active_emp AS (
    SELECT e.id, e.first_name, e.last_name, e.job_title, e.employment_start_date
    FROM public.employee_master_data e
    WHERE e.is_active = true
      AND e.employment_start_date IS NOT NULL
  ),
  latest_contract AS (
    SELECT DISTINCT ON (c.employee_id)
      c.employee_id, c.id, c.status, c.title, c.sent_at,
      c.reminder_count, c.last_reminder_at
    FROM public.contracts c
    WHERE c.status <> 'draft'
    ORDER BY c.employee_id,
      (c.status = 'signed') DESC,
      c.created_at DESC
  ),
  emp_team AS (
    SELECT DISTINCT ON (tm.employee_id) tm.employee_id, t.name AS team_name
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    ORDER BY tm.employee_id, tm.created_at ASC
  )
  SELECT
    e.id,
    e.first_name,
    e.last_name,
    e.job_title,
    et.team_name,
    e.employment_start_date,
    lc.id,
    lc.status::text,
    lc.title,
    lc.sent_at,
    COALESCE(lc.reminder_count, 0),
    lc.last_reminder_at,
    CASE
      WHEN lc.id IS NULL THEN 'missing'
      WHEN lc.status = 'signed' THEN 'ok'
      WHEN lc.status = 'rejected' THEN 'rejected'
      WHEN e.employment_start_date <= CURRENT_DATE THEN 'started_unsigned'
      ELSE 'pending'
    END
  FROM active_emp e
  LEFT JOIN latest_contract lc ON lc.employee_id = e.id
  LEFT JOIN emp_team et ON et.employee_id = e.id
  WHERE _global
     OR (_team AND public.is_in_my_teams(e.id))
     OR (_self IS NOT NULL AND e.id = _self);
END;
$$;

REVOKE ALL ON FUNCTION public.get_contract_compliance() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_contract_compliance() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_contract_compliance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contract_compliance() TO service_role;
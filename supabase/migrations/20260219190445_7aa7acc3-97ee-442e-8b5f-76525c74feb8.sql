
-- ============================================================
-- Del A: Rettigheds- og dashboard-fixes
-- ============================================================

-- A1: One-off sync - truncate and re-insert from position mappings
TRUNCATE public.system_roles;

INSERT INTO public.system_roles (user_id, role)
SELECT
  au.id AS user_id,
  CASE
    WHEN jp.system_role_key = 'ejer' THEN 'ejer'::public.system_role
    WHEN jp.system_role_key IN ('teamleder', 'assisterendetm', 'assisterende_teamleder_fm', 'fm_leder') THEN 'teamleder'::public.system_role
    WHEN jp.system_role_key = 'rekruttering' THEN 'rekruttering'::public.system_role
    WHEN jp.system_role_key = 'some' THEN 'some'::public.system_role
    ELSE 'medarbejder'::public.system_role
  END AS role
FROM public.employee_master_data emd
JOIN auth.users au ON au.id = emd.auth_user_id
LEFT JOIN public.job_positions jp ON jp.id = emd.position_id
WHERE emd.is_active = true;

-- A2: Update trigger to react to position_id changes and prioritise position mapping
CREATE OR REPLACE FUNCTION public.sync_system_role_from_job_title()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _auth_user_id uuid;
  _target_role public.system_role;
  _position_role text;
BEGIN
  _auth_user_id := NEW.auth_user_id;

  IF _auth_user_id IS NULL AND NEW.private_email IS NOT NULL THEN
    SELECT id INTO _auth_user_id FROM auth.users WHERE email = NEW.private_email LIMIT 1;
  END IF;

  IF _auth_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.position_id IS NOT NULL THEN
    SELECT system_role_key INTO _position_role
    FROM public.job_positions
    WHERE id = NEW.position_id;
  END IF;

  CASE
    WHEN _position_role = 'ejer' THEN _target_role := 'ejer';
    WHEN _position_role IN ('teamleder', 'assisterendetm', 'assisterende_teamleder_fm', 'fm_leder') THEN _target_role := 'teamleder';
    WHEN _position_role = 'rekruttering' THEN _target_role := 'rekruttering';
    WHEN _position_role = 'some' THEN _target_role := 'some';
    WHEN _position_role IN ('medarbejder', 'fm_medarbejder_') THEN _target_role := 'medarbejder';
    ELSE
      CASE NEW.job_title
        WHEN 'Ejer' THEN _target_role := 'ejer';
        WHEN 'Teamleder' THEN _target_role := 'teamleder';
        WHEN 'Assisterende Teamleder' THEN _target_role := 'teamleder';
        WHEN 'Rekruttering' THEN _target_role := 'rekruttering';
        WHEN 'SOME' THEN _target_role := 'some';
        ELSE _target_role := 'medarbejder';
      END CASE;
  END CASE;

  DELETE FROM public.system_roles WHERE user_id = _auth_user_id;
  INSERT INTO public.system_roles (user_id, role)
  VALUES (_auth_user_id, _target_role);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_role_on_job_title_change ON public.employee_master_data;
CREATE TRIGGER sync_role_on_job_title_change
  AFTER INSERT OR UPDATE OF job_title, position_id ON public.employee_master_data
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_system_role_from_job_title();

-- A3: can_manage_permissions with job_positions fallback
CREATE OR REPLACE FUNCTION public.can_manage_permissions(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN public.is_owner(_user_id) THEN true
      ELSE EXISTS (
        SELECT 1
        FROM public.role_page_permissions rpp
        JOIN public.system_roles sr ON sr.role::text = rpp.role_key
        WHERE sr.user_id = _user_id
          AND rpp.permission_key = 'tab_employees_permissions'
          AND rpp.can_edit = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.role_page_permissions rpp
        JOIN public.employee_master_data emd ON emd.auth_user_id = _user_id
        JOIN public.job_positions jp ON jp.id = emd.position_id
        WHERE rpp.role_key = jp.system_role_key
          AND rpp.permission_key = 'tab_employees_permissions'
          AND rpp.can_edit = true
          AND emd.is_active = true
      )
    END
$$;

-- A4: CS Top 20 custom period RPC
CREATE OR REPLACE FUNCTION public.get_cs_top20_custom_period_leaderboard(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  employee_id uuid,
  employee_name text,
  avatar_url text,
  team_name text,
  sales_count bigint,
  commission numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT id
    FROM public.employee_master_data
    WHERE auth_user_id = auth.uid()
      AND is_active = true
    LIMIT 1
  ),
  has_dashboard_access AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.team_members tm
      JOIN public.team_dashboard_permissions tdp ON tdp.team_id = tm.team_id
      JOIN me ON me.id = tm.employee_id
      WHERE tdp.dashboard_slug = 'cs-top-20'
        AND tdp.access_level <> 'none'
    ) OR public.is_owner(auth.uid()) AS allowed
  )
  SELECT
    emd.id AS employee_id,
    TRIM(CONCAT(COALESCE(emd.first_name, ''), ' ', COALESCE(emd.last_name, ''))) AS employee_name,
    emd.avatar_url,
    t.name AS team_name,
    COALESCE(SUM(CASE WHEN COALESCE(p.counts_as_sale, true) THEN COALESCE(si.quantity, 1) ELSE 0 END), 0)::bigint AS sales_count,
    COALESCE(SUM(COALESCE(si.mapped_commission, 0)), 0)::numeric AS commission
  FROM public.sales s
  CROSS JOIN has_dashboard_access hda
  JOIN public.sale_items si ON si.sale_id = s.id
  LEFT JOIN public.products p ON p.id = si.product_id
  JOIN public.agents a ON LOWER(a.email) = LOWER(s.agent_email)
  JOIN public.employee_agent_mapping eam ON eam.agent_id = a.id
  JOIN public.employee_master_data emd ON emd.id = eam.employee_id
  LEFT JOIN public.teams t ON t.id = emd.team_id
  WHERE hda.allowed = true
    AND s.sale_datetime >= p_from
    AND s.sale_datetime <= p_to
    AND COALESCE(s.validation_status, '') <> 'rejected'
  GROUP BY emd.id, emd.first_name, emd.last_name, emd.avatar_url, t.name
  ORDER BY commission DESC
  LIMIT LEAST(COALESCE(p_limit, 20), 100);
$$;

GRANT EXECUTE ON FUNCTION public.get_cs_top20_custom_period_leaderboard(timestamptz, timestamptz, integer) TO authenticated;

-- A5: Teams RLS cleanup
DROP POLICY IF EXISTS "Anon can read teams" ON public.teams;
DROP POLICY IF EXISTS "Teamledere og ejere kan se teams" ON public.teams;

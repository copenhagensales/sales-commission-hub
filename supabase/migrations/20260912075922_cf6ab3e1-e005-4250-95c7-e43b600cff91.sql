REVOKE EXECUTE ON FUNCTION public.can_view_ramp_risk_flags() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_view_ramp_risk_flags() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ramp_create_risk_flags()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_created int := 0;
BEGIN
  WITH enrolled AS (
    SELECT en.employee_id, en.client_campaign_id, en.start_date, en.curve_version,
           lower(coalesce(e.work_email, e.private_email)) AS email,
           public.ramp_workday_no(en.start_date, (now() AT TIME ZONE 'Europe/Copenhagen')::date) AS day_no
    FROM public.employee_ramp_enrollment en
    JOIN public.employee_master_data e ON e.id = en.employee_id
    WHERE coalesce(e.work_email, e.private_email) IS NOT NULL
      AND (e.employment_end_date IS NULL
           OR e.employment_end_date >= (now() AT TIME ZONE 'Europe/Copenhagen')::date)
  ),
  at_checkpoint AS (
    SELECT * FROM enrolled WHERE day_no IN (10, 15)
  ),
  measured AS (
    SELECT a.*,
           (SELECT count(*) FROM public.sales sa
              WHERE sa.client_campaign_id = a.client_campaign_id
                AND sa.agent_email = a.email
                AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date >= a.start_date
                AND (sa.sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date
                    <= (now() AT TIME ZONE 'Europe/Copenhagen')::date
           ) AS cum_sales,
           (SELECT c.p25 FROM public.ramp_curve c
              WHERE c.client_campaign_id = a.client_campaign_id
                AND c.curve_version = a.curve_version
                AND c.day_no = a.day_no
           ) AS threshold_value
    FROM at_checkpoint a
  ),
  inserted AS (
    INSERT INTO public.ramp_risk_flag
      (employee_id, client_campaign_id, day_no, cum_sales, threshold_value, curve_version)
    SELECT m.employee_id, m.client_campaign_id, m.day_no, m.cum_sales, m.threshold_value, m.curve_version
    FROM measured m
    WHERE m.threshold_value IS NOT NULL
      AND m.cum_sales < m.threshold_value
    ON CONFLICT (employee_id, day_no) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_created FROM inserted;

  RETURN v_created;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ramp_create_risk_flags() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.ramp_create_risk_flags() TO service_role;

CREATE OR REPLACE FUNCTION public.get_ramp_risk_flags()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_me uuid := public.get_employee_id_for_user(auth.uid());
  v_all boolean := public.is_owner(auth.uid()) OR public.am_i_superadmin();
  v_result jsonb;
BEGIN
  IF NOT public.can_view_ramp_risk_flags() THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at), '[]'::jsonb)
    INTO v_result
  FROM (
    SELECT f.id,
           f.employee_id,
           trim(concat_ws(' ', e.first_name, e.last_name)) AS employee_name,
           cc.name AS campaign_name,
           f.day_no,
           f.cum_sales,
           f.threshold_value,
           c.p75 AS typical_upper,
           c.p50 AS typical_median,
           f.created_at,
           greatest(0, (date_part('epoch', now() - f.created_at) / 86400)::int) AS days_open,
           coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'action_type', a.action_type,
                      'performed_at', a.performed_at,
                      'performed_by_name', trim(concat_ws(' ', p.first_name, p.last_name))
                    ) ORDER BY a.performed_at)
             FROM public.ramp_flag_action a
             LEFT JOIN public.employee_master_data p ON p.id = a.performed_by
             WHERE a.flag_id = f.id
           ), '[]'::jsonb) AS actions
    FROM public.ramp_risk_flag f
    JOIN public.employee_master_data e ON e.id = f.employee_id
    LEFT JOIN public.client_campaigns cc ON cc.id = f.client_campaign_id
    LEFT JOIN public.ramp_curve c
      ON c.client_campaign_id = f.client_campaign_id
     AND c.curve_version = f.curve_version
     AND c.day_no = f.day_no
    WHERE f.status = 'open'
      AND f.employee_id IS DISTINCT FROM v_me
      AND (
        v_all
        OR EXISTS (
          SELECT 1
          FROM public.team_members tm
          JOIN public.teams t ON t.id = tm.team_id
          WHERE tm.employee_id = f.employee_id
            AND (
              t.team_leader_id = v_me
              OR t.assistant_team_leader_id = v_me
              OR EXISTS (SELECT 1 FROM public.team_assistant_leaders al
                          WHERE al.team_id = t.id AND al.employee_id = v_me)
            )
        )
      )
  ) x;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_ramp_risk_flags() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_ramp_risk_flags() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ramp_risk_mail_payload()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH s AS (SELECT * FROM public.ramp_risk_settings ORDER BY created_at LIMIT 1),
  leader_team AS (
    SELECT t.id AS team_id, t.team_leader_id AS employee_id FROM public.teams t WHERE t.team_leader_id IS NOT NULL
    UNION
    SELECT t.id, t.assistant_team_leader_id FROM public.teams t WHERE t.assistant_team_leader_id IS NOT NULL
    UNION
    SELECT al.team_id, al.employee_id FROM public.team_assistant_leaders al
  ),
  open_flags AS (
    SELECT lt.employee_id AS leader_id,
           f.id AS flag_id,
           trim(concat_ws(' ', e.first_name, e.last_name)) AS employee_name,
           cc.name AS campaign_name,
           f.day_no, f.cum_sales, f.threshold_value, f.created_at
    FROM public.ramp_risk_flag f
    JOIN public.team_members tm ON tm.employee_id = f.employee_id
    JOIN leader_team lt ON lt.team_id = tm.team_id
    JOIN public.employee_master_data e ON e.id = f.employee_id
    LEFT JOIN public.client_campaigns cc ON cc.id = f.client_campaign_id
    WHERE f.status = 'open'
      AND f.employee_id <> lt.employee_id
  )
  SELECT coalesce(jsonb_agg(payload), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
             'leader_id', o.leader_id,
             'leader_name', trim(concat_ws(' ', l.first_name, l.last_name)),
             'leader_email', l.work_email,
             'risk_factor', (SELECT risk_factor FROM s),
             'basis_sellers', (SELECT basis_sellers FROM s),
             'basis_leavers', (SELECT basis_leavers FROM s),
             'basis_campaign_label', (SELECT basis_campaign_label FROM s),
             'sellers', jsonb_agg(DISTINCT jsonb_build_object(
                 'employee_name', o.employee_name,
                 'campaign_name', o.campaign_name,
                 'day_no', o.day_no,
                 'cum_sales', o.cum_sales,
                 'threshold_value', o.threshold_value,
                 'created_at', o.created_at
               ))
           ) AS payload
    FROM open_flags o
    JOIN public.employee_master_data l ON l.id = o.leader_id
    WHERE l.work_email IS NOT NULL
      AND coalesce(l.is_active, true) = true
    GROUP BY o.leader_id, l.first_name, l.last_name, l.work_email
  ) q;
$$;

REVOKE EXECUTE ON FUNCTION public.ramp_risk_mail_payload() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.ramp_risk_mail_payload() TO service_role;

CREATE OR REPLACE FUNCTION public.ramp_nightly_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enrolled int := 0;
  v_recomputed int := 0;
  v_flags int := 0;
  v_campaign uuid;
BEGIN
  IF extract(day FROM current_date) = 1 THEN
    FOR v_campaign IN SELECT DISTINCT client_campaign_id FROM public.ramp_curve
    LOOP
      PERFORM public.compute_ramp_curve(v_campaign);
      v_recomputed := v_recomputed + 1;
    END LOOP;
  END IF;

  WITH latest AS (
    SELECT client_campaign_id, max(curve_version) AS curve_version
    FROM public.ramp_curve GROUP BY client_campaign_id
  ),
  candidates AS (
    SELECT DISTINCT ON (e.id)
           e.id AS employee_id,
           sa.client_campaign_id,
           e.employment_start_date,
           l.curve_version
    FROM public.employee_master_data e
    JOIN public.sales sa
      ON sa.agent_email = lower(coalesce(e.work_email, e.private_email))
    JOIN latest l ON l.client_campaign_id = sa.client_campaign_id
    WHERE e.employment_start_date IS NOT NULL
      AND coalesce(e.is_active, true) = true
      AND public.ramp_workday_no(e.employment_start_date,
            (now() AT TIME ZONE 'Europe/Copenhagen')::date) BETWEEN 1 AND 40
      AND NOT EXISTS (
        SELECT 1 FROM public.employee_ramp_enrollment en WHERE en.employee_id = e.id
      )
    ORDER BY e.id, sa.sale_datetime
  ),
  ins AS (
    INSERT INTO public.employee_ramp_enrollment
      (employee_id, client_campaign_id, start_date, curve_version)
    SELECT employee_id, client_campaign_id, employment_start_date, curve_version
    FROM candidates
    ON CONFLICT (employee_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_enrolled FROM ins;

  v_flags := public.ramp_create_risk_flags();

  RETURN jsonb_build_object('enrolled', v_enrolled, 'recomputed', v_recomputed, 'flags_created', v_flags);
END;
$$;
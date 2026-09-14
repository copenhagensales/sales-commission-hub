CREATE OR REPLACE FUNCTION public.get_quality_reviewer_stats(p_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_date date := COALESCE(p_date, (now() AT TIME ZONE 'Europe/Copenhagen')::date);
  v_me uuid := public.get_current_employee_id();
  v_super boolean := public.is_superadmin(auth.uid());
  v_goal integer;
  v_result jsonb;
BEGIN
  IF NOT public.quality_can_view_all() THEN
    RAISE EXCEPTION 'Ingen adgang til kvalitetsmodulet';
  END IF;

  SELECT daily_goal INTO v_goal FROM public.quality_settings LIMIT 1;

  WITH base AS (
    SELECT r.reviewer_employee_id,
           (r.completed_at AT TIME ZONE 'Europe/Copenhagen')::date AS d,
           EXTRACT(EPOCH FROM (r.completed_at - r.started_at)) AS secs
    FROM public.quality_reviews r
    WHERE (r.completed_at AT TIME ZONE 'Europe/Copenhagen')::date BETWEEN v_date - 29 AND v_date
      AND NOT EXISTS (SELECT 1 FROM public.quality_review_voids v WHERE v.review_id = r.id)
  ),
  per_reviewer AS (
    SELECT b.reviewer_employee_id,
      COUNT(*) FILTER (WHERE b.d = v_date) AS today_count,
      AVG(b.secs) FILTER (WHERE b.d = v_date) AS avg_secs_today,
      AVG(b.secs) AS avg_secs_30d,
      COUNT(*) AS count_30d
    FROM base b GROUP BY b.reviewer_employee_id
  )
  SELECT jsonb_build_object(
    'date', v_date,
    'daily_goal', COALESCE(v_goal, 40),
    'me', COALESCE((SELECT to_jsonb(pr) FROM per_reviewer pr WHERE pr.reviewer_employee_id = v_me), '{}'::jsonb),
    'my_daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d, 'count', c) ORDER BY d)
        FROM (SELECT b.d, COUNT(*) c FROM base b WHERE b.reviewer_employee_id = v_me GROUP BY b.d) q(d, c)), '[]'::jsonb),
    'all', COALESCE((SELECT jsonb_build_object(
          'today_count', COUNT(*) FILTER (WHERE b.d = v_date),
          'avg_secs_today', AVG(b.secs) FILTER (WHERE b.d = v_date),
          'avg_secs_30d', AVG(b.secs),
          'count_30d', COUNT(*))
        FROM base b), '{}'::jsonb),
    'all_daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d, 'count', c) ORDER BY d)
        FROM (SELECT b.d, COUNT(*) c FROM base b GROUP BY b.d) q(d, c)), '[]'::jsonb),
    'reviewers', CASE WHEN v_super THEN COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'employee_id', pr.reviewer_employee_id,
          'name', TRIM(CONCAT(e.first_name, ' ', e.last_name)),
          'today_count', pr.today_count,
          'avg_secs_today', pr.avg_secs_today,
          'avg_secs_30d', pr.avg_secs_30d,
          'count_30d', pr.count_30d))
        FROM per_reviewer pr LEFT JOIN public.employee_master_data e ON e.id = pr.reviewer_employee_id), '[]'::jsonb)
      ELSE '[]'::jsonb END
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
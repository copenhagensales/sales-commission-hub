ALTER TABLE public.weekly_lead_closure_stats ADD COLUMN invalid_reason text;

ALTER TABLE public.weekly_lead_closure_stats
  DROP CONSTRAINT weekly_lead_closure_stats_week_start_account_adversus_campa_key;
ALTER TABLE public.weekly_lead_closure_stats
  ADD CONSTRAINT weekly_lead_closure_stats_unique_key
  UNIQUE NULLS NOT DISTINCT (week_start, account, adversus_campaign_id, agent_reference, status, invalid_reason);

COMMENT ON COLUMN public.weekly_lead_closure_stats.invalid_reason IS
  'Kun for status invalid på Adversus: værdien fra rullelisten "Ugyldig:" (whitelist, ukendt = Andet). NULL = ingen årsag (lukket af dialeren) eller ikke opgjort. "Ikke opgjort" = hentet før opdelingen og kunne ikke genskabes.';

CREATE OR REPLACE FUNCTION public.weekly_lead_closure_add(_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _count integer;
BEGIN
  INSERT INTO public.weekly_lead_closure_stats AS s (
    week_start, account, adversus_campaign_id, report_line, agent_reference, status, invalid_reason, lead_count
  )
  SELECT
    (r->>'week_start')::date,
    r->>'account',
    r->>'adversus_campaign_id',
    NULLIF(r->>'report_line', ''),
    r->>'agent_reference',
    r->>'status',
    NULLIF(r->>'invalid_reason', ''),
    (r->>'lead_count')::integer
  FROM jsonb_array_elements(_rows) AS r
  ON CONFLICT ON CONSTRAINT weekly_lead_closure_stats_unique_key
  DO UPDATE SET
    lead_count = s.lead_count + EXCLUDED.lead_count,
    report_line = EXCLUDED.report_line,
    updated_at = now();

  SELECT jsonb_array_length(_rows) INTO _count;
  RETURN _count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_weekly_lead_closure_report(p_period text DEFAULT 'week'::text, p_anchor date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_weeks date[];
  v_period_weeks date[];
  v_anchor date;
  v_result jsonb;
BEGIN
  IF NOT public.effective_is_teamleder_or_above() THEN
    RAISE EXCEPTION 'Ingen adgang til Tryg-rapporten';
  END IF;

  SELECT array_agg(DISTINCT week_start ORDER BY week_start DESC)
    INTO v_weeks
    FROM public.weekly_lead_closure_stats;

  IF v_weeks IS NULL THEN
    RETURN jsonb_build_object(
      'weeks', '[]'::jsonb, 'period_weeks', '[]'::jsonb, 'lines', '[]'::jsonb,
      'unmapped', '[]'::jsonb, 'calls', '[]'::jsonb, 'mcr_lines', '[]'::jsonb,
      'invalid_reasons', '[]'::jsonb, 'line_accounts', '[]'::jsonb
    );
  END IF;

  v_anchor := COALESCE(p_anchor, v_weeks[1]);

  SELECT array_agg(w ORDER BY w DESC)
    INTO v_period_weeks
    FROM unnest(v_weeks) AS w
   WHERE CASE p_period
           WHEN 'month' THEN to_char(w, 'YYYY-MM') = to_char(v_anchor, 'YYYY-MM') AND w <= v_anchor
           WHEN 'ytd'   THEN to_char(w, 'YYYY') = to_char(v_anchor, 'YYYY') AND w <= v_anchor
           ELSE w = v_anchor
         END;

  v_period_weeks := COALESCE(v_period_weeks, ARRAY[]::date[]);

  SELECT jsonb_build_object(
    'weeks', to_jsonb(v_weeks),
    'period_weeks', to_jsonb(v_period_weeks),
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('report_line', t.report_line, 'status', t.status, 'lead_count', t.lead_count))
        FROM (
          SELECT m.report_line, s.status, SUM(s.lead_count)::int AS lead_count
            FROM public.weekly_lead_closure_stats s
            JOIN public.weekly_lead_report_campaign_map m
              ON m.account = s.account AND m.adversus_campaign_id = s.adversus_campaign_id
           WHERE s.week_start = ANY(v_period_weeks) AND m.report_line IS NOT NULL
           GROUP BY m.report_line, s.status
        ) t
    ), '[]'::jsonb),
    'unmapped', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('account', u.account, 'campaign_id', u.adversus_campaign_id, 'status', u.status, 'lead_count', u.lead_count))
        FROM (
          SELECT s.account, s.adversus_campaign_id, s.status, SUM(s.lead_count)::int AS lead_count
            FROM public.weekly_lead_closure_stats s
            LEFT JOIN public.weekly_lead_report_campaign_map m
              ON m.account = s.account AND m.adversus_campaign_id = s.adversus_campaign_id
           WHERE s.week_start = ANY(v_period_weeks) AND m.report_line IS NULL
           GROUP BY s.account, s.adversus_campaign_id, s.status
        ) u
    ), '[]'::jsonb),
    'calls', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('report_line', c.report_line, 'attempts', c.attempts, 'answered', c.answered, 'leads_dialed', c.leads_dialed, 'leads_answered', c.leads_answered))
        FROM (
          SELECT m.report_line,
                 SUM(cs.attempts)::int AS attempts, SUM(cs.answered)::int AS answered,
                 SUM(cs.leads_dialed)::int AS leads_dialed, SUM(cs.leads_answered)::int AS leads_answered
            FROM public.weekly_lead_call_stats cs
            JOIN public.weekly_lead_report_campaign_map m
              ON m.account = cs.account AND m.adversus_campaign_id = cs.campaign_id
           WHERE cs.week_start = ANY(v_period_weeks) AND m.report_line IS NOT NULL
           GROUP BY m.report_line
        ) c
    ), '[]'::jsonb),
    'mcr_lines', COALESCE((
      SELECT jsonb_agg(DISTINCT m.report_line)
        FROM public.weekly_lead_report_campaign_map m
       WHERE m.account = 'enreach' AND m.report_line IS NOT NULL
    ), '[]'::jsonb),
    -- Ugyldige pr. årsag (kun Adversus). reason NULL = ingen årsag (lukket af dialeren).
    'invalid_reasons', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('report_line', r.report_line, 'reason', r.invalid_reason, 'lead_count', r.lead_count))
        FROM (
          SELECT m.report_line, s.invalid_reason, SUM(s.lead_count)::int AS lead_count
            FROM public.weekly_lead_closure_stats s
            JOIN public.weekly_lead_report_campaign_map m
              ON m.account = s.account AND m.adversus_campaign_id = s.adversus_campaign_id
           WHERE s.week_start = ANY(v_period_weeks) AND m.report_line IS NOT NULL
             AND s.status = 'invalid' AND s.account <> 'enreach'
           GROUP BY m.report_line, s.invalid_reason
        ) r
    ), '[]'::jsonb),
    'line_accounts', COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object('report_line', m.report_line, 'account', m.account))
        FROM public.weekly_lead_report_campaign_map m
       WHERE m.report_line IS NOT NULL
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
CREATE INDEX IF NOT EXISTS idx_wlcs_week_account_campaign_status
  ON public.weekly_lead_closure_stats (week_start, account, adversus_campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_wlcs_week_report_line
  ON public.weekly_lead_closure_stats (week_start, report_line);

CREATE INDEX IF NOT EXISTS idx_wl_call_stats_week_account_campaign
  ON public.weekly_lead_call_stats (week_start, account, campaign_id);

CREATE INDEX IF NOT EXISTS idx_wl_campaign_map_account_campaign
  ON public.weekly_lead_report_campaign_map (account, adversus_campaign_id);

CREATE OR REPLACE FUNCTION public.get_weekly_lead_closure_report(
  p_period text DEFAULT 'week',
  p_anchor date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weeks date[];
  v_period_weeks date[];
  v_anchor date;
  v_result jsonb;
BEGIN
  -- Adgangskontrol én gang, i stedet for RLS pr. række.
  IF NOT public.effective_is_teamleder_or_above() THEN
    RAISE EXCEPTION 'Ingen adgang til Tryg-rapporten';
  END IF;

  SELECT array_agg(DISTINCT week_start ORDER BY week_start DESC)
    INTO v_weeks
    FROM public.weekly_lead_closure_stats;

  IF v_weeks IS NULL THEN
    RETURN jsonb_build_object(
      'weeks', '[]'::jsonb,
      'period_weeks', '[]'::jsonb,
      'lines', '[]'::jsonb,
      'unmapped', '[]'::jsonb,
      'calls', '[]'::jsonb,
      'mcr_lines', '[]'::jsonb
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
      SELECT jsonb_agg(jsonb_build_object(
               'report_line', t.report_line,
               'status', t.status,
               'lead_count', t.lead_count))
        FROM (
          SELECT s.report_line, s.status, SUM(s.lead_count)::int AS lead_count
            FROM public.weekly_lead_closure_stats s
           WHERE s.week_start = ANY(v_period_weeks)
             AND s.report_line IS NOT NULL
           GROUP BY s.report_line, s.status
        ) t
    ), '[]'::jsonb),
    'unmapped', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'account', u.account,
               'campaign_id', u.adversus_campaign_id,
               'status', u.status,
               'lead_count', u.lead_count))
        FROM (
          SELECT s.account, s.adversus_campaign_id, s.status, SUM(s.lead_count)::int AS lead_count
            FROM public.weekly_lead_closure_stats s
           WHERE s.week_start = ANY(v_period_weeks)
             AND s.report_line IS NULL
           GROUP BY s.account, s.adversus_campaign_id, s.status
        ) u
    ), '[]'::jsonb),
    'calls', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'report_line', c.report_line,
               'attempts', c.attempts,
               'answered', c.answered,
               'leads_dialed', c.leads_dialed,
               'leads_answered', c.leads_answered))
        FROM (
          SELECT m.report_line,
                 SUM(cs.attempts)::int AS attempts,
                 SUM(cs.answered)::int AS answered,
                 SUM(cs.leads_dialed)::int AS leads_dialed,
                 SUM(cs.leads_answered)::int AS leads_answered
            FROM public.weekly_lead_call_stats cs
            JOIN public.weekly_lead_report_campaign_map m
              ON m.account = cs.account
             AND m.adversus_campaign_id = cs.campaign_id
           WHERE cs.week_start = ANY(v_period_weeks)
             AND m.report_line IS NOT NULL
           GROUP BY m.report_line
        ) c
    ), '[]'::jsonb),
    'mcr_lines', COALESCE((
      SELECT jsonb_agg(DISTINCT m.report_line)
        FROM public.weekly_lead_report_campaign_map m
       WHERE m.account = 'enreach'
         AND m.report_line IS NOT NULL
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_weekly_lead_closure_report(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_lead_closure_report(text, date) TO service_role;
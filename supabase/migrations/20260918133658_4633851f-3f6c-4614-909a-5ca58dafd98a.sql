CREATE OR REPLACE FUNCTION public.weekly_lead_closure_add(_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  INSERT INTO public.weekly_lead_closure_stats AS s (
    week_start, account, adversus_campaign_id, report_line, agent_reference, status, lead_count
  )
  SELECT
    (r->>'week_start')::date,
    r->>'account',
    r->>'adversus_campaign_id',
    NULLIF(r->>'report_line', ''),
    r->>'agent_reference',
    r->>'status',
    (r->>'lead_count')::integer
  FROM jsonb_array_elements(_rows) AS r
  ON CONFLICT (week_start, account, adversus_campaign_id, agent_reference, status)
  DO UPDATE SET
    lead_count = s.lead_count + EXCLUDED.lead_count,
    report_line = EXCLUDED.report_line,
    updated_at = now();

  SELECT jsonb_array_length(_rows) INTO _count;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.weekly_lead_closure_add(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.weekly_lead_closure_add(jsonb) TO service_role;

-- RPC 1: get_call_stats - server-side AVG/SUM for dialer_calls duration
CREATE OR REPLACE FUNCTION public.get_call_stats(start_ts timestamptz, end_ts timestamptz)
RETURNS TABLE(avg_duration numeric, total_duration numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(AVG(CASE WHEN duration_seconds > 0 THEN duration_seconds END), 0),
    COALESCE(SUM(duration_seconds), 0)
  FROM dialer_calls
  WHERE start_time >= start_ts AND start_time <= end_ts;
$$;

-- RPC 2: get_source_counts - aggregated source counts for ApiDataOverview
CREATE OR REPLACE FUNCTION public.get_source_counts()
RETURNS TABLE(source_name text, entity_type text, cnt bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT LOWER(source), 'sales'::text, COUNT(*) FROM sales WHERE source IS NOT NULL GROUP BY LOWER(source)
  UNION ALL
  SELECT LOWER(source), 'sales_as_events'::text, COUNT(*) FROM sales WHERE source IS NOT NULL AND LOWER(source) != 'adversus' GROUP BY LOWER(source)
  UNION ALL
  SELECT LOWER(integration_type), 'calls'::text, COUNT(*) FROM dialer_calls WHERE integration_type IS NOT NULL GROUP BY LOWER(integration_type)
  UNION ALL
  SELECT LOWER(source), 'agents'::text, COUNT(*) FROM agents WHERE source IS NOT NULL GROUP BY LOWER(source);
$$;

-- RPC 3: get_distinct_agent_emails_for_client - unique agent emails per client
CREATE OR REPLACE FUNCTION public.get_distinct_agent_emails_for_client(p_client_id uuid)
RETURNS TABLE(agent_email text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT s.agent_email
  FROM sales s
  JOIN client_campaigns cc ON s.client_campaign_id = cc.id
  WHERE cc.client_id = p_client_id AND s.agent_email IS NOT NULL;
$$;

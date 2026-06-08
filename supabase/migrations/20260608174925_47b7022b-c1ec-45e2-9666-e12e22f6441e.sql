
-- =========================================================
-- TV BOARD: replace anon-readable policies with SECURITY DEFINER RPCs
-- =========================================================

CREATE OR REPLACE FUNCTION public.verify_tv_board_code(p_code text)
RETURNS TABLE (
  id uuid,
  dashboard_slug text,
  dashboard_slugs text[],
  is_active boolean,
  access_count integer,
  auto_rotate boolean,
  rotate_interval_seconds integer,
  rotate_intervals_per_dashboard jsonb,
  celebration_enabled boolean,
  celebration_effect text,
  celebration_duration integer,
  celebration_trigger_condition text,
  celebration_text text,
  celebration_metric text,
  celebration_source_dashboard text,
  start_fullscreen boolean,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.dashboard_slug,
    t.dashboard_slugs,
    t.is_active,
    t.access_count,
    t.auto_rotate,
    t.rotate_interval_seconds,
    t.rotate_intervals_per_dashboard,
    t.celebration_enabled,
    t.celebration_effect,
    t.celebration_duration,
    t.celebration_trigger_condition,
    t.celebration_text,
    t.celebration_metric,
    t.celebration_source_dashboard,
    t.start_fullscreen,
    t.expires_at
  FROM public.tv_board_access t
  WHERE upper(t.access_code) = upper(p_code)
    AND t.is_active = true
    AND (t.expires_at IS NULL OR t.expires_at > now())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_tv_board_code(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_tv_board_heartbeat(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.tv_board_access
  SET last_accessed_at = now(),
      access_count = COALESCE(access_count, 0) + 1
  WHERE id = p_id AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.record_tv_board_heartbeat(uuid) TO anon, authenticated;

-- Drop anon-facing policies on tv_board_access
DROP POLICY IF EXISTS "Anyone can verify access codes" ON public.tv_board_access;
DROP POLICY IF EXISTS "Anyone can update access stats" ON public.tv_board_access;

-- Keep "Authenticated users can manage access codes" for admin UI; tighten to managers
DROP POLICY IF EXISTS "Authenticated users can manage access codes" ON public.tv_board_access;
CREATE POLICY "Managers can manage tv board access"
  ON public.tv_board_access
  FOR ALL
  TO authenticated
  USING (public.is_manager_or_above(auth.uid()))
  WITH CHECK (public.is_manager_or_above(auth.uid()));

-- =========================================================
-- KPI CACHE: require authenticated, not public anon
-- =========================================================

DROP POLICY IF EXISTS "Anyone can view cached KPI values" ON public.kpi_cached_values;
CREATE POLICY "Authenticated users can view cached KPI values"
  ON public.kpi_cached_values
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view leaderboard cache" ON public.kpi_leaderboard_cache;
CREATE POLICY "Authenticated users can view leaderboard cache"
  ON public.kpi_leaderboard_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- =========================================================
-- INTEGRATION DEBUG LOG: only service_role can write
-- =========================================================

DROP POLICY IF EXISTS "System can manage integration debug logs" ON public.integration_debug_log;
CREATE POLICY "Service role can manage integration debug logs"
  ON public.integration_debug_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =========================================================
-- PEER-DATA: drop team-wide read; keep self + teamleder + owner
-- =========================================================

DROP POLICY IF EXISTS "Team members can view team absence requests" ON public.absence_request_v2;
DROP POLICY IF EXISTS "Team members can view team career wishes" ON public.career_wishes;
DROP POLICY IF EXISTS "Team members can view team quiz submissions" ON public.car_quiz_submissions;
DROP POLICY IF EXISTS "Team members can view team quiz completions" ON public.car_quiz_completions;
DROP POLICY IF EXISTS "Team members can view team coc attempts" ON public.code_of_conduct_attempts;

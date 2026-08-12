-- Single source of truth for headcount reporting.
-- Definitions:
--   active   = employee_master_data.is_active = true
--   started  = employment_start_date <= cutoff (NULL start date is treated as started)
--   staff    = is_staff_employee (master data) / team_name ilike '%stab%' (historical)

CREATE OR REPLACE FUNCTION public.get_headcount_current()
RETURNS TABLE (
  active_started_excl_staff integer,
  pending_starts integer,
  staff_active integer,
  active_total integer,
  missing_start_date integer,
  inactive_missing_end_date integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (
      WHERE e.is_active
        AND COALESCE(e.is_staff_employee, false) = false
        AND (e.employment_start_date IS NULL OR e.employment_start_date <= CURRENT_DATE)
    )::integer,
    COUNT(*) FILTER (
      WHERE e.is_active
        AND COALESCE(e.is_staff_employee, false) = false
        AND e.employment_start_date > CURRENT_DATE
    )::integer,
    COUNT(*) FILTER (WHERE e.is_active AND COALESCE(e.is_staff_employee, false) = true)::integer,
    COUNT(*) FILTER (WHERE e.is_active)::integer,
    COUNT(*) FILTER (WHERE e.is_active AND e.employment_start_date IS NULL)::integer,
    COUNT(*) FILTER (WHERE NOT e.is_active AND e.employment_end_date IS NULL)::integer
  FROM public.employee_master_data e;
$$;

GRANT EXECUTE ON FUNCTION public.get_headcount_current() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_headcount_monthly(p_from date)
RETURNS TABLE (
  month_end date,
  headcount_excl_staff integer,
  headcount_incl_staff integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH master AS (
    SELECT
      regexp_replace(lower(trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, ''))), '\s+', ' ', 'g') AS norm_name,
      COALESCE(e.employment_start_date, DATE '1900-01-01') AS start_date,
      CASE
        WHEN e.employment_end_date IS NOT NULL THEN e.employment_end_date
        WHEN e.is_active THEN NULL
        ELSE e.updated_at::date
      END AS end_date,
      COALESCE(e.is_staff_employee, false) AS is_staff
    FROM public.employee_master_data e
  ),
  historical AS (
    SELECT
      regexp_replace(lower(trim(coalesce(h.employee_name, ''))), '\s+', ' ', 'g') AS norm_name,
      h.start_date,
      h.end_date,
      (lower(coalesce(h.team_name, '')) LIKE '%stab%') AS is_staff
    FROM public.historical_employment h
    WHERE h.start_date IS NOT NULL
  ),
  historical_deduped AS (
    -- Master data is the maintained source of truth; drop historical rows that
    -- overlap in time with a master row for the same normalised name.
    SELECT h.*
    FROM historical h
    WHERE NOT EXISTS (
      SELECT 1
      FROM master m
      WHERE m.norm_name = h.norm_name
        AND m.norm_name <> ''
        AND COALESCE(h.end_date, DATE '9999-12-31') >= m.start_date
        AND COALESCE(m.end_date, DATE '9999-12-31') >= h.start_date
    )
  ),
  spans AS (
    SELECT norm_name, start_date, end_date, is_staff FROM master
    UNION ALL
    SELECT norm_name, start_date, end_date, is_staff FROM historical_deduped
  ),
  months AS (
    SELECT
      LEAST(
        (date_trunc('month', gs)::date + INTERVAL '1 month - 1 day')::date,
        CURRENT_DATE
      ) AS cutoff
    FROM generate_series(
      date_trunc('month', p_from),
      date_trunc('month', CURRENT_DATE),
      INTERVAL '1 month'
    ) AS gs
  )
  SELECT
    mo.cutoff,
    COUNT(DISTINCT s.norm_name) FILTER (WHERE NOT s.is_staff)::integer,
    COUNT(DISTINCT s.norm_name)::integer
  FROM months mo
  LEFT JOIN spans s
    ON s.start_date <= mo.cutoff
   AND (s.end_date IS NULL OR s.end_date >= mo.cutoff)
  GROUP BY mo.cutoff
  ORDER BY mo.cutoff;
$$;

GRANT EXECUTE ON FUNCTION public.get_headcount_monthly(date) TO authenticated;
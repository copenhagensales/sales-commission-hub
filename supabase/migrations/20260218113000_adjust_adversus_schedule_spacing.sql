-- Increase spacing between Adversus integrations sharing credentials
-- to lower concurrent pressure and reduce provider 429 responses.

WITH integration_targets AS (
  SELECT
    di.id,
    lower(di.name) AS integration_name,
    ('dialer-' || left(di.id::text, 8) || '-sync') AS expected_jobname,
    CASE
      WHEN lower(di.name) = 'lovablecph' THEN '1,11,21,31,41,51 * * * *'
      WHEN lower(di.name) = 'relatel_cphsales' THEN '6,16,26,36,46,56 * * * *'
      ELSE NULL
    END AS schedule
  FROM public.dialer_integrations di
  WHERE lower(di.name) IN ('lovablecph', 'relatel_cphsales')
),
updated_jobs AS (
  UPDATE cron.job cj
  SET schedule = it.schedule
  FROM integration_targets it
  WHERE it.schedule IS NOT NULL
    AND cj.jobname = it.expected_jobname
  RETURNING cj.jobid, cj.jobname, cj.schedule
),
updated_configs AS (
  UPDATE public.dialer_integrations di
  SET
    config = jsonb_set(
      COALESCE(di.config, '{}'::jsonb),
      '{sync_schedule}',
      to_jsonb(it.schedule),
      true
    ),
    updated_at = now()
  FROM integration_targets it
  WHERE it.schedule IS NOT NULL
    AND di.id = it.id
  RETURNING di.id
)
SELECT
  (SELECT COUNT(*) FROM updated_jobs) AS cron_jobs_updated,
  (SELECT COUNT(*) FROM updated_configs) AS integration_configs_updated;

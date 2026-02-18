-- Stagger dialer cron schedules to reduce provider-level API contention
-- and persist a wider sync window for ASE.

WITH integration_targets AS (
  SELECT
    di.id,
    lower(di.name) AS integration_name,
    di.provider,
    ('dialer-' || left(di.id::text, 8) || '-sync') AS expected_jobname,
    CASE
      WHEN lower(di.name) = 'lovablecph' THEN '1,6,11,16,21,26,31,36,41,46,51,56 * * * *'
      WHEN lower(di.name) = 'relatel_cphsales' THEN '3,8,13,18,23,28,33,38,43,48,53,58 * * * *'
      WHEN lower(di.name) = 'eesy' THEN '0,5,10,15,20,25,30,35,40,45,50,55 * * * *'
      WHEN lower(di.name) = 'tryg' THEN '2,7,12,17,22,27,32,37,42,47,52,57 * * * *'
      WHEN lower(di.name) = 'ase' THEN '4,9,14,19,24,29,34,39,44,49,54,59 * * * *'
      ELSE NULL
    END AS new_schedule
  FROM public.dialer_integrations di
  WHERE lower(di.name) IN ('lovablecph', 'relatel_cphsales', 'eesy', 'tryg', 'ase')
),
updated_jobs AS (
  UPDATE cron.job cj
  SET schedule = it.new_schedule
  FROM integration_targets it
  WHERE it.new_schedule IS NOT NULL
    AND cj.jobname = it.expected_jobname
  RETURNING cj.jobid, cj.jobname, cj.schedule
)
SELECT COUNT(*) AS cron_jobs_updated
FROM updated_jobs;

-- Persist ASE sync window in integration config so new schedules keep days=3.
UPDATE public.dialer_integrations
SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{sync_days}', '3'::jsonb, true),
    updated_at = now()
WHERE lower(name) = 'ase';

-- Add menu_reports_daily permission to all positions that have menu_reports_admin
-- This ensures existing users don't lose access to Dagsrapporter

UPDATE job_positions
SET permissions = jsonb_set(
  permissions,
  '{menu_reports_daily}',
  'true'::jsonb
)
WHERE permissions ? 'menu_reports_admin'
  AND permissions->>'menu_reports_admin' = 'true'
  AND NOT (permissions ? 'menu_reports_daily');
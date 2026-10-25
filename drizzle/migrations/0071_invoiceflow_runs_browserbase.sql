ALTER TABLE public.invoiceflow_runs ADD COLUMN browserbase_session_id text;
ALTER TABLE public.invoiceflow_runs ADD COLUMN live_view_expires_at timestamptz;
COMMENT ON COLUMN public.invoiceflow_runs.browserbase_session_id IS 'Browserbase-session for kørslen (replay). Live View-URL gemmes aldrig; den hentes fra Browserbase ved hvert kald.';
COMMENT ON COLUMN public.invoiceflow_runs.live_view_expires_at IS 'Udløb for engangskode-ventetid (15 min). NULL når der ikke ventes.';
CREATE TABLE IF NOT EXISTS public.weekly_lead_closure_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.weekly_lead_closure_runs(id) ON DELETE CASCADE,
  account text NOT NULL,
  campaign_id text NOT NULL,
  weeks jsonb NOT NULL DEFAULT '[]'::jsonb,
  week_start date,
  week_end date,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_page integer NOT NULL DEFAULT 1,
  leads_scanned integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_lead_closure_jobs_status_check
    CHECK (status IN ('pending', 'running', 'done', 'error')),
  CONSTRAINT weekly_lead_closure_jobs_unique UNIQUE (run_id, account, campaign_id)
);

GRANT SELECT ON public.weekly_lead_closure_jobs TO authenticated;
GRANT ALL ON public.weekly_lead_closure_jobs TO service_role;

ALTER TABLE public.weekly_lead_closure_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_lead_closure_jobs_view"
ON public.weekly_lead_closure_jobs
FOR SELECT
TO authenticated
USING (public.effective_is_teamleder_or_above());

CREATE INDEX IF NOT EXISTS weekly_lead_closure_jobs_run_status_idx
ON public.weekly_lead_closure_jobs (run_id, status, created_at);

CREATE OR REPLACE FUNCTION public.weekly_lead_closure_take_job(_run_id uuid)
RETURNS public.weekly_lead_closure_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _job public.weekly_lead_closure_jobs;
BEGIN
  UPDATE public.weekly_lead_closure_jobs j
  SET status = 'running', attempts = j.attempts + 1, updated_at = now()
  WHERE j.id = (
    SELECT id FROM public.weekly_lead_closure_jobs
    WHERE run_id = _run_id AND status = 'pending'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING j.* INTO _job;
  RETURN _job;
END;
$$;

UPDATE public.weekly_lead_closure_runs
SET finished_at = now(),
    error = COALESCE(error, 'afbrudt: timeout før opdeling')
WHERE finished_at IS NULL;
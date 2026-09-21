CREATE TABLE public.weekly_lead_closure_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.weekly_lead_closure_runs(id) ON DELETE CASCADE,
  account text NOT NULL,
  campaign_id text NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_page integer NOT NULL DEFAULT 1,
  leads_scanned integer NOT NULL DEFAULT 0,
  error text,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_lead_closure_tasks_status_check
    CHECK (status IN ('pending', 'running', 'done', 'error')),
  CONSTRAINT weekly_lead_closure_tasks_unique
    UNIQUE (run_id, account, campaign_id, week_start)
);

GRANT SELECT ON public.weekly_lead_closure_tasks TO authenticated;
GRANT ALL ON public.weekly_lead_closure_tasks TO service_role;

ALTER TABLE public.weekly_lead_closure_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_lead_closure_tasks_view"
ON public.weekly_lead_closure_tasks
FOR SELECT
TO authenticated
USING (public.effective_is_teamleder_or_above());

CREATE INDEX weekly_lead_closure_tasks_run_status_idx
ON public.weekly_lead_closure_tasks (run_id, status, created_at);

CREATE OR REPLACE FUNCTION public.weekly_lead_closure_take_task(_run_id uuid)
RETURNS public.weekly_lead_closure_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _task public.weekly_lead_closure_tasks;
BEGIN
  UPDATE public.weekly_lead_closure_tasks t
  SET status = 'pending',
      error = COALESCE(t.error, 'genoptaget efter afbrudt kald'),
      updated_at = now()
  WHERE t.run_id = _run_id
    AND t.status = 'running'
    AND t.claimed_at < now() - interval '2 minutes'
    AND t.attempts < 3;

  UPDATE public.weekly_lead_closure_tasks t
  SET status = 'error',
      error = COALESCE(t.error, 'afbrudt efter 3 forsøg'),
      updated_at = now()
  WHERE t.run_id = _run_id
    AND t.status = 'running'
    AND t.claimed_at < now() - interval '2 minutes'
    AND t.attempts >= 3;

  UPDATE public.weekly_lead_closure_tasks t
  SET status = 'running',
      attempts = t.attempts + 1,
      claimed_at = now(),
      updated_at = now()
  WHERE t.id = (
    SELECT id
    FROM public.weekly_lead_closure_tasks
    WHERE run_id = _run_id AND status = 'pending'
    ORDER BY week_start, account, campaign_id, created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING t.* INTO _task;

  RETURN _task;
END;
$$;

REVOKE ALL ON FUNCTION public.weekly_lead_closure_take_task(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.weekly_lead_closure_take_task(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.weekly_lead_closure_take_task(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_lead_closure_take_task(uuid) TO service_role;

WITH hanging AS (
  SELECT id
  FROM public.weekly_lead_closure_runs
  WHERE finished_at IS NULL
    AND started_at >= date_trunc('day', now())
  ORDER BY started_at
  LIMIT 4
)
UPDATE public.weekly_lead_closure_runs r
SET finished_at = now(),
    error = 'timeout – afløst af opdelt kørsel'
FROM hanging h
WHERE r.id = h.id;
CREATE TABLE IF NOT EXISTS public.gdpr_cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  records_affected integer NOT NULL DEFAULT 0,
  details jsonb,
  triggered_by text
);

ALTER TABLE public.gdpr_cleanup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view cleanup log"
ON public.gdpr_cleanup_log FOR SELECT
TO authenticated
USING (public.is_owner(auth.uid()));

CREATE POLICY "Authenticated can insert cleanup log"
ON public.gdpr_cleanup_log FOR INSERT
TO authenticated
WITH CHECK (true);
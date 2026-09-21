CREATE TABLE public.weekly_lead_call_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start date NOT NULL,
  account text NOT NULL,
  campaign_id text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  answered integer NOT NULL DEFAULT 0,
  leads_dialed integer NOT NULL DEFAULT 0,
  leads_answered integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_lead_call_stats_unique UNIQUE (week_start, account, campaign_id),
  CONSTRAINT weekly_lead_call_stats_account_check CHECK (account IN ('main','lederne','enreach'))
);

GRANT SELECT ON public.weekly_lead_call_stats TO authenticated;
GRANT ALL ON public.weekly_lead_call_stats TO service_role;

ALTER TABLE public.weekly_lead_call_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teamleder og opefter kan se opkaldstal"
ON public.weekly_lead_call_stats FOR SELECT TO authenticated
USING (public.effective_is_teamleder_or_above());

CREATE INDEX weekly_lead_call_stats_week_idx
ON public.weekly_lead_call_stats (week_start, account, campaign_id);

CREATE TRIGGER weekly_lead_call_stats_updated_at
BEFORE UPDATE ON public.weekly_lead_call_stats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Idempotent skriv: én række pr. uge, konto og kampagne. Genkørsel overskriver.
CREATE OR REPLACE FUNCTION public.weekly_lead_call_stats_set(
  _week_start date,
  _account text,
  _campaign_id text,
  _attempts integer,
  _answered integer,
  _leads_dialed integer,
  _leads_answered integer
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.weekly_lead_call_stats AS t
    (week_start, account, campaign_id, attempts, answered, leads_dialed, leads_answered)
  VALUES (_week_start, _account, _campaign_id, _attempts, _answered, _leads_dialed, _leads_answered)
  ON CONFLICT (week_start, account, campaign_id) DO UPDATE
    SET attempts = EXCLUDED.attempts,
        answered = EXCLUDED.answered,
        leads_dialed = EXCLUDED.leads_dialed,
        leads_answered = EXCLUDED.leads_answered,
        updated_at = now();
$$;

REVOKE ALL ON FUNCTION public.weekly_lead_call_stats_set(date, text, text, integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.weekly_lead_call_stats_set(date, text, text, integer, integer, integer, integer) TO service_role;

ALTER TABLE public.weekly_lead_closure_tasks
  ADD COLUMN IF NOT EXISTS calls_done boolean NOT NULL DEFAULT false;
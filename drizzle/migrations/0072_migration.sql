CREATE TABLE public.weekly_lead_closure_locks (
  week_start date PRIMARY KEY,
  locked_at timestamptz NOT NULL DEFAULT now(),
  run_id uuid,
  unlocked_until timestamptz,
  unlocked_by_run uuid,
  unlock_order text
);
GRANT ALL ON public.weekly_lead_closure_locks TO service_role;
ALTER TABLE public.weekly_lead_closure_locks ENABLE ROW LEVEL SECURITY;
-- Ingen regler for authenticated/anon: kun edge-funktionen (service_role) læser og skriver.

ALTER TABLE public.weekly_lead_closure_runs ADD COLUMN IF NOT EXISTS unlock_log text;

CREATE OR REPLACE FUNCTION public.weekly_lead_week_lock_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _week date := CASE WHEN TG_OP = 'DELETE' THEN OLD.week_start ELSE NEW.week_start END;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.weekly_lead_closure_locks l
    WHERE l.week_start IN (_week, CASE WHEN TG_OP = 'UPDATE' THEN OLD.week_start ELSE _week END)
      AND (l.unlocked_until IS NULL OR l.unlocked_until < now())
  ) THEN
    RAISE EXCEPTION 'Uge % er låst (mandagsmail sendt) og må ikke ændres', _week;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_weekly_lead_closure_stats_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.weekly_lead_closure_stats
FOR EACH ROW EXECUTE FUNCTION public.weekly_lead_week_lock_guard();

CREATE TRIGGER trg_weekly_lead_call_stats_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.weekly_lead_call_stats
FOR EACH ROW EXECUTE FUNCTION public.weekly_lead_week_lock_guard();
-- Web Push: abonnementer, præferencer og log. Ingen kundedata, ingen beløb/navne i log.
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  deactivated_at timestamptz
);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions(user_id) WHERE is_active;

CREATE TABLE public.push_preferences (
  user_id uuid PRIMARY KEY,
  klub boolean NOT NULL DEFAULT true,
  opstart_flag boolean NOT NULL DEFAULT true,
  missing_one_on_one boolean NOT NULL DEFAULT true,
  compliance boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  push_type text NOT NULL CHECK (push_type IN ('klub','opstart_flag','missing_one_on_one','compliance','test')),
  dedupe_key text,
  status text NOT NULL CHECK (status IN ('sent','failed','skipped_pref','no_subscription','deactivated')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX push_log_dedupe_idx ON public.push_log(user_id, push_type, dedupe_key) WHERE dedupe_key IS NOT NULL AND status = 'sent';
CREATE INDEX push_log_created_idx ON public.push_log(created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.push_preferences TO authenticated;
GRANT SELECT ON public.push_log TO authenticated;
GRANT ALL ON public.push_subscriptions, public.push_preferences, public.push_log TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_sub_own ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY push_sub_superadmin_read ON public.push_subscriptions FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));

CREATE POLICY push_pref_own ON public.push_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY push_pref_superadmin_read ON public.push_preferences FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));

CREATE POLICY push_log_own_read ON public.push_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY push_log_superadmin_read ON public.push_log FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- 30 dages log-retention
CREATE OR REPLACE FUNCTION public.push_log_retention_run()
RETURNS integer LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.push_log WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO public.gdpr_cleanup_log (action, records_affected, details, triggered_by)
  VALUES ('push_log_retention', n, jsonb_build_object('days', 30), 'cron');
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.push_log_retention_run() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('push-log-retention', '17 3 * * *', $$SELECT public.push_log_retention_run();$$);
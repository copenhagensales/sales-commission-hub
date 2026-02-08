-- Database cleanup migration for improved performance

-- 1. Delete login_events older than 30 days (fixes ~218MB bloat)
DELETE FROM public.login_events 
WHERE logged_in_at < NOW() - INTERVAL '30 days';

-- 2. Delete integration_logs older than 30 days
DELETE FROM public.integration_logs 
WHERE created_at < NOW() - INTERVAL '30 days';

-- 3. Truncate integration_debug_log (transient debug data)
TRUNCATE TABLE public.integration_debug_log;

-- 4. Add index on login_events for faster duplicate checks
CREATE INDEX IF NOT EXISTS idx_login_events_user_session 
ON public.login_events (user_id, session_id);

-- 5. Add index on login_events logged_in_at for faster cleanup queries
CREATE INDEX IF NOT EXISTS idx_login_events_logged_in_at 
ON public.login_events (logged_in_at);
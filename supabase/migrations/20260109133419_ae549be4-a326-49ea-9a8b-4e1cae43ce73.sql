-- Add index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_login_events_user_id ON public.login_events (user_id);

-- Delete old login events (older than 30 days) to reduce table size
DELETE FROM public.login_events 
WHERE logged_in_at < NOW() - INTERVAL '30 days';
select cron.schedule(
  'send-contract-compliance-digest-daily',
  '15 8 * * *',
  $$
  SELECT net.http_post(
    url:='https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/send-contract-compliance-digest',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bGltbWVpanBmbWFrc3ZtdXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NzQ1MjMsImV4cCI6MjA4MDI1MDUyM30.LbC-t03QXt5FJUHyD5fVff3OHdqYv7uWD-tFOBNyOVI"}'::jsonb,
    body:='{"source": "cron"}'::jsonb
  ) as request_id;
  $$
);
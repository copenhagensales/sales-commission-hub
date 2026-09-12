INSERT INTO public.email_templates (name, template_key, subject, content)
SELECT 'Fareflag: nye saelgere', 'ramp_risk_flag',
       'Nye saelgere der har brug for en haand',
       'Indhold genereres automatisk pr. leder.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE template_key = 'ramp_risk_flag'
);

SELECT cron.schedule(
  'ramp-risk-alert-mail',
  '10 6 * * 1-5',
  $cron$
    SELECT net.http_post(
      url := 'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/send-ramp-risk-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT value FROM private.internal_secrets WHERE name = 'cron_secret')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $cron$
);
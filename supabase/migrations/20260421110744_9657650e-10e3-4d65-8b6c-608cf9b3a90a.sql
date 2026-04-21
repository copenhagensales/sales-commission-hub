UPDATE public.dialer_integrations
SET config = jsonb_set(
  config,
  '{allowedAgentEmailDomains}',
  '["@copenhagensales.dk"]'::jsonb
)
WHERE id = '48d8bd23-df14-41fe-b000-abb8a4d6cd1d';
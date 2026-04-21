UPDATE public.dialer_integrations
SET config = jsonb_set(
  jsonb_set(
    config #- '{productExtraction,dataFilters}',
    '{allowedAgentEmailDomains}',
    '["@tryg.dk", "@alka.dk", "@copenhagensales.dk", "@cph-relatel.dk", "@cph-sales.dk"]'::jsonb
  ),
  '{enableUserPreFetch}',
  'true'::jsonb
)
WHERE id = '48d8bd23-df14-41fe-b000-abb8a4d6cd1d';
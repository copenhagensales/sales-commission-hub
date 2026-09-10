ALTER TABLE public.supplier_report_subscriptions
  DROP CONSTRAINT supplier_report_subscriptions_report_type_check,
  DROP CONSTRAINT supplier_report_subscriptions_cadence_check,
  DROP CONSTRAINT supplier_report_subscriptions_type_fields_check;

ALTER TABLE public.supplier_report_subscriptions
  ADD CONSTRAINT supplier_report_subscriptions_report_type_check
    CHECK (report_type = ANY (ARRAY['supplier_invoice'::text, 'client_week_plan'::text, 'client_daily_sales'::text])),
  ADD CONSTRAINT supplier_report_subscriptions_cadence_check
    CHECK (cadence = ANY (ARRAY['monthly'::text, 'weekly'::text, 'daily'::text])),
  ADD CONSTRAINT supplier_report_subscriptions_type_fields_check
    CHECK (
      (report_type = 'supplier_invoice' AND location_type IS NOT NULL)
      OR (report_type = 'client_week_plan' AND client_id IS NOT NULL AND weekday IS NOT NULL)
      OR (report_type = 'client_daily_sales' AND client_id IS NOT NULL)
    );

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS client_display_name text NULL;

INSERT INTO public.supplier_report_subscriptions
  (name, report_type, cadence, client_id, location_type, weekday, send_hour, attach_xlsx, is_active, recipient_email)
SELECT 'Daglig salgsrapport - Eesy FM', 'client_daily_sales', 'daily', '9a92ea4c-6404-4b58-be08-065e7552d552'::uuid, NULL, NULL, 8, false, false, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.supplier_report_subscriptions
  WHERE report_type = 'client_daily_sales' AND client_id = '9a92ea4c-6404-4b58-be08-065e7552d552'::uuid
);

INSERT INTO public.supplier_report_subscriptions
  (name, report_type, cadence, client_id, location_type, weekday, send_hour, attach_xlsx, is_active, recipient_email)
SELECT 'Daglig salgsrapport - Yousee', 'client_daily_sales', 'daily', c.id, NULL, NULL, 8, false, false, NULL
FROM public.clients c
WHERE c.name = 'Yousee'
  AND NOT EXISTS (
    SELECT 1 FROM public.supplier_report_subscriptions s
    WHERE s.report_type = 'client_daily_sales' AND s.client_id = c.id
  );
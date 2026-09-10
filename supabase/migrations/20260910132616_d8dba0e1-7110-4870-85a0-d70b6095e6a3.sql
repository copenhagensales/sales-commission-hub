
ALTER TABLE public.supplier_report_subscriptions
  ADD COLUMN report_type text NOT NULL DEFAULT 'supplier_invoice',
  ADD COLUMN client_id uuid NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  ADD COLUMN cadence text NOT NULL DEFAULT 'monthly',
  ADD COLUMN weekday int NULL;

ALTER TABLE public.supplier_report_subscriptions
  ALTER COLUMN location_type DROP NOT NULL;

UPDATE public.supplier_report_subscriptions
  SET report_type = 'supplier_invoice', cadence = 'monthly'
  WHERE report_type IS NULL OR report_type = 'supplier_invoice';

ALTER TABLE public.supplier_report_subscriptions
  ADD CONSTRAINT supplier_report_subscriptions_report_type_check
    CHECK (report_type IN ('supplier_invoice','client_week_plan')),
  ADD CONSTRAINT supplier_report_subscriptions_cadence_check
    CHECK (cadence IN ('monthly','weekly')),
  ADD CONSTRAINT supplier_report_subscriptions_weekday_check
    CHECK (weekday IS NULL OR (weekday >= 1 AND weekday <= 7)),
  ADD CONSTRAINT supplier_report_subscriptions_type_fields_check
    CHECK (
      (report_type = 'supplier_invoice' AND location_type IS NOT NULL)
      OR
      (report_type = 'client_week_plan' AND client_id IS NOT NULL AND weekday IS NOT NULL)
    );

ALTER TABLE public.supplier_report_dispatches
  DROP CONSTRAINT IF EXISTS supplier_report_dispatches_status_check;

ALTER TABLE public.supplier_report_dispatches
  ADD CONSTRAINT supplier_report_dispatches_status_check
    CHECK (status IN ('pending_approval','approved','sent','failed','cancelled','skipped'));

INSERT INTO public.supplier_report_subscriptions
  (name, location_type, report_type, cadence, client_id, weekday, send_day, send_hour,
   attach_xlsx, include_surcharge_summary, is_active, recipient_email)
VALUES
  ('Ugeplan - Eesy FM', NULL, 'client_week_plan', 'weekly',
   '9a92ea4c-6404-4b58-be08-065e7552d552', 1, 1, 8, false, false, false, NULL),
  ('Ugeplan - Yousee', NULL, 'client_week_plan', 'weekly',
   (SELECT id FROM public.clients WHERE name = 'Yousee' LIMIT 1), 1, 1, 8, false, false, false, NULL);

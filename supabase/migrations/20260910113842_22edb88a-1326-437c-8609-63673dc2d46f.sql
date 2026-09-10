CREATE TABLE public.supplier_report_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  location_type text NOT NULL,
  recipient_name text,
  recipient_email text,
  cc_emails text[] NOT NULL DEFAULT '{}',
  approver_employee_id uuid NULL REFERENCES public.employee_master_data(id) ON DELETE SET NULL,
  send_day int NOT NULL DEFAULT 1 CHECK (send_day >= 1 AND send_day <= 28),
  send_hour int NOT NULL DEFAULT 8 CHECK (send_hour >= 0 AND send_hour <= 23),
  period_mode text NOT NULL DEFAULT 'previous_month',
  attach_xlsx boolean NOT NULL DEFAULT true,
  include_surcharge_summary boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_report_subscriptions TO authenticated;
GRANT ALL ON public.supplier_report_subscriptions TO service_role;
ALTER TABLE public.supplier_report_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view report subscriptions"
ON public.supplier_report_subscriptions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners and managers can manage report subscriptions"
ON public.supplier_report_subscriptions FOR ALL TO authenticated
USING (is_teamleder_or_above(auth.uid()))
WITH CHECK (is_teamleder_or_above(auth.uid()));

CREATE TABLE public.supplier_report_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.supplier_report_subscriptions(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  report_id uuid NULL REFERENCES public.supplier_invoice_reports(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval','approved','sent','failed','cancelled')),
  approved_by uuid,
  approved_at timestamptz,
  sent_at timestamptz,
  sent_to text[],
  error_message text,
  reminder_count int NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, period_start)
);

CREATE INDEX idx_supplier_report_dispatches_status
  ON public.supplier_report_dispatches (status, period_start);

GRANT SELECT, INSERT, UPDATE ON public.supplier_report_dispatches TO authenticated;
GRANT ALL ON public.supplier_report_dispatches TO service_role;
ALTER TABLE public.supplier_report_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view report dispatches"
ON public.supplier_report_dispatches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners and managers can manage report dispatches"
ON public.supplier_report_dispatches FOR ALL TO authenticated
USING (is_teamleder_or_above(auth.uid()))
WITH CHECK (is_teamleder_or_above(auth.uid()));

CREATE TRIGGER update_supplier_report_subscriptions_updated_at
BEFORE UPDATE ON public.supplier_report_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_report_dispatches_updated_at
BEFORE UPDATE ON public.supplier_report_dispatches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.supplier_report_subscriptions
  (name, location_type, send_day, send_hour, is_active, recipient_email)
VALUES
  ('Coop butik - Eesy FM', 'Coop butik', 1, 8, false, NULL);
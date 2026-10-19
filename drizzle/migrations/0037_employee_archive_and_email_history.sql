ALTER TABLE public.employee_master_data
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_into_employee_id uuid REFERENCES public.employee_master_data(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_start_date date,
  ADD COLUMN IF NOT EXISTS original_start_date_derived boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employee_master_data.archived_at IS 'Kort arkiveret (flettet/tomt dublet). Kortet bevares for historik.';
COMMENT ON COLUMN public.employee_master_data.merged_into_employee_id IS 'Det beholdte kort, som dette kort er flettet ind i.';
COMMENT ON COLUMN public.employee_master_data.original_start_date IS 'Første ansættelses startdato ved genansættelse.';
COMMENT ON COLUMN public.employee_master_data.original_start_date_derived IS 'true = original_start_date er udledt (fx af første salg), ikke dokumenteret.';

CREATE TABLE public.employee_work_email_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  work_email text NOT NULL,
  valid_from date,
  valid_to date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX employee_work_email_history_email_idx ON public.employee_work_email_history (lower(work_email));
CREATE INDEX employee_work_email_history_employee_idx ON public.employee_work_email_history (employee_id);

GRANT SELECT ON public.employee_work_email_history TO authenticated;
GRANT ALL ON public.employee_work_email_history TO service_role;
ALTER TABLE public.employee_work_email_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Se mailhistorik for kort man må se"
  ON public.employee_work_email_history FOR SELECT TO authenticated
  USING (public.can_view_employee(employee_id, auth.uid()));
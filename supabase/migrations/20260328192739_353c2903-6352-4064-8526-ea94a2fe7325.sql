
CREATE TABLE public.contract_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  access_type text NOT NULL DEFAULT 'view',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert contract access logs"
  ON public.contract_access_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can read contract access logs"
  ON public.contract_access_log FOR SELECT TO authenticated
  USING (public.is_owner(auth.uid()));

CREATE INDEX idx_contract_access_log_contract ON public.contract_access_log(contract_id);
CREATE INDEX idx_contract_access_log_created ON public.contract_access_log(created_at DESC);

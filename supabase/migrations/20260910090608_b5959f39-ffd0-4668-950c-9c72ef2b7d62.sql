CREATE TABLE public.client_agreement_hidden_clients (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  hidden_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.client_agreement_hidden_clients TO authenticated;
GRANT ALL ON public.client_agreement_hidden_clients TO service_role;

ALTER TABLE public.client_agreement_hidden_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aftaleansvarlige kan se skjulte kunder"
ON public.client_agreement_hidden_clients
FOR SELECT
TO authenticated
USING (public.can_manage_dpa_documents(auth.uid()));

CREATE POLICY "Aftaleansvarlige kan skjule kunder"
ON public.client_agreement_hidden_clients
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_dpa_documents(auth.uid()));

CREATE POLICY "Aftaleansvarlige kan gendanne kunder"
ON public.client_agreement_hidden_clients
FOR DELETE
TO authenticated
USING (public.can_manage_dpa_documents(auth.uid()));
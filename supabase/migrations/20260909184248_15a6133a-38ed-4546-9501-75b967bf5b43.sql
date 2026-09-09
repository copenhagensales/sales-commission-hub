CREATE TABLE public.client_agreement_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('dpa','contract')),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  content_type text,
  note text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_agreement_documents_client ON public.client_agreement_documents(client_id, doc_type);

GRANT SELECT, INSERT, DELETE ON public.client_agreement_documents TO authenticated;
GRANT ALL ON public.client_agreement_documents TO service_role;

ALTER TABLE public.client_agreement_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view client agreements"
ON public.client_agreement_documents FOR SELECT TO authenticated
USING (public.can_manage_dpa_documents(auth.uid()));

CREATE POLICY "Managers can add client agreements"
ON public.client_agreement_documents FOR INSERT TO authenticated
WITH CHECK (public.can_manage_dpa_documents(auth.uid()));

CREATE POLICY "Managers can delete client agreements"
ON public.client_agreement_documents FOR DELETE TO authenticated
USING (public.can_manage_dpa_documents(auth.uid()));

CREATE POLICY "Managers can read client agreement files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client-agreements' AND public.can_manage_dpa_documents(auth.uid()));

CREATE POLICY "Managers can upload client agreement files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client-agreements' AND public.can_manage_dpa_documents(auth.uid()));

CREATE POLICY "Managers can delete client agreement files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'client-agreements' AND public.can_manage_dpa_documents(auth.uid()));
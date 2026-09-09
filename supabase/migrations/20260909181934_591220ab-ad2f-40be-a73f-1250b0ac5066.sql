CREATE TABLE public.dpa_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_size bigint,
  content_type text,
  note text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dpa_documents_vendor ON public.dpa_documents (vendor, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpa_documents TO authenticated;
GRANT ALL ON public.dpa_documents TO service_role;

ALTER TABLE public.dpa_documents ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_dpa_documents(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.is_owner(_user_id), false) OR EXISTS (
    SELECT 1
    FROM public.superadmins s
    JOIN auth.users u ON lower(u.email) = lower(s.email)
    WHERE u.id = _user_id AND s.is_active = true
  );
$$;

CREATE POLICY "Owners and superadmins can view dpa documents"
ON public.dpa_documents FOR SELECT TO authenticated
USING (public.can_manage_dpa_documents(auth.uid()));

CREATE POLICY "Owners and superadmins can add dpa documents"
ON public.dpa_documents FOR INSERT TO authenticated
WITH CHECK (public.can_manage_dpa_documents(auth.uid()));

CREATE POLICY "Owners and superadmins can update dpa documents"
ON public.dpa_documents FOR UPDATE TO authenticated
USING (public.can_manage_dpa_documents(auth.uid()))
WITH CHECK (public.can_manage_dpa_documents(auth.uid()));

CREATE POLICY "Owners and superadmins can delete dpa documents"
ON public.dpa_documents FOR DELETE TO authenticated
USING (public.can_manage_dpa_documents(auth.uid()));

CREATE POLICY "Owners and superadmins can read dpa files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dpa-documents' AND public.can_manage_dpa_documents(auth.uid()));

CREATE POLICY "Owners and superadmins can upload dpa files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dpa-documents' AND public.can_manage_dpa_documents(auth.uid()));

CREATE POLICY "Owners and superadmins can delete dpa files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'dpa-documents' AND public.can_manage_dpa_documents(auth.uid()));
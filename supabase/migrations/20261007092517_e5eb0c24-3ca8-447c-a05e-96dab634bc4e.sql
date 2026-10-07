CREATE OR REPLACE FUNCTION public.dpa_addenda_lock()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'draft' AND OLD.sent_at IS NULL AND OLD.approved_at IS NULL AND OLD.signed_pdf_path IS NULL THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Kun kladder, der ikke er sendt, kan slettes';
  END IF;
  IF NEW.client_id <> OLD.client_id OR NEW.version <> OLD.version OR NEW.content <> OLD.content
     OR NEW.pdf_path <> OLD.pdf_path OR NEW.created_at <> OLD.created_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Et låst tillæg kan ikke ændres — generér en ny version';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $function$;

GRANT DELETE ON public.dpa_addenda TO authenticated;
CREATE POLICY "Superadmins delete draft dpa_addenda" ON public.dpa_addenda FOR DELETE TO authenticated
  USING (public.is_superadmin(auth.uid()) AND status = 'draft');

CREATE POLICY "Superadmins delete dpa-addenda files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dpa-addenda' AND public.is_superadmin(auth.uid()));
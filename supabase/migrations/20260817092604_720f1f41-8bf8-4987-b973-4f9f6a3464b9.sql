DROP POLICY IF EXISTS "Owners can delete workstations" ON public.it_workstations;
CREATE POLICY "IT staff can delete workstations"
ON public.it_workstations
FOR DELETE
TO authenticated
USING (public.has_it_access(auth.uid()));

DROP POLICY IF EXISTS "Owners can delete equipment" ON public.it_equipment;
CREATE POLICY "IT staff can delete equipment"
ON public.it_equipment
FOR DELETE
TO authenticated
USING (public.has_it_access(auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS it_workstations_code_key ON public.it_workstations (code);
-- Allow deleting from cancellation_queue where status is not approved
CREATE POLICY "Allow delete non-approved queue items" ON public.cancellation_queue
  FOR DELETE TO authenticated
  USING (status != 'approved');

-- Allow deleting cancellation_imports
CREATE POLICY "Allow delete cancellation imports" ON public.cancellation_imports
  FOR DELETE TO authenticated
  USING (true);
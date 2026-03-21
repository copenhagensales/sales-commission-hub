CREATE POLICY "Authenticated users can delete uploads"
ON public.sales_validation_uploads
FOR DELETE
TO authenticated
USING (true);
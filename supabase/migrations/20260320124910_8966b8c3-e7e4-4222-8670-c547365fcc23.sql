CREATE POLICY "Authenticated users can delete inquiries"
ON public.customer_inquiries
FOR DELETE
TO authenticated
USING (true);
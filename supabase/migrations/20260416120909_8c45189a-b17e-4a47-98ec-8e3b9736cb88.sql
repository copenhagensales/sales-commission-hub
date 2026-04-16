
DROP POLICY IF EXISTS "Managers and owners can update booking page content" ON public.booking_page_content;

CREATE POLICY "Managers and owners can update booking page content"
  ON public.booking_page_content FOR UPDATE
  TO authenticated
  USING (public.is_teamleder_or_above(auth.uid()))
  WITH CHECK (public.is_teamleder_or_above(auth.uid()));

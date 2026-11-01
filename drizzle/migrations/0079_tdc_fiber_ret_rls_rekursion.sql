CREATE OR REPLACE FUNCTION public.tdc_fiber_salg_har_linjer(p_sale_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.sale_items x WHERE x.sale_id = p_sale_id);
END;
$$;

DROP POLICY "TDC fiber admins kan oprette salgslinje" ON public.sale_items;
CREATE POLICY "TDC fiber admins kan oprette salgslinje" ON public.sale_items
FOR INSERT TO authenticated
WITH CHECK (public.tdc_fiber_er_admin() AND EXISTS (
  SELECT 1 FROM public.sales s
  WHERE s.id = sale_items.sale_id AND s.source = 'tdc_fiber_manual'
    AND (s.sale_datetime)::date = ((now() AT TIME ZONE 'Europe/Copenhagen'))::date
    AND NOT public.tdc_fiber_salg_har_linjer(s.id)));

DROP POLICY "TDC fiber admins kan oprette salgslinje for saelger" ON public.sale_items;
CREATE POLICY "TDC fiber admins kan oprette salgslinje for saelger" ON public.sale_items
FOR INSERT TO authenticated
WITH CHECK (public.tdc_fiber_er_admin() AND EXISTS (
  SELECT 1 FROM public.sales s
  WHERE s.id = sale_items.sale_id AND s.source = 'tdc_fiber_manual'
    AND (s.raw_payload ->> 'oprettet_af_admin') = 'true'
    AND ((s.sale_datetime AT TIME ZONE 'Europe/Copenhagen'))::date >= public.tdc_fiber_periode_start()
    AND NOT public.tdc_fiber_salg_har_linjer(s.id)));

DROP POLICY "TDC fiber saelgere kan oprette salgslinjer" ON public.sale_items;
CREATE POLICY "TDC fiber saelgere kan oprette salgslinjer" ON public.sale_items
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sales s
  WHERE s.id = sale_items.sale_id AND s.source = 'tdc_fiber_manual'
    AND (s.raw_payload ->> 'registreret_af') = (public.effective_employee_id())::text
    AND s.created_at > (now() - interval '10 minutes')
    AND NOT public.tdc_fiber_salg_har_linjer(s.id)));
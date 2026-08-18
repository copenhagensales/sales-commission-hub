CREATE OR REPLACE FUNCTION public.can_edit_tdc_erhverv_sales(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_owner(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.employee_master_data e
      JOIN public.job_positions jp ON jp.id = e.position_id
      JOIN public.role_page_permissions rpp ON rpp.role_key = jp.system_role_key
      WHERE e.auth_user_id = _user_id
        AND e.is_active = true
        AND rpp.permission_key = 'menu_reports_tdc_edit_sales'
        AND (rpp.can_view = true OR rpp.can_edit = true)
    )
$$;

CREATE OR REPLACE FUNCTION public.sale_is_tdc_erhverv(_sale_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sales s
    JOIN public.client_campaigns cc ON cc.id = s.client_campaign_id
    WHERE s.id = _sale_id
      AND cc.client_id = '20744525-7466-4b2c-afa7-6ee09a9112b0'::uuid
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_edit_tdc_erhverv_sales(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sale_is_tdc_erhverv(uuid) TO authenticated;

CREATE POLICY "TDC support can view TDC Erhverv sales"
  ON public.sales FOR SELECT TO authenticated
  USING (public.can_edit_tdc_erhverv_sales(auth.uid()) AND public.sale_is_tdc_erhverv(id));

CREATE POLICY "TDC support can update TDC Erhverv sales"
  ON public.sales FOR UPDATE TO authenticated
  USING (public.can_edit_tdc_erhverv_sales(auth.uid()) AND public.sale_is_tdc_erhverv(id))
  WITH CHECK (public.can_edit_tdc_erhverv_sales(auth.uid()) AND public.sale_is_tdc_erhverv(id));

CREATE POLICY "TDC support can delete TDC Erhverv sales"
  ON public.sales FOR DELETE TO authenticated
  USING (public.can_edit_tdc_erhverv_sales(auth.uid()) AND public.sale_is_tdc_erhverv(id));

CREATE POLICY "TDC support can view TDC Erhverv sale_items"
  ON public.sale_items FOR SELECT TO authenticated
  USING (public.can_edit_tdc_erhverv_sales(auth.uid()) AND public.sale_is_tdc_erhverv(sale_id));

CREATE POLICY "TDC support can insert TDC Erhverv sale_items"
  ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_tdc_erhverv_sales(auth.uid()) AND public.sale_is_tdc_erhverv(sale_id));

CREATE POLICY "TDC support can update TDC Erhverv sale_items"
  ON public.sale_items FOR UPDATE TO authenticated
  USING (public.can_edit_tdc_erhverv_sales(auth.uid()) AND public.sale_is_tdc_erhverv(sale_id))
  WITH CHECK (public.can_edit_tdc_erhverv_sales(auth.uid()) AND public.sale_is_tdc_erhverv(sale_id));

CREATE POLICY "TDC support can delete TDC Erhverv sale_items"
  ON public.sale_items FOR DELETE TO authenticated
  USING (public.can_edit_tdc_erhverv_sales(auth.uid()) AND public.sale_is_tdc_erhverv(sale_id));
CREATE OR REPLACE FUNCTION public.can_edit_tryg_sales(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_owner(_user_id)
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = _user_id
        AND lower(u.email) IN ('fk@copenhagensales.dk','filipkirketerp@gmail.com','anni@copenhagensales.dk','sondergaardannika@gmail.com')
    )
$$;

CREATE OR REPLACE FUNCTION public.sale_is_united_client(_sale_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sales s
    JOIN public.client_campaigns cc ON cc.id = s.client_campaign_id
    JOIN public.team_clients tc ON tc.client_id = cc.client_id
    JOIN public.teams t ON t.id = tc.team_id
    WHERE s.id = _sale_id AND t.name ILIKE '%united%'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_edit_tryg_sales(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sale_is_united_client(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_edit_tryg_sales(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sale_is_united_client(uuid) TO authenticated;

CREATE POLICY "Tryg editors can view United sales" ON public.sales FOR SELECT TO authenticated
  USING (public.can_edit_tryg_sales(auth.uid()) AND public.sale_is_united_client(id));
CREATE POLICY "Tryg editors can update United sales" ON public.sales FOR UPDATE TO authenticated
  USING (public.can_edit_tryg_sales(auth.uid()) AND public.sale_is_united_client(id))
  WITH CHECK (public.can_edit_tryg_sales(auth.uid()) AND public.sale_is_united_client(id));
CREATE POLICY "Tryg editors can delete United sales" ON public.sales FOR DELETE TO authenticated
  USING (public.can_edit_tryg_sales(auth.uid()) AND public.sale_is_united_client(id));

CREATE POLICY "Tryg editors can view United sale_items" ON public.sale_items FOR SELECT TO authenticated
  USING (public.can_edit_tryg_sales(auth.uid()) AND public.sale_is_united_client(sale_id));
CREATE POLICY "Tryg editors can update United sale_items" ON public.sale_items FOR UPDATE TO authenticated
  USING (public.can_edit_tryg_sales(auth.uid()) AND public.sale_is_united_client(sale_id))
  WITH CHECK (public.can_edit_tryg_sales(auth.uid()) AND public.sale_is_united_client(sale_id));
CREATE POLICY "Tryg editors can delete United sale_items" ON public.sale_items FOR DELETE TO authenticated
  USING (public.can_edit_tryg_sales(auth.uid()) AND public.sale_is_united_client(sale_id));
-- Relax RBAC policies so any authenticated user can manage key MG mapping tables

-- Allow authenticated users to manage clients
ALTER POLICY "Managers can manage clients" ON public.clients
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to manage client campaigns
ALTER POLICY "Managers can manage client_campaigns" ON public.client_campaigns
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to manage products
ALTER POLICY "Managers can manage products" ON public.products
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to manage Adversus campaign mappings
ALTER POLICY "Managers can manage adversus_campaign_mappings" ON public.adversus_campaign_mappings
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to manage Adversus product mappings
ALTER POLICY "Managers can manage adversus_product_mappings" ON public.adversus_product_mappings
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to manage sales (if needed by other flows)
ALTER POLICY "Managers can manage sales" ON public.sales
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to manage sale_items so we can backfill product_id
ALTER POLICY "Managers can manage sale_items" ON public.sale_items
  TO authenticated
  USING (true)
  WITH CHECK (true);
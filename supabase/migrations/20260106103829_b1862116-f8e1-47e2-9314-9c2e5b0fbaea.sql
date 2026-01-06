-- 1. PRODUCTS
DROP POLICY IF EXISTS "Managers can manage products" ON public.products;

CREATE POLICY "Teamleder can manage products"
ON public.products
FOR ALL
TO authenticated
USING (is_teamleder_or_above(auth.uid()))
WITH CHECK (is_teamleder_or_above(auth.uid()));

-- 2. CLIENTS
DROP POLICY IF EXISTS "Managers can manage clients" ON public.clients;

CREATE POLICY "Teamleder can manage clients"
ON public.clients
FOR ALL
TO authenticated
USING (is_teamleder_or_above(auth.uid()))
WITH CHECK (is_teamleder_or_above(auth.uid()));

-- 3. CLIENT_CAMPAIGNS
DROP POLICY IF EXISTS "Managers can manage client_campaigns" ON public.client_campaigns;

CREATE POLICY "Teamleder can manage client_campaigns"
ON public.client_campaigns
FOR ALL
TO authenticated
USING (is_teamleder_or_above(auth.uid()))
WITH CHECK (is_teamleder_or_above(auth.uid()));

-- 4. ADVERSUS_CAMPAIGN_MAPPINGS
DROP POLICY IF EXISTS "Managers can manage adversus_campaign_mappings" ON public.adversus_campaign_mappings;

CREATE POLICY "Teamleder can manage adversus_campaign_mappings"
ON public.adversus_campaign_mappings
FOR ALL
TO authenticated
USING (is_teamleder_or_above(auth.uid()))
WITH CHECK (is_teamleder_or_above(auth.uid()));

-- 5. ADVERSUS_PRODUCT_MAPPINGS
DROP POLICY IF EXISTS "Managers can manage adversus_product_mappings" ON public.adversus_product_mappings;

CREATE POLICY "Teamleder can manage adversus_product_mappings"
ON public.adversus_product_mappings
FOR ALL
TO authenticated
USING (is_teamleder_or_above(auth.uid()))
WITH CHECK (is_teamleder_or_above(auth.uid()));
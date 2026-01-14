-- Fase 1: Fjern duplikeret policy på sale_items
DROP POLICY IF EXISTS "Only managers can view sale_items" ON public.sale_items;

-- Fase 2: Opret optimeret SECURITY DEFINER funktion til employee-to-sale matching
CREATE OR REPLACE FUNCTION public.can_view_sale_as_employee(_sale_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM sales s
    JOIN employee_agent_mapping eam ON TRUE
    JOIN agents a ON a.id = eam.agent_id
    JOIN employee_master_data e ON e.id = eam.employee_id
    WHERE s.id = _sale_id
      AND e.auth_user_id = _user_id
      AND (
        LOWER(s.agent_email) = LOWER(a.email) 
        OR s.agent_external_id = a.external_dialer_id
      )
  )
$$;

-- Fase 3: Tilføj kritiske funktionelle indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_agent_email_lower 
ON sales (LOWER(agent_email));

CREATE INDEX IF NOT EXISTS idx_agents_email_lower 
ON agents (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_eam_agent_employee 
ON employee_agent_mapping (agent_id, employee_id);

-- Fase 4: Erstat ineffektive RLS policies på sales
DROP POLICY IF EXISTS "Employees can view own sales" ON public.sales;

CREATE POLICY "Employees can view own sales"
ON public.sales FOR SELECT
TO public
USING (public.can_view_sale_as_employee(id, auth.uid()));

-- Fase 4b: Erstat ineffektive RLS policies på sale_items
DROP POLICY IF EXISTS "Employees can view own sale_items" ON public.sale_items;

CREATE POLICY "Employees can view own sale_items"
ON public.sale_items FOR SELECT
TO public
USING (public.can_view_sale_as_employee(sale_id, auth.uid()));

-- Fase 5: Opdater get_aggregated_product_types til SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_aggregated_product_types()
RETURNS TABLE(
  adversus_external_id text, 
  adversus_product_title text, 
  product_id uuid, 
  product_name text, 
  commission_dkk numeric, 
  revenue_dkk numeric, 
  product_client_campaign_id uuid, 
  counts_as_sale boolean, 
  is_hidden boolean, 
  client_id uuid, 
  client_name text, 
  sale_source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (si.adversus_external_id, si.adversus_product_title)
    si.adversus_external_id,
    si.adversus_product_title,
    si.product_id,
    p.name as product_name,
    p.commission_dkk,
    p.revenue_dkk,
    p.client_campaign_id as product_client_campaign_id,
    COALESCE(p.counts_as_sale, true) as counts_as_sale,
    COALESCE(p.is_hidden, false) as is_hidden,
    COALESCE(cc_prod.client_id, cc_sale.client_id) as client_id,
    c.name as client_name,
    s.source as sale_source
  FROM sale_items si
  LEFT JOIN products p ON p.id = si.product_id
  LEFT JOIN sales s ON s.id = si.sale_id
  LEFT JOIN client_campaigns cc_prod ON cc_prod.id = p.client_campaign_id
  LEFT JOIN client_campaigns cc_sale ON cc_sale.id = s.client_campaign_id
  LEFT JOIN clients c ON c.id = COALESCE(cc_prod.client_id, cc_sale.client_id)
  WHERE si.adversus_product_title IS NOT NULL
  ORDER BY 
    si.adversus_external_id,
    si.adversus_product_title,
    CASE WHEN si.product_id IS NOT NULL THEN 0 ELSE 1 END,
    si.created_at DESC
$$;
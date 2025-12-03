
-- Drop existing tables (clean slate)
DROP TABLE IF EXISTS commission_transactions CASCADE;
DROP TABLE IF EXISTS payroll_lines CASCADE;
DROP TABLE IF EXISTS payroll_runs CASCADE;
DROP TABLE IF EXISTS absences CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS adversus_product_mappings CASCADE;
DROP TABLE IF EXISTS adversus_campaign_mappings CASCADE;
DROP TABLE IF EXISTS adversus_events CASCADE;
DROP TABLE IF EXISTS campaign_product_mappings CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS client_campaigns CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS liquidity_expenses CASCADE;
DROP TABLE IF EXISTS liquidity_customers CASCADE;
DROP TABLE IF EXISTS liquidity_settings CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- 1. CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. CLIENT_CAMPAIGNS
CREATE TABLE public.client_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  external_adversus_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, name)
);

-- 3. PRODUCTS (Master Product List from CSV)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_campaign_id UUID REFERENCES public.client_campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  commission_dkk NUMERIC DEFAULT 0,
  revenue_dkk NUMERIC DEFAULT 0,
  external_product_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ADVERSUS_EVENTS (Raw webhook storage)
CREATE TABLE public.adversus_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'result',
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  received_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(external_id)
);

-- 5. ADVERSUS_CAMPAIGN_MAPPINGS
CREATE TABLE public.adversus_campaign_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adversus_campaign_id TEXT NOT NULL UNIQUE,
  adversus_campaign_name TEXT,
  client_campaign_id UUID REFERENCES public.client_campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. ADVERSUS_PRODUCT_MAPPINGS
CREATE TABLE public.adversus_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adversus_external_id TEXT,
  adversus_product_title TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(adversus_external_id)
);

-- 7. SALES (Sale header)
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adversus_event_id UUID REFERENCES public.adversus_events(id) ON DELETE SET NULL,
  client_campaign_id UUID REFERENCES public.client_campaigns(id) ON DELETE SET NULL,
  agent_name TEXT,
  agent_external_id TEXT,
  customer_company TEXT,
  customer_phone TEXT,
  sale_datetime TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. SALE_ITEMS (Individual products in a sale)
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  adversus_external_id TEXT,
  adversus_product_title TEXT,
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  mapped_commission NUMERIC DEFAULT 0,
  mapped_revenue NUMERIC DEFAULT 0,
  needs_mapping BOOLEAN DEFAULT false,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adversus_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adversus_campaign_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adversus_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to read all, managers can manage
CREATE POLICY "Authenticated users can view clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Managers can manage clients" ON public.clients FOR ALL USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Authenticated users can view client_campaigns" ON public.client_campaigns FOR SELECT USING (true);
CREATE POLICY "Managers can manage client_campaigns" ON public.client_campaigns FOR ALL USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Authenticated users can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Managers can manage products" ON public.products FOR ALL USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Authenticated users can view adversus_events" ON public.adversus_events FOR SELECT USING (true);
CREATE POLICY "Service can insert adversus_events" ON public.adversus_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Managers can manage adversus_events" ON public.adversus_events FOR ALL USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Authenticated users can view adversus_campaign_mappings" ON public.adversus_campaign_mappings FOR SELECT USING (true);
CREATE POLICY "Managers can manage adversus_campaign_mappings" ON public.adversus_campaign_mappings FOR ALL USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Authenticated users can view adversus_product_mappings" ON public.adversus_product_mappings FOR SELECT USING (true);
CREATE POLICY "Managers can manage adversus_product_mappings" ON public.adversus_product_mappings FOR ALL USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Authenticated users can view sales" ON public.sales FOR SELECT USING (true);
CREATE POLICY "Managers can manage sales" ON public.sales FOR ALL USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Authenticated users can view sale_items" ON public.sale_items FOR SELECT USING (true);
CREATE POLICY "Managers can manage sale_items" ON public.sale_items FOR ALL USING (is_manager_or_above(auth.uid()));

-- Indexes for performance
CREATE INDEX idx_client_campaigns_client ON public.client_campaigns(client_id);
CREATE INDEX idx_products_campaign ON public.products(client_campaign_id);
CREATE INDEX idx_adversus_events_external ON public.adversus_events(external_id);
CREATE INDEX idx_adversus_events_processed ON public.adversus_events(processed);
CREATE INDEX idx_sales_campaign ON public.sales(client_campaign_id);
CREATE INDEX idx_sales_datetime ON public.sales(sale_datetime);
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON public.sale_items(product_id);
CREATE INDEX idx_sale_items_needs_mapping ON public.sale_items(needs_mapping);

-- Triggers for updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_campaigns_updated_at BEFORE UPDATE ON public.client_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_adversus_campaign_mappings_updated_at BEFORE UPDATE ON public.adversus_campaign_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_adversus_product_mappings_updated_at BEFORE UPDATE ON public.adversus_product_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

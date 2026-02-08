-- =====================================================
-- DATAMAPPING SYSTEM: Complete Database Schema
-- =====================================================

-- 1. Create data_field_definitions table (Standard field registry)
CREATE TABLE public.data_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('customer', 'sale', 'employee', 'campaign', 'product')),
  data_type text NOT NULL DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'date', 'boolean')),
  is_pii boolean NOT NULL DEFAULT false,
  is_required boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  retention_days integer DEFAULT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.data_field_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for data_field_definitions
CREATE POLICY "Allow authenticated users to read field definitions"
  ON public.data_field_definitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage field definitions"
  ON public.data_field_definitions FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employee WHERE employee.id = auth.uid() AND employee.role IN ('admin', 'planner')));

-- 2. Create integration_field_mappings table (API-to-Standard mapping)
CREATE TABLE public.integration_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.dialer_integrations(id) ON DELETE CASCADE,
  source_field_path text NOT NULL,
  target_field_id uuid REFERENCES public.data_field_definitions(id) ON DELETE SET NULL,
  is_excluded boolean NOT NULL DEFAULT false,
  transform_rule jsonb DEFAULT NULL,
  sample_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(integration_id, source_field_path)
);

-- Enable RLS
ALTER TABLE public.integration_field_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integration_field_mappings
CREATE POLICY "Allow authenticated users to read field mappings"
  ON public.integration_field_mappings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage field mappings"
  ON public.integration_field_mappings FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employee WHERE employee.id = auth.uid() AND employee.role IN ('admin', 'planner')));

-- 3. Add normalized_data column to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS normalized_data jsonb DEFAULT NULL;

-- 4. Create index for efficient querying of normalized_data
CREATE INDEX IF NOT EXISTS idx_sales_normalized_data ON public.sales USING gin(normalized_data);

-- 5. Create updated_at triggers
CREATE TRIGGER update_data_field_definitions_updated_at
  BEFORE UPDATE ON public.data_field_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_integration_field_mappings_updated_at
  BEFORE UPDATE ON public.integration_field_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Seed standard field definitions
INSERT INTO public.data_field_definitions (field_key, display_name, category, data_type, is_pii, is_required, retention_days, description) VALUES
  -- Customer fields
  ('phone_number', 'Telefonnummer', 'customer', 'string', true, false, 365, 'Kundens telefonnummer'),
  ('customer_name', 'Kundenavn', 'customer', 'string', true, false, 365, 'Kundens fulde navn eller firmanavn'),
  ('customer_email', 'Kunde email', 'customer', 'string', true, false, 365, 'Kundens email-adresse'),
  ('customer_company', 'Firma', 'customer', 'string', false, false, NULL, 'Kundens firmanavn'),
  ('customer_address', 'Adresse', 'customer', 'string', true, false, 365, 'Kundens adresse'),
  ('customer_city', 'By', 'customer', 'string', false, false, NULL, 'Kundens by'),
  ('customer_zip', 'Postnummer', 'customer', 'string', false, false, NULL, 'Kundens postnummer'),
  ('cpr_number', 'CPR-nummer', 'customer', 'string', true, false, 0, 'Kundens CPR-nummer - slettes straks'),
  
  -- Employee/Agent fields
  ('agent_email', 'Sælger email', 'employee', 'string', true, true, NULL, 'Sælgerens email-adresse'),
  ('agent_name', 'Sælger navn', 'employee', 'string', true, false, NULL, 'Sælgerens fulde navn'),
  ('agent_external_id', 'Sælger ID', 'employee', 'string', false, false, NULL, 'Eksternt ID for sælgeren'),
  
  -- Sale fields
  ('sale_datetime', 'Salgstidspunkt', 'sale', 'date', false, true, NULL, 'Tidspunkt for salget'),
  ('opp_number', 'OPP-nummer', 'sale', 'string', false, false, NULL, 'OPP-referencenummer'),
  ('external_reference', 'Ekstern reference', 'sale', 'string', false, false, NULL, 'Ekstern reference til salget'),
  ('lead_id', 'Lead ID', 'sale', 'string', false, false, NULL, 'ID på lead i dialer'),
  ('sale_status', 'Salgsstatus', 'sale', 'string', false, false, NULL, 'Status på salget'),
  
  -- Campaign fields
  ('campaign_id', 'Kampagne ID', 'campaign', 'string', false, false, NULL, 'Eksternt kampagne-ID'),
  ('campaign_name', 'Kampagnenavn', 'campaign', 'string', false, false, NULL, 'Navn på kampagnen'),
  
  -- Product fields
  ('product_name', 'Produktnavn', 'product', 'string', false, false, NULL, 'Navn på produktet'),
  ('product_price', 'Enhedspris', 'product', 'number', false, false, NULL, 'Pris pr. enhed'),
  ('product_quantity', 'Antal', 'product', 'number', false, false, NULL, 'Antal enheder'),
  ('product_external_id', 'Produkt ID', 'product', 'string', false, false, NULL, 'Eksternt produkt-ID'),
  
  -- Common conditional fields used in pricing rules
  ('coverage_amount', 'Dækningssum', 'sale', 'number', false, false, NULL, 'Dækningssum/forsikringssum'),
  ('association_type', 'Foreningstype', 'sale', 'string', false, false, NULL, 'Type af forening (fagforening, a-kasse osv.)'),
  ('subscription_type', 'Abonnementstype', 'sale', 'string', false, false, NULL, 'Type af abonnement'),
  ('lead_type', 'Leadtype', 'sale', 'string', false, false, NULL, 'Type af lead')
ON CONFLICT (field_key) DO NOTHING;
-- Create kpi_definitions table for storing KPI documentation and calculation formulas
CREATE TABLE public.kpi_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('sales', 'hours', 'calls', 'employees', 'other')),
  description text,
  calculation_formula text,
  sql_query text,
  data_sources text[] DEFAULT '{}',
  important_notes text[] DEFAULT '{}',
  example_value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;

-- Only owners can manage KPI definitions (using existing is_owner function)
CREATE POLICY "Owners can view KPI definitions"
ON public.kpi_definitions FOR SELECT
TO authenticated
USING (public.is_owner(auth.uid()));

CREATE POLICY "Owners can insert KPI definitions"
ON public.kpi_definitions FOR INSERT
TO authenticated
WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Owners can update KPI definitions"
ON public.kpi_definitions FOR UPDATE
TO authenticated
USING (public.is_owner(auth.uid()));

CREATE POLICY "Owners can delete KPI definitions"
ON public.kpi_definitions FOR DELETE
TO authenticated
USING (public.is_owner(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_kpi_definitions_updated_at
BEFORE UPDATE ON public.kpi_definitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with initial KPI definitions based on the codebase
INSERT INTO public.kpi_definitions (slug, name, category, description, calculation_formula, sql_query, data_sources, important_notes, example_value) VALUES
-- Sales KPIs
('sales_count', 'Antal salg', 'sales', 
 'Tæller antal solgte produkter hvor counts_as_sale = true',
 'SUM(sale_items.quantity) WHERE products.counts_as_sale = true',
 'SELECT SUM(si.quantity) FROM sale_items si JOIN products p ON p.id = si.product_id WHERE p.counts_as_sale = true AND s.sale_datetime BETWEEN :start AND :end',
 ARRAY['sales', 'sale_items', 'products'],
 ARRAY['Inkluderer IKKE produkter med counts_as_sale = false', 'Inkluderer både telesales og fieldmarketing_sales', 'Ekskluderer "Ukendt" klient fra rapporter'],
 '127 salg'),

('total_commission', 'Total provision', 'sales',
 'Sum af provision fra alle salg. VIGTIGT: mapped_commission er allerede justeret for quantity.',
 'SUM(sale_items.mapped_commission)',
 'SELECT SUM(si.mapped_commission) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.sale_datetime BETWEEN :start AND :end',
 ARRAY['sale_items', 'sales'],
 ARRAY['Gange IKKE med quantity - det er allerede inkluderet i mapped_commission', 'Bruger product_campaign_overrides hvis de findes', 'Ekskluderer cancelled og rejected salg'],
 '45.250 DKK'),

('total_revenue', 'Total omsætning', 'sales',
 'Sum af omsætning fra alle salg baseret på mapped_revenue.',
 'SUM(sale_items.mapped_revenue)',
 'SELECT SUM(si.mapped_revenue) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.sale_datetime BETWEEN :start AND :end',
 ARRAY['sale_items', 'sales'],
 ARRAY['Bruger mapped_revenue som allerede er justeret', 'Omsætning != provision'],
 '125.000 DKK'),

('sales_forecast', 'Salgs-forecast', 'sales',
 'Fremskriver månedssalg baseret på nuværende performance og resterende arbejdsdage.',
 '(salg_indtil_nu ÷ arbejdsdage_brugt) × total_arbejdsdage_i_måneden',
 NULL,
 ARRAY['sales', 'sale_items', 'work_days_calculation'],
 ARRAY['Tager højde for helligdage', 'Bruger kun hverdage (mandag-fredag)', 'Kan variere baseret på team-aktivitet'],
 '450 salg (forecast)'),

-- Hours KPIs
('total_hours', 'Timer', 'hours',
 'Totale arbejdstimer fra vagtplaner eller timestamps afhængig af hours_source indstilling.',
 'SUM(timer) FROM team_standard_shifts ELLER time_stamps baseret på konfiguration',
 NULL,
 ARRAY['team_standard_shifts', 'time_stamps', 'settings'],
 ARRAY['hours_source setting bestemmer datakilden', 'shifts = planlagte timer, timestamps = faktiske timer', 'Pause trækkes fra ved timestamps'],
 '160 timer'),

('sick_days', 'Sygedage', 'hours',
 'Antal godkendte sygedage i perioden.',
 'COUNT(absences) WHERE type = ''sick'' AND status = ''approved''',
 'SELECT COUNT(*) FROM absence_request_v2 WHERE type = ''sick'' AND status = ''approved'' AND start_date BETWEEN :start AND :end',
 ARRAY['absence_request_v2'],
 ARRAY['Kun godkendte fravær tælles', 'Delvis sygedag tælles som 0.5 hvis is_full_day = false'],
 '3 dage'),

('vacation_days', 'Feriedage', 'hours',
 'Antal godkendte feriedage i perioden.',
 'COUNT(absences) WHERE type = ''vacation'' AND status = ''approved''',
 'SELECT COUNT(*) FROM absence_request_v2 WHERE type = ''vacation'' AND status = ''approved'' AND start_date BETWEEN :start AND :end',
 ARRAY['absence_request_v2'],
 ARRAY['Kun godkendte fravær tælles', 'Inkluderer feriefridage og afspadsering'],
 '5 dage'),

('work_days', 'Arbejdsdage', 'hours',
 'Antal arbejdsdage (mandag-fredag) eksklusiv helligdage.',
 'COUNT(hverdage) - COUNT(helligdage)',
 NULL,
 ARRAY['danish_holidays (hardcoded)', 'date_calculations'],
 ARRAY['Helligdage er hardcoded i systemet', 'Weekender (lørdag/søndag) ekskluderes altid'],
 '22 dage'),

-- Calls KPIs
('calls_total', 'Totale opkald', 'calls',
 'Totalt antal opkald registreret i dialer.',
 'COUNT(dialer_calls)',
 'SELECT COUNT(*) FROM dialer_calls WHERE call_datetime BETWEEN :start AND :end',
 ARRAY['dialer_calls'],
 ARRAY['Inkluderer både besvaret og ubesvaret', 'Data synkroniseres fra Adversus'],
 '1.250 opkald'),

('calls_answered', 'Besvarede opkald', 'calls',
 'Antal opkald med varighed over 0 sekunder.',
 'COUNT(dialer_calls) WHERE duration_seconds > 0',
 'SELECT COUNT(*) FROM dialer_calls WHERE duration_seconds > 0 AND call_datetime BETWEEN :start AND :end',
 ARRAY['dialer_calls'],
 ARRAY['duration_seconds > 0 indikerer besvaret opkald', 'Korte opkald (<5 sek) kan være voicemail'],
 '890 besvarede'),

('avg_call_duration', 'Gns. opkaldsvarighed', 'calls',
 'Gennemsnitlig varighed af besvarede opkald i sekunder.',
 'AVG(duration_seconds) WHERE duration_seconds > 0',
 'SELECT AVG(duration_seconds) FROM dialer_calls WHERE duration_seconds > 0 AND call_datetime BETWEEN :start AND :end',
 ARRAY['dialer_calls'],
 ARRAY['Kun besvarede opkald (duration > 0) inkluderes', 'Vises typisk i minutter:sekunder format'],
 '3:45 (225 sek)'),

('conversion_rate', 'Konverteringsrate', 'calls',
 'Procentdel af opkald der resulterer i salg.',
 '(antal_salg ÷ antal_opkald) × 100',
 NULL,
 ARRAY['sales', 'dialer_calls'],
 ARRAY['Matcher på agent og dato', 'Kan variere meget efter kampagne', 'Typisk mellem 5-15%'],
 '8.5%'),

-- Employee KPIs
('active_employees', 'Aktive medarbejdere', 'employees',
 'Antal medarbejdere med is_active = true.',
 'COUNT(employee_master_data) WHERE is_active = true',
 'SELECT COUNT(*) FROM employee_master_data WHERE is_active = true',
 ARRAY['employee_master_data'],
 ARRAY['Inkluderer alle stillinger', 'is_active = false betyder opsagt/stoppet'],
 '45 medarbejdere'),

('avg_tenure', 'Gns. anciennitet', 'employees',
 'Gennemsnitlig ansættelsestid for nuværende aktive medarbejdere.',
 'AVG(dage_siden_employment_start_date) WHERE is_active = true',
 'SELECT AVG(CURRENT_DATE - employment_start_date) FROM employee_master_data WHERE is_active = true AND employment_start_date IS NOT NULL',
 ARRAY['employee_master_data'],
 ARRAY['Kun aktive medarbejdere tælles', 'Medarbejdere uden startdato ekskluderes', 'Vises typisk i måneder'],
 '8.5 måneder'),

('churn_60_day', '60-dages frafald', 'employees',
 'Procentdel af nye medarbejdere der stopper inden for 60 dage.',
 '(stoppet_inden_60_dage ÷ alle_startede) × 100',
 NULL,
 ARRAY['employee_master_data'],
 ARRAY['Beregnes på medarbejdere der startede i perioden', 'employment_end_date - employment_start_date <= 60', 'Vigtigt KPI for onboarding-kvalitet'],
 '15%');
-- Insert break deduction KPI definition
INSERT INTO public.kpi_definitions (
  slug,
  name,
  category,
  description,
  calculation_formula,
  example_value,
  is_active,
  data_sources,
  important_notes,
  dashboard_slugs
) VALUES (
  'break_deduction_per_day',
  'Pausefradrag per dag',
  'hours',
  'Fast pausefradrag per arbejdsdag der fratrækkes ved timelønsberegning',
  'Konstant værdi - 1 times pause per arbejdsdag',
  '1',
  true,
  ARRAY['config'],
  ARRAY['Bruges til at beregne effektiv timeløn', 'Kan justeres af admin efter behov'],
  ARRAY['my-profile']
);

-- Insert effective hourly rate KPI definition
INSERT INTO public.kpi_definitions (
  slug,
  name,
  category,
  description,
  calculation_formula,
  example_value,
  is_active,
  data_sources,
  important_notes,
  dashboard_slugs
) VALUES (
  'hourly_rate_effective',
  'Effektiv Timeløn',
  'sales',
  'Din aktuelle timeløn baseret på provision divideret med arbejdstimer (minus pausefradrag per dag)',
  'total_commission / (live_sales_hours - (arbejdsdage × break_deduction_per_day))',
  '250',
  true,
  ARRAY['kpi_cached_values', 'kpi_definitions', 'time_stamps'],
  ARRAY['Timer hentes fra vagtplanen via live_sales_hours KPI', '1 times pause fratrækkes per arbejdsdag', 'Vises i Løn & Mål sektionen'],
  ARRAY['my-profile', 'employee-dashboard']
);
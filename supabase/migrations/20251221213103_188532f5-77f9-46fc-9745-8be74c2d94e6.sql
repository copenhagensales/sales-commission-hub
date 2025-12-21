
-- Add formula support columns to dashboard_kpis table
ALTER TABLE public.dashboard_kpis
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS formula TEXT,
ADD COLUMN IF NOT EXISTS base_metric TEXT;

-- data_source: 'manual' (no auto-calculation), 'base' (single base metric), 'formula' (calculated from formula)
-- formula: e.g. "antal_salg / timer" or "antal_salg / antal_medarbejdere"
-- base_metric: 'antal_salg', 'antal_kunder', 'timer', 'antal_medarbejdere' when data_source = 'base'

COMMENT ON COLUMN public.dashboard_kpis.data_source IS 'Data source type: manual, base (single metric), or formula (calculated)';
COMMENT ON COLUMN public.dashboard_kpis.formula IS 'Formula string for calculated KPIs, e.g. antal_salg / timer';
COMMENT ON COLUMN public.dashboard_kpis.base_metric IS 'Base metric key when data_source is base';

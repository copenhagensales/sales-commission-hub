INSERT INTO kpi_definitions (name, slug, category, description, is_active) VALUES
  ('Ansøgninger', 'applications', 'other', 'Antal nye kandidater i perioden', true),
  ('Planlagte interviews', 'scheduled_interviews', 'other', 'Antal kandidater med status interview_scheduled', true),
  ('Annullering', 'annullering', 'sales', 'Antal annullerede salg (definition afventer)', true),
  ('Nye hires per team', 'new_hires_by_team', 'employees', 'Antal nyansatte per team de sidste 30 dage', true),
  ('Nyansat frafald (60d)', 'new_hire_churn_60d', 'employees', 'Procent af alle ansatte der forlod inden 60 dage', true);
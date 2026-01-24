INSERT INTO kpi_definitions (slug, name, category, description, is_active, dashboard_slugs, data_sources) VALUES
  ('liga_position', 'Liga Position', 'other', 
   'Medarbejderens aktuelle overall_rank i Salgsligaen', true, ARRAY['league'], ARRAY['league_qualification_standings']),
  ('liga_division', 'Liga Division', 'other', 
   'Medarbejderens projekterede division (1=Salgsligaen)', true, ARRAY['league'], ARRAY['league_qualification_standings']),
  ('liga_division_rank', 'Rank i Division', 'other', 
   'Medarbejderens placering inden for sin division', true, ARRAY['league'], ARRAY['league_qualification_standings']),
  ('liga_provision', 'Liga Provision', 'sales', 
   'Akkumuleret provision i kvalifikationsperioden', true, ARRAY['league'], ARRAY['league_qualification_standings']);
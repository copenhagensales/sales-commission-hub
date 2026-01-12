-- Tilføj ny KPI definition: Salgsejer (Attribution)
INSERT INTO public.kpi_definitions (
  slug,
  name,
  category,
  description,
  calculation_formula,
  sql_query,
  data_sources,
  important_notes,
  example_value
) VALUES (
  'sales_ownership',
  'Salgsejer (Attribution)',
  'sales',
  'Definerer hvordan salg tilskrives til sælger, team og klient. Denne logik er autoritativ for alle dashboards og rapporter.',
  E'SÆLGER-ATTRIBUTION:\n  1. Match sales.agent_email (lowercase, case-insensitive)\n  2. → agents.email via employee_agent_mapping\n  3. → employee_master_data.id\n  Fallback: agent_name matching (email-prefix eller fuldt navn)\n\nTEAM-ATTRIBUTION:\n  1. Find sælger via ovenstående\n  2. → team_members.team_id WHERE employee_id = medarbejder\n  3. Én medarbejder kan tilhøre flere teams\n\nKLIENT-ATTRIBUTION:\n  1. sales.client_campaign_id\n  2. → client_campaigns.client_id\n  3. → clients.name\n  Alternativ: team_clients.client_id (team → klient mapping)',
  E'-- Komplet salgsejerskab\nSELECT \n  s.id as sale_id,\n  -- Sælger\n  e.first_name || '' '' || e.last_name as seller_name,\n  e.id as employee_id,\n  -- Team\n  t.name as team_name,\n  tm.team_id,\n  -- Klient\n  c.name as client_name,\n  cc.client_id\nFROM sales s\n-- Sælger attribution\nLEFT JOIN agents a ON LOWER(s.agent_email) = LOWER(a.email)\nLEFT JOIN employee_agent_mapping eam ON a.id = eam.agent_id\nLEFT JOIN employee_master_data e ON eam.employee_id = e.id\n-- Team attribution\nLEFT JOIN team_members tm ON e.id = tm.employee_id\nLEFT JOIN teams t ON tm.team_id = t.id\n-- Klient attribution\nLEFT JOIN client_campaigns cc ON s.client_campaign_id = cc.id\nLEFT JOIN clients c ON cc.client_id = c.id\nWHERE s.sale_datetime BETWEEN :start AND :end;',
  ARRAY['sales', 'employee_agent_mapping', 'agents', 'employee_master_data', 'team_members', 'teams', 'client_campaigns', 'clients', 'team_clients'],
  ARRAY[
    'Sælger-matching prioriterer email - agent_email sammenlignes case-insensitivt med agents.email',
    'Fallback til navn - Hvis email ikke matcher, bruges agent_name (understøtter email-prefix som "bena@")',
    'Team via junction table - team_members er autoritativ, IKKE team_id felt i employee_master_data',
    'Klient via kampagne - Sales tilhører klient via client_campaign_id → client_campaigns',
    'Umappede salg - Salg uden employee_agent_mapping match vises ikke i medarbejder-rapporter',
    'Fieldmarketing - FM-salg bruger seller_name → direkte match mod employee_master_data.name'
  ],
  'Salg #12345: Sælger: Anders Hansen, Team: TDC Team Alpha, Klient: TDC Erhverv'
);
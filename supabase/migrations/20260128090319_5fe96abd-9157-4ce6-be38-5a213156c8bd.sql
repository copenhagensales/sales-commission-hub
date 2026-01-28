-- 1. Tilføj show_popup kolonne til company_events (hvis ikke allerede tilføjet)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_events' AND column_name = 'show_popup') THEN
    ALTER TABLE public.company_events ADD COLUMN show_popup BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. Opret event_team_invitations tabel (hvis ikke allerede oprettet)
CREATE TABLE IF NOT EXISTS public.event_team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES company_events(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (event_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_event_team_invitations_event ON event_team_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_team_invitations_team ON event_team_invitations(team_id);

-- 3. Opret event_invitation_views tabel (hvis ikke allerede oprettet)
CREATE TABLE IF NOT EXISTS public.event_invitation_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES company_events(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (event_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_event_invitation_views_employee ON event_invitation_views(employee_id);

-- 4. RLS for event_team_invitations
ALTER TABLE event_team_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view invitations" ON event_team_invitations;
CREATE POLICY "Authenticated users can view invitations"
ON event_team_invitations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can manage event invitations" ON event_team_invitations;
CREATE POLICY "Users can manage event invitations"
ON event_team_invitations FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- 5. RLS for event_invitation_views
ALTER TABLE event_invitation_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all invitation views" ON event_invitation_views;
CREATE POLICY "Users can view all invitation views"
ON event_invitation_views FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can manage own invitation views" ON event_invitation_views;
CREATE POLICY "Users can manage own invitation views"
ON event_invitation_views FOR ALL TO authenticated
USING (employee_id IN (
  SELECT id FROM employee 
  WHERE email = auth.jwt()->>'email'
));
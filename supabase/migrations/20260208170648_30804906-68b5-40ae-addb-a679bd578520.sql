-- Opret tabel for team-baserede dashboard-rettigheder
CREATE TABLE IF NOT EXISTS public.team_dashboard_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  dashboard_slug TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'none' 
    CHECK (access_level IN ('none', 'team_leader', 'leadership', 'all')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, dashboard_slug)
);

-- Enable RLS
ALTER TABLE public.team_dashboard_permissions ENABLE ROW LEVEL SECURITY;

-- Kun ejere kan redigere (bruger eksisterende is_owner funktion)
CREATE POLICY "Owners can manage all permissions" 
ON public.team_dashboard_permissions FOR ALL 
TO authenticated 
USING (public.is_owner(auth.uid()))
WITH CHECK (public.is_owner(auth.uid()));

-- Alle autentificerede kan læse (for at tjekke egne rettigheder)
CREATE POLICY "Authenticated users can read permissions" 
ON public.team_dashboard_permissions FOR SELECT 
TO authenticated 
USING (true);

-- Updated_at trigger (bruger eksisterende funktion)
CREATE TRIGGER set_updated_at_team_dashboard_permissions
  BEFORE UPDATE ON public.team_dashboard_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indekser for performance
CREATE INDEX idx_team_dashboard_permissions_team_id 
ON public.team_dashboard_permissions(team_id);

CREATE INDEX idx_team_dashboard_permissions_dashboard_slug 
ON public.team_dashboard_permissions(dashboard_slug);
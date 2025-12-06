-- Add client association to teams table (many-to-many via junction table)
-- This allows teams to be linked to one or more clients

CREATE TABLE public.team_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(team_id, client_id)
);

-- Enable RLS
ALTER TABLE public.team_clients ENABLE ROW LEVEL SECURITY;

-- RLS policies - same as teams table
CREATE POLICY "Authenticated users can view team_clients"
ON public.team_clients
FOR SELECT
USING (true);

CREATE POLICY "Managers can manage team_clients"
ON public.team_clients
FOR ALL
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_team_clients_team_id ON public.team_clients(team_id);
CREATE INDEX idx_team_clients_client_id ON public.team_clients(client_id);
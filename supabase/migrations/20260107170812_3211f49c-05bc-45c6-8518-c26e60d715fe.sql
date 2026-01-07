-- Create table for team client daily bonus configuration
CREATE TABLE public.team_client_daily_bonus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  bonus_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  bonus_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, client_id)
);

-- Enable RLS
ALTER TABLE public.team_client_daily_bonus ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can view team client daily bonus"
ON public.team_client_daily_bonus
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert team client daily bonus"
ON public.team_client_daily_bonus
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update team client daily bonus"
ON public.team_client_daily_bonus
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete team client daily bonus"
ON public.team_client_daily_bonus
FOR DELETE
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_team_client_daily_bonus_updated_at
BEFORE UPDATE ON public.team_client_daily_bonus
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
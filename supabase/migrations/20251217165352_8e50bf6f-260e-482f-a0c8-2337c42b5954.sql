-- Create h2h_challenges table for storing battle invitations
CREATE TABLE public.h2h_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  opponent_employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  battle_mode TEXT NOT NULL DEFAULT '1v1',
  period TEXT NOT NULL DEFAULT 'week',
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.h2h_challenges ENABLE ROW LEVEL SECURITY;

-- Users can see challenges they sent or received
CREATE POLICY "Users can view own challenges" ON public.h2h_challenges
  FOR SELECT USING (
    challenger_employee_id = get_current_employee_id() 
    OR opponent_employee_id = get_current_employee_id()
  );

-- Users can create challenges
CREATE POLICY "Users can create challenges" ON public.h2h_challenges
  FOR INSERT WITH CHECK (challenger_employee_id = get_current_employee_id());

-- Users can update challenges they received (to accept/decline)
CREATE POLICY "Users can respond to received challenges" ON public.h2h_challenges
  FOR UPDATE USING (opponent_employee_id = get_current_employee_id());

-- Users can delete challenges they sent
CREATE POLICY "Users can delete own challenges" ON public.h2h_challenges
  FOR DELETE USING (challenger_employee_id = get_current_employee_id());

-- Index for quick lookup
CREATE INDEX idx_h2h_challenges_opponent ON public.h2h_challenges(opponent_employee_id, status);
CREATE INDEX idx_h2h_challenges_challenger ON public.h2h_challenges(challenger_employee_id);
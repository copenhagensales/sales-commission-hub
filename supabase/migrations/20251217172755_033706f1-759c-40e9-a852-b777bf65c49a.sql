-- Add accepted_at timestamp for fair start tracking
ALTER TABLE public.h2h_challenges 
ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone DEFAULT NULL;

-- Add index for faster queries on pending challenges
CREATE INDEX IF NOT EXISTS idx_h2h_challenges_status ON public.h2h_challenges(status);
CREATE INDEX IF NOT EXISTS idx_h2h_challenges_opponent ON public.h2h_challenges(opponent_employee_id, status);